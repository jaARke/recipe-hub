import 'server-only';
import { z } from 'zod';
import { requireMember } from '@/application/authorization';
import { SavedDraftEditConflictError, SavedDraftGoneError } from '@/application/drafts/errors';
import { savedDraftIdSchema } from '@/application/drafts/saved-draft';
import { editVersionSchema } from '@/application/edit-version';
import { ImportUnavailableError } from '@/application/ingestion/errors';
import { paginationSchema } from '@/application/pagination';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type { MemberRepository } from '@/application/ports/member-repository';
import {
	recipeSorts,
	type NewRecipe,
	type RecipePage,
	type RecipeRepository,
	type UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import type { SavedDraft, SavedDraftRepository } from '@/application/ports/saved-draft-repository';
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
import {
	parseRecipeContent,
	recipeIdSchema,
	type Recipe,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import { slugify, slugSchema } from '@/domain/recipe/slug';
import { getLogger } from '@/lib/logger';

const recipePageSchema = paginationSchema.extend({ sort: z.enum(recipeSorts) });

const logger = getLogger('recipes');

export type CreateRecipeInput = {
	content: RecipeContentInput;
	// The member's draft the recipe is added from, which goes as the recipe is saved, and the version of
	// it the form had, its savedAt. The recipe takes the provenance and the import of the import that
	// made the draft, if one did.
	draftId?: string;
	draftVersion?: string;
};

// Where a new recipe came from: manual entry, or the member's draft, with the import that made it.
type RecipeOrigin = Pick<NewRecipe, 'provenance' | 'importId' | 'fromDraft'>;

export class RecipeService {
	private readonly recipes: RecipeRepository;
	private readonly drafts: SavedDraftRepository;
	private readonly members: MemberRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	constructor(
		recipes: RecipeRepository,
		drafts: SavedDraftRepository,
		members: MemberRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.recipes = recipes;
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
		return toEditableRecipeDto(recipe);
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
	// The browser never names the provenance: a recipe saved from an import's draft takes what the
	// draft kept. A recipe added from a draft consumes it with the add, so one draft makes one recipe:
	// a draft another page added or deleted, or saved since the form had it, refuses the add before
	// anything is used, and the member's form keeps what they typed.
	async createRecipe(input: CreateRecipeInput): Promise<RecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		const origin = await this.recipeOrigin(input, actor.memberId);
		const content = parseRecipeContent(input.content);
		await this.assertImagesAttachable(content.images, [], actor.memberId);

		// The repository checks the draft again as it adds, and refuses a second recipe from the
		// import, as a save racing this one can make.
		let recipe: Recipe;
		try {
			recipe = await this.recipes.create({
				content,
				...origin,
				contributorId: actor.memberId,
				slugBase: slugify(content.title),
			});
		} catch (error) {
			throw this.refusedAdd(error, origin, actor.memberId);
		}

		logger.info('Recipe created', {
			recipeId: recipe.id,
			memberId: actor.memberId,
			entryMode: recipe.provenance.entryMode,
			...(origin.importId !== undefined && { importId: origin.importId }),
			...(origin.fromDraft !== undefined && { draftId: origin.fromDraft.id }),
		});
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
				content,
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

	// Entered by hand where the form names no draft. Otherwise the member's draft at the version the
	// form had, with the provenance and the import it kept from the import that made it, however long
	// ago. Ids and versions arrive from forms, so a malformed id, or one naming another member's
	// draft, names a draft that is gone, and a missing or malformed version one saved since. A draft
	// that expired while its form was open still gives its own, since the recipe was written from it.
	private async recipeOrigin(
		{ draftId, draftVersion }: Pick<CreateRecipeInput, 'draftId' | 'draftVersion'>,
		memberId: MemberId
	): Promise<RecipeOrigin> {
		if (draftId === undefined) {
			return { provenance: { entryMode: 'manual' } };
		}
		const parsed = savedDraftIdSchema.safeParse(draftId);
		const draft = parsed.success ? await this.drafts.findById(parsed.data) : null;
		if (draft?.memberId !== memberId) {
			throw this.goneDraft(parsed.data, memberId);
		}
		const version = editVersionSchema.safeParse(draftVersion);
		if (!version.success || version.data.getTime() !== draft.updatedAt.getTime()) {
			throw this.staleDraft(draft.id, memberId);
		}

		return {
			provenance: draft.provenance ?? { entryMode: 'manual' },
			...(draft.importId !== undefined && { importId: draft.importId }),
			fromDraft: { id: draft.id, expectedUpdatedAt: version.data },
		};
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
				drafts: this.drafts,
			}
		);
		if (problems.length > 0) {
			throw new InvalidRecipeError(problems);
		}
	}

	// What the repository refused an add for, as the member is told it, logged where it's expected.
	private refusedAdd(error: unknown, origin: RecipeOrigin, memberId: MemberId): unknown {
		const draftId = origin.fromDraft?.id;
		if (error instanceof ImportUnavailableError) {
			return this.unavailableImport(origin.importId, memberId);
		}
		if (error instanceof SavedDraftGoneError) {
			return this.goneDraft(draftId, memberId);
		}
		if (error instanceof SavedDraftEditConflictError && draftId !== undefined) {
			return this.staleDraft(draftId, memberId);
		}
		return error;
	}

	// Logged, since the member's form outlived its draft, as when another page added it.
	private goneDraft(
		draftId: SavedDraft['id'] | undefined,
		memberId: MemberId
	): SavedDraftGoneError {
		logger.warn('Recipe save refused for a missing draft', { draftId, memberId });
		return new SavedDraftGoneError();
	}

	// Logged, since the member has to reload the draft and redo their changes.
	private staleDraft(draftId: SavedDraft['id'], memberId: MemberId): SavedDraftEditConflictError {
		logger.warn('Recipe save refused for a draft saved since', { draftId, memberId });
		return new SavedDraftEditConflictError();
	}

	// Logged, since the editor has to reload and redo their changes.
	private staleSave(recipeId: RecipeId, memberId: MemberId): RecipeEditConflictError {
		logger.warn('Recipe save refused as stale', { recipeId, memberId });
		return new RecipeEditConflictError();
	}

	// Logged, since the member has to import the recipe again.
	private unavailableImport(
		importId: RecipeImportId | undefined,
		memberId: MemberId
	): ImportUnavailableError {
		logger.warn('Recipe save refused for an unavailable import', { importId, memberId });
		return new ImportUnavailableError();
	}
}
