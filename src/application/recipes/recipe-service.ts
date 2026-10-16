import 'server-only';
import { z } from 'zod';
import { requireMember } from '@/application/authorization';
import { savedDraftIdSchema } from '@/application/drafts/saved-draft';
import { editVersionSchema } from '@/application/edit-version';
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
import type { SavedDraftRepository } from '@/application/ports/saved-draft-repository';
import { unattachableImageProblems } from '@/application/recipes/attachable-images';
import {
	InvalidRecipePageError,
	RecipeEditConflictError,
	RecipeNotFoundError,
} from '@/application/recipes/errors';
import type { ImageFolders } from '@/application/recipes/image-folders';
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
import type { Provenance } from '@/domain/recipe/provenance';
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

const logger = getLogger('recipes');

export type CreateRecipeInput = {
	content: RecipeContentInput;
	// The import the member reviewed, whose provenance the recipe takes; absent for manual entry.
	importId?: string;
	// The draft the member saved the recipe from, which goes once the recipe is saved. With no import
	// named, the recipe takes the provenance the draft kept from an import whose review is gone.
	draftId?: string;
};

// Where a new recipe came from: manual entry, an import it is saved from, or a draft that kept an
// import's provenance.
type RecipeOrigin = Pick<NewRecipe, 'provenance' | 'importId'>;

export class RecipeService {
	private readonly recipes: RecipeRepository;
	private readonly imports: RecipeImportRepository;
	private readonly drafts: SavedDraftRepository;
	private readonly members: MemberRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	constructor(
		recipes: RecipeRepository,
		imports: RecipeImportRepository,
		drafts: SavedDraftRepository,
		members: MemberRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.recipes = recipes;
		this.imports = imports;
		this.drafts = drafts;
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

	// Every recipe's id, newest first, by which the edit page lets the browser drop unsaved changes to
	// a recipe deleted since.
	async listRecipeIds(): Promise<RecipeId[]> {
		return this.recipes.listIds();
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
		return recipe === null ? null : toRecipeMemberViewDto(canModifyRecipe(actor, recipe));
	}

	// Writes resolve the actor first, so an anonymous caller learns nothing about which recipes exist.
	// The browser never names the provenance: a recipe saved from an import takes the import's, and
	// one saved from the member's draft of an import takes what the draft kept.
	async createRecipe(input: CreateRecipeInput): Promise<RecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		// Checked before the content, since no edit to the content can save an unavailable import.
		const origin = await this.recipeOrigin(input, actor.memberId);
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
		if (input.draftId !== undefined) {
			await this.deleteSavedDraft(input.draftId, actor.memberId, recipe.id);
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
		const version = editVersionSchema.safeParse(expectedUpdatedAt);
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

	// Without an import id, the recipe takes the provenance its draft kept, or was entered by hand.
	// Import ids arrive from forms, so a malformed one names no import. The import must be the
	// member's and its draft still reviewable.
	private async recipeOrigin(
		{ importId, draftId }: Pick<CreateRecipeInput, 'importId' | 'draftId'>,
		memberId: MemberId
	): Promise<RecipeOrigin> {
		if (importId === undefined) {
			const provenance = await this.savedDraftProvenance(draftId, memberId);
			return { provenance: provenance ?? { entryMode: 'manual' } };
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

	// The provenance the member's draft kept from the import it was saved from, if any. Ids arrive
	// from forms, so a malformed one, or one naming another member's draft, gives none. A draft that
	// expired while its form was open still gives its own, since the recipe was written from it.
	private async savedDraftProvenance(
		draftId: string | undefined,
		memberId: MemberId
	): Promise<Provenance | undefined> {
		const parsed = savedDraftIdSchema.safeParse(draftId);
		const draft = parsed.success ? await this.drafts.findById(parsed.data) : null;
		return draft?.memberId === memberId ? draft.provenance : undefined;
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

	// The images the recipe may name, as the contributor's: see unattachableImageProblems.
	private async assertImagesAttachable(
		images: readonly RecipeImage[],
		existing: readonly RecipeImage[],
		contributorId: MemberId
	): Promise<void> {
		const problems = await unattachableImageProblems(
			images.map(({ pathname }) => pathname),
			existing.map(({ pathname }) => pathname),
			contributorId,
			{
				folders: this.folders,
				images: this.images,
				recipes: this.recipes,
				imports: this.imports,
				drafts: this.drafts,
			}
		);
		if (problems.length > 0) {
			throw new InvalidRecipeError(problems);
		}
	}

	// After the recipe commits, with the draft the member saved from the import's review. A failure
	// leaves the drafts for their expiry to clear, and the import is already spent, since the recipe
	// names it.
	private async clearImportDraft(importId: RecipeImportId, recipeId: RecipeId): Promise<void> {
		try {
			await this.imports.clearDraft(importId);
			await this.drafts.deleteByImportId(importId);
		} catch (err) {
			logger.warn('Import draft could not be cleared', { importId, recipeId, err });
		}
	}

	// After the recipe commits, as clearImportDraft does. Ids arrive from forms, so a malformed one, or
	// one that names another member's draft, deletes nothing.
	private async deleteSavedDraft(
		draftId: string,
		memberId: MemberId,
		recipeId: RecipeId
	): Promise<void> {
		const parsed = savedDraftIdSchema.safeParse(draftId);
		if (!parsed.success) {
			return;
		}
		try {
			const draft = await this.drafts.findById(parsed.data);
			if (draft?.memberId === memberId) {
				await this.drafts.delete(draft.id);
			}
		} catch (err) {
			logger.warn('Saved draft could not be deleted', { draftId: parsed.data, recipeId, err });
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
