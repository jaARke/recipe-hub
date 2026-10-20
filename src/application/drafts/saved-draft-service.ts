import 'server-only';
import { requireMember } from '@/application/authorization';
import {
	InvalidSavedDraftError,
	SavedDraftDeleteConflictError,
	SavedDraftEditConflictError,
} from '@/application/drafts/errors';
import {
	savedDraftCutoff,
	savedDraftExpiry,
	savedDraftIdSchema,
	type SavedDraftId,
} from '@/application/drafts/saved-draft';
import type {
	DraftSummaryDto,
	SavedDraftDto,
	SavedDraftRef,
} from '@/application/drafts/saved-draft-dtos';
import { editVersionSchema } from '@/application/edit-version';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type {
	SavedDraft,
	SavedDraftContents,
	SavedDraftRepository,
	SavedDraftSummary,
	SavedDraftUpdate,
} from '@/application/ports/saved-draft-repository';
import { unattachableImageProblems } from '@/application/recipes/attachable-images';
import type { ImageFolders } from '@/application/recipes/image-folders';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import { recipeImportIdSchema } from '@/domain/recipe/recipe-import';
import { getLogger } from '@/lib/logger';

const logger = getLogger('drafts');

export type SaveDraftInput = {
	// The draft the form opened or last saved, if any, and its version as the form has it.
	draftId?: string;
	draftVersion?: string;
	// The recipe form's values, which only the form reads.
	values: unknown;
	// What the list of drafts names it by, absent while it has no title.
	title?: string;
	// The images the values name, dish photos then scans, where a problem with the third is at
	// images.2.pathname.
	imagePathnames: readonly string[];
};

// Where the import that made a draft came from, as the draft's page says it.
function importedFrom(
	provenance: Provenance | undefined
): Pick<SavedDraftDto, 'mode' | 'sourceUrl'> {
	switch (provenance?.entryMode) {
		case 'url':
			return { mode: 'url', sourceUrl: provenance.sourceUrl };
		case 'photo':
			return { mode: 'photo' };
		default:
			return {};
	}
}

function toSavedDraftDto(draft: SavedDraft): SavedDraftDto {
	return {
		id: draft.id,
		...importedFrom(draft.provenance),
		...(draft.values !== undefined && { values: draft.values }),
		...(draft.imported !== undefined && { imported: draft.imported }),
		savedAt: draft.updatedAt,
		expiresAt: savedDraftExpiry(draft.updatedAt),
	};
}

function toDraftSummary(draft: SavedDraftSummary): DraftSummaryDto {
	const { mode } = importedFrom(draft.provenance);
	return {
		id: draft.id,
		...(mode !== undefined && { mode }),
		...(draft.title !== undefined && { title: draft.title }),
		savedAt: draft.updatedAt,
		expiresAt: savedDraftExpiry(draft.updatedAt),
	};
}

// The members' drafts: those they save from the recipe form, and those their imports make, which
// the form saves over. Each is kept for the settings' lifetime after its last change. Readers ignore
// an expired draft, which the daily cleanup deletes. A member sees and changes only their own drafts,
// and one that is not theirs reads as one that does not exist.
export class SavedDraftService {
	private readonly drafts: SavedDraftRepository;
	private readonly recipes: RecipeRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	// Recipes, the store, and the folders are where a draft's images are checked.
	constructor(
		drafts: SavedDraftRepository,
		recipes: RecipeRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.drafts = drafts;
		this.recipes = recipes;
		this.images = images;
		this.actors = actors;
		this.folders = folders;
	}

	// Null for a draft that is not the member's or has expired. Ids arrive from URLs, so a malformed id
	// names no draft.
	async getDraft(id: string): Promise<SavedDraftDto | null> {
		const actor = requireMember(await this.actors.currentActor());
		const draft = await this.findDraft(id);
		return this.isOwnDraft(draft, actor.memberId, new Date()) ? toSavedDraftDto(draft) : null;
	}

	// The member's draft the import made, which the import's earlier address leads to; null as
	// getDraft is.
	async getImportDraft(importId: string): Promise<SavedDraftDto | null> {
		const actor = requireMember(await this.actors.currentActor());
		const parsed = recipeImportIdSchema.safeParse(importId);
		const draft = parsed.success ? await this.drafts.findByImportId(parsed.data) : null;
		return this.isOwnDraft(draft, actor.memberId, new Date()) ? toSavedDraftDto(draft) : null;
	}

	// Saves whatever the form holds, with nothing required: over the member's draft the form opened or
	// last saved, or else as a new draft, as when the draft was deleted elsewhere. A save over a draft
	// must name the version the form has of it, so one another page saved since is never replaced: that
	// save is a conflict, which the form reports. A draft an import made keeps its provenance, so its
	// recipe still credits the import's source. Its images are checked as a recipe's are, so a draft
	// keeps alive only images the member could attach.
	async saveDraft(input: SaveDraftInput): Promise<SavedDraftRef> {
		const actor = requireMember(await this.actors.currentActor());
		const found = await this.findDraft(input.draftId);
		const existing = this.isOwnDraft(found, actor.memberId, new Date()) ? found : null;
		// Checked before the images, so a stale copy is not checked against images saved since.
		const version = editVersionSchema.safeParse(input.draftVersion);
		if (
			existing !== null &&
			(!version.success || version.data.getTime() !== existing.updatedAt.getTime())
		) {
			throw this.staleSave(actor.memberId, existing.id);
		}

		const problems = await unattachableImageProblems(
			input.imagePathnames,
			existing?.imagePathnames ?? [],
			actor.memberId,
			{
				folders: this.folders,
				images: this.images,
				recipes: this.recipes,
				drafts: this.drafts,
			}
		);
		if (problems.length > 0) {
			throw new InvalidSavedDraftError(problems);
		}

		const contents: SavedDraftContents = {
			...(input.title !== undefined && { title: input.title }),
			values: input.values,
			imagePathnames: input.imagePathnames,
		};
		// At the version the form named, which is the one found.
		const updated =
			existing === null
				? null
				: await this.updateDraft(
						existing.id,
						{ ...contents, expectedUpdatedAt: existing.updatedAt },
						actor.memberId
					);
		const saved = updated ?? (await this.drafts.create({ ...contents, memberId: actor.memberId }));

		logger.info('Draft saved', { draftId: saved.id, memberId: actor.memberId });
		return { id: saved.id, savedAt: saved.updatedAt };
	}

	// Deletes the member's draft at the version the page has of it, so a draft another page saved since
	// is kept: that delete is a conflict, which the page reports. A draft already gone, or another
	// member's, is left as it is.
	async deleteDraft(id: string, version: string | undefined): Promise<void> {
		const actor = requireMember(await this.actors.currentActor());
		const draft = await this.findDraft(id);
		if (draft?.memberId !== actor.memberId) {
			return;
		}

		const parsed = editVersionSchema.safeParse(version);
		if (!parsed.success) {
			throw this.staleDelete(actor.memberId, draft.id);
		}
		try {
			await this.drafts.delete(draft.id, parsed.data);
		} catch (error) {
			throw error instanceof SavedDraftEditConflictError
				? this.staleDelete(actor.memberId, draft.id)
				: error;
		}
		logger.info('Saved draft deleted', { draftId: draft.id, memberId: actor.memberId });
	}

	// The member's drafts, newest first.
	async listDrafts(): Promise<DraftSummaryDto[]> {
		const actor = requireMember(await this.actors.currentActor());
		const drafts = await this.drafts.list(actor.memberId, savedDraftCutoff(new Date()));
		return drafts.map(toDraftSummary);
	}

	// How many of the member's drafts have not expired, for the header to show beside Add recipe.
	// Open to anyone: none for a signed-out visitor.
	async countDrafts(): Promise<number> {
		const actor = await this.actors.currentActor();
		if (actor.kind === 'anonymous') {
			return 0;
		}
		return this.drafts.count(actor.memberId, savedDraftCutoff(new Date()));
	}

	// Ids arrive from forms and URLs, so a malformed id names no draft.
	private async findDraft(id: string | undefined): Promise<SavedDraft | null> {
		const parsed = savedDraftIdSchema.safeParse(id);
		return parsed.success ? this.drafts.findById(parsed.data) : null;
	}

	private isOwnDraft(draft: SavedDraft | null, memberId: MemberId, now: Date): draft is SavedDraft {
		return (
			draft !== null && draft.memberId === memberId && draft.updatedAt >= savedDraftCutoff(now)
		);
	}

	// The repository checks the version again as it writes, so a save made since is never replaced.
	// Null for a draft deleted meanwhile, which the save then stores anew.
	private async updateDraft(
		id: SavedDraftId,
		update: SavedDraftUpdate,
		memberId: MemberId
	): Promise<SavedDraft | null> {
		try {
			return await this.drafts.update(id, update);
		} catch (error) {
			throw error instanceof SavedDraftEditConflictError ? this.staleSave(memberId, id) : error;
		}
	}

	// Logged, since the member has to open the draft again and redo their changes.
	private staleSave(memberId: MemberId, draftId: SavedDraftId): SavedDraftEditConflictError {
		logger.warn('Draft save refused as stale', { draftId, memberId });
		return new SavedDraftEditConflictError();
	}

	// Logged, since a page went on showing a draft another page had changed.
	private staleDelete(memberId: MemberId, draftId: SavedDraftId): SavedDraftDeleteConflictError {
		logger.warn('Draft delete refused as stale', { draftId, memberId });
		return new SavedDraftDeleteConflictError();
	}
}
