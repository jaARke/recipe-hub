import 'server-only';
import { z } from 'zod';
import { requireMember } from '@/application/authorization';
import { ImportUnavailableError } from '@/application/ingestion/errors';
import { paginationSchema } from '@/application/pagination';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type { MemberRepository } from '@/application/ports/member-repository';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import {
	recipeSorts,
	type NewRecipe,
	type RecipePage,
	type RecipeRepository,
	type UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import {
	InvalidRecipePageError,
	RecipeEditConflictError,
	RecipeNotFoundError,
} from '@/application/recipes/errors';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imagesInUse } from '@/application/recipes/images-in-use';
import {
	toEditableRecipeDto,
	toPublicRecipeDto,
	toRecipeMemberViewDto,
	toRecipeRef,
	toRecipeSummaryDto,
	type DeletedRecipeRef,
	type EditableRecipeDto,
	type PublicRecipeDto,
	type RecipeMemberViewDto,
	type RecipeRef,
	type RecipeSummaryPage,
	type UpdatedRecipeRef,
} from '@/application/recipes/recipe-dtos';
import { assertCanModifyRecipe, canModifyRecipe } from '@/application/recipes/recipe-policy';
import type { MemberId } from '@/domain/member/member';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import {
	parseRecipeContent,
	recipeIdSchema,
	type Recipe,
	type RecipeContent,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	recipeImportIdSchema,
	reviewableDraft,
	type RecipeImportId,
} from '@/domain/recipe/recipe-import';
import { slugify, slugSchema } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag-normalization';
import { getLogger } from '@/lib/logger';

const recipePageSchema = paginationSchema.extend({ sort: z.enum(recipeSorts) });

// A recipe's version as an editor holds it: its updatedAt, from Date.toISOString().
const versionSchema = z.iso.datetime().transform((value) => new Date(value));

// For an image this environment never stored: its upload failed, was cut off, or never happened. A
// save naming another member's photo gets it too, so the refusal tells nothing about their photos.
const unstoredImageMessage = "This photo didn't upload. Remove it and add it again.";

const logger = getLogger('recipes');

export type CreateRecipeInput = {
	content: RecipeContentInput;
	// The import the member reviewed, whose provenance the recipe takes; absent for manual entry.
	importId?: string;
};

// Where a new recipe came from: manual entry, or an import it is saved from.
type RecipeOrigin = Pick<NewRecipe, 'provenance' | 'importId'>;

export class RecipeService {
	private readonly recipes: RecipeRepository;
	private readonly imports: RecipeImportRepository;
	private readonly members: MemberRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	constructor(
		recipes: RecipeRepository,
		imports: RecipeImportRepository,
		members: MemberRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.recipes = recipes;
		this.imports = imports;
		this.members = members;
		this.images = images;
		this.actors = actors;
		this.folders = folders;
	}

	// Public reads never ask for the actor, so pages can cache them. An old slug finds the recipe too,
	// and the DTO carries its current slug.
	async getRecipe(slug: string): Promise<PublicRecipeDto | null> {
		const recipe = await this.findRecipeBySlug(slug);
		if (recipe === null) {
			return null;
		}

		// A foreign key keeps every contributor, so a missing one is broken data, not a missing recipe.
		const contributor = await this.members.findById(recipe.contributorId);
		if (contributor === null) {
			throw new Error('Recipe contributor was not found');
		}

		return toPublicRecipeDto(recipe, contributor);
	}

	async listRecipes(page: RecipePage): Promise<RecipeSummaryPage> {
		const result = recipePageSchema.safeParse(page);
		if (!result.success) {
			throw new InvalidRecipePageError();
		}

		const [recipes, total] = await Promise.all([
			this.recipes.list(result.data),
			this.recipes.count(),
		]);
		return { recipes: recipes.map(toRecipeSummaryDto), total };
	}

	// Every tag label in use, most used first, which the recipe form suggests.
	async listTagLabels(): Promise<string[]> {
		return this.recipes.listTagLabels();
	}

	// Members-only reads resolve the actor first too, so an anonymous caller learns nothing.
	async getRecipeForEditing(slug: string): Promise<EditableRecipeDto | null> {
		const actor = requireMember(await this.actors.currentActor());
		const recipe = await this.findRecipeBySlug(slug);
		if (recipe === null) {
			return null;
		}

		assertCanModifyRecipe(actor, recipe);
		return toEditableRecipeDto(recipe, await this.respellableTags(recipe));
	}

	// Null for a signed-out visitor, who sees the public recipe alone.
	async getRecipeMemberView(slug: string): Promise<RecipeMemberViewDto | null> {
		const actor = await this.actors.currentActor();
		if (actor.kind === 'anonymous') {
			return null;
		}

		const recipe = await this.findRecipeBySlug(slug);
		return recipe === null ? null : toRecipeMemberViewDto(recipe, canModifyRecipe(actor, recipe));
	}

	// Writes resolve the actor first, so an anonymous caller learns nothing about which recipes exist.
	// The browser never names the provenance: a recipe saved from an import takes the import's.
	async createRecipe(input: CreateRecipeInput): Promise<RecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		// Checked before the content, since no edit to the content can save an unavailable import.
		const origin = await this.recipeOrigin(input.importId, actor.memberId);
		const content = parseRecipeContent(input.content);
		await this.assertImagesAttachable(content.images, [], actor.memberId);

		// The repository refuses a second recipe from the import, as a save racing this one can make.
		let recipe: Recipe;
		try {
			recipe = await this.recipes.create({
				content: await this.withCanonicalTags(content),
				...origin,
				contributorId: actor.memberId,
				slugBase: slugify(content.title),
			});
		} catch (error) {
			throw error instanceof ImportUnavailableError
				? this.unavailableImport(origin.importId, actor.memberId)
				: error;
		}

		logger.info('Recipe created', {
			recipeId: recipe.id,
			memberId: actor.memberId,
			entryMode: recipe.provenance.entryMode,
			...(origin.importId !== undefined && { importId: origin.importId }),
		});
		if (origin.importId !== undefined) {
			await this.clearImportDraft(origin.importId, recipe.id);
		}
		return toRecipeRef(recipe);
	}

	// The slug follows the title, and the previous one keeps finding the recipe. A change of case or
	// punctuation leaves the slug as it is. The version is the editor's EditableRecipeDto.updatedAt as
	// an ISO string; a save made since, or a malformed version, is a conflict, which a reload resolves.
	async updateRecipe(
		id: string,
		input: RecipeContentInput,
		expectedUpdatedAt: string
	): Promise<UpdatedRecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		const recipe = await this.findRecipe(id);
		assertCanModifyRecipe(actor, recipe);
		// Checked before the content, so a stale copy is not checked against images saved since.
		const version = versionSchema.safeParse(expectedUpdatedAt);
		if (!version.success || version.data.getTime() !== recipe.updatedAt.getTime()) {
			throw this.staleSave(recipe.id, actor.memberId);
		}

		const content = parseRecipeContent(input);
		await this.assertImagesAttachable(content.images, recipe.images, recipe.contributorId);
		const slugBase = slugify(content.title);

		// The repository checks the version again under its lock, so the images replaced are these.
		let updated: UpdatedRecipe | null;
		try {
			updated = await this.recipes.update(recipe.id, {
				content: await this.withCanonicalTags(content, recipe.id),
				expectedUpdatedAt: version.data,
				slugBase: slugBase === slugify(recipe.title) ? undefined : slugBase,
			});
		} catch (error) {
			throw error instanceof RecipeEditConflictError
				? this.staleSave(recipe.id, actor.memberId)
				: error;
		}
		if (updated === null) {
			throw new RecipeNotFoundError();
		}

		const { recipe: saved, previousSlug } = updated;
		logger.info('Recipe updated', { recipeId: saved.id, memberId: actor.memberId });
		const kept = new Set(saved.images.map(({ pathname }) => pathname));
		return {
			...toRecipeRef(saved),
			...(saved.slug !== previousSlug && { previousSlug }),
			releasedImages: {
				recipeId: saved.id,
				images: recipe.images.filter(({ pathname }) => !kept.has(pathname)),
			},
		};
	}

	async deleteRecipe(id: string): Promise<DeletedRecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		const recipe = await this.findRecipe(id);
		assertCanModifyRecipe(actor, recipe);

		// The deleted row's slug and images, which a concurrent edit may have changed since the read.
		const deleted = await this.recipes.delete(recipe.id);
		if (deleted === null) {
			throw new RecipeNotFoundError();
		}

		logger.info('Recipe deleted', { recipeId: deleted.id, memberId: actor.memberId });
		return {
			...toRecipeRef(deleted),
			releasedImages: { recipeId: deleted.id, images: deleted.images },
		};
	}

	// Without an import id, the recipe was entered by hand. Import ids arrive from forms, so a malformed
	// one names no import. The import must be the member's and its draft still reviewable.
	private async recipeOrigin(
		importId: string | undefined,
		memberId: MemberId
	): Promise<RecipeOrigin> {
		if (importId === undefined) {
			return { provenance: { entryMode: 'manual' } };
		}

		const parsed = recipeImportIdSchema.safeParse(importId);
		const recipeImport = parsed.success ? await this.imports.findById(parsed.data) : null;
		const draft =
			recipeImport?.memberId === memberId ? reviewableDraft(recipeImport, new Date()) : null;
		if (recipeImport === null || draft === null) {
			throw this.unavailableImport(parsed.data, memberId);
		}

		return { provenance: draft.provenance, importId: recipeImport.id };
	}

	// Slugs arrive from URLs, so a malformed slug names no recipe.
	private async findRecipeBySlug(slug: string): Promise<Recipe | null> {
		return slugSchema.safeParse(slug).success ? this.recipes.findBySlug(slug) : null;
	}

	// Ids arrive from URLs and forms, so a malformed id names no recipe.
	private async findRecipe(id: string): Promise<Recipe> {
		const parsed = recipeIdSchema.safeParse(id);
		const recipe = parsed.success ? await this.recipes.findById(parsed.data) : null;
		if (recipe === null) {
			throw new RecipeNotFoundError();
		}

		return recipe;
	}

	// Each image the recipe does not already have must be an upload this environment stored that no
	// other member's recipe or draft names, since an image another recipe names is never removed, and
	// naming theirs would keep it from them. Images it has stay as they are, such as production's photos
	// on a preview's copy. Only the contributor's own recipes and drafts may name them already, so an
	// admin's edit adds only what the contributor could.
	private async assertImagesAttachable(
		images: readonly RecipeImage[],
		existing: readonly RecipeImage[],
		contributorId: MemberId
	): Promise<void> {
		const existingPathnames = new Set(existing.map(({ pathname }) => pathname));
		const added = images
			.map(({ pathname }) => pathname)
			.filter((pathname) => !existingPathnames.has(pathname) && this.folders.contains(pathname));
		const othersImages = await imagesInUse(
			added,
			this.recipes,
			this.imports,
			new Date(),
			contributorId
		);
		const stored = await Promise.all(
			images.map(
				async ({ pathname }) =>
					existingPathnames.has(pathname) ||
					(this.folders.contains(pathname) &&
						!othersImages.has(pathname) &&
						(await this.images.has(pathname)))
			)
		);

		const problems = stored.flatMap((isStored, index) =>
			isStored ? [] : [{ path: `images.${index}.pathname`, message: unstoredImageMessage }]
		);
		if (problems.length > 0) {
			throw new InvalidRecipeError(problems);
		}
	}

	// After the recipe commits. A failure leaves the draft for its expiry to clear, and the import is
	// already spent, since the recipe names it.
	private async clearImportDraft(importId: RecipeImportId, recipeId: RecipeId): Promise<void> {
		try {
			await this.imports.clearDraft(importId);
		} catch (err) {
			logger.warn('Import draft could not be cleared', { importId, recipeId, err });
		}
	}

	// Logged, since the editor has to reload and redo their changes.
	private staleSave(recipeId: RecipeId, memberId: MemberId): RecipeEditConflictError {
		logger.warn('Recipe save refused as stale', { recipeId, memberId });
		return new RecipeEditConflictError();
	}

	// Logged, since the member has to import the recipe again. A malformed id is left out.
	private unavailableImport(
		importId: RecipeImportId | undefined,
		memberId: MemberId
	): ImportUnavailableError {
		logger.warn('Recipe save refused for an unavailable import', { importId, memberId });
		return new ImportUnavailableError();
	}

	// A tag takes the label other recipes already use, so an update can respell a tag only it uses.
	private async withCanonicalTags(
		content: RecipeContent,
		excludeRecipeId?: RecipeId
	): Promise<RecipeContent> {
		const labels = await this.recipes.findTagLabels(content.tags.map(tagKey), excludeRecipeId);
		const labelsByKey = new Map(labels.map((label) => [tagKey(label), label]));

		return {
			...content,
			tags: content.tags.map((tag) => labelsByKey.get(tagKey(tag)) ?? tag),
		};
	}

	// The recipe's tags that no other recipe uses, which withCanonicalTags lets an update respell.
	private async respellableTags(recipe: Recipe): Promise<string[]> {
		const labels = await this.recipes.findTagLabels(recipe.tags.map(tagKey), recipe.id);
		const sharedKeys = new Set(labels.map(tagKey));
		return recipe.tags.filter((tag) => !sharedKeys.has(tagKey(tag)));
	}
}
