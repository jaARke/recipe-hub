import 'server-only';
import { requireMember } from '@/application/authorization';
import { InvalidSavedDraftError, SavedDraftEditConflictError } from '@/application/drafts/errors';
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
import { ImportUnavailableError } from '@/application/ingestion/errors';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type {
	RecipeImportRepository,
	UnsavedImport,
} from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type {
	NewSavedDraft,
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
import {
	importDraftCutoff,
	recipeImportIdSchema,
	reviewableDraft,
	type RecipeImportId,
} from '@/domain/recipe/recipe-import';
import { daysInMilliseconds } from '@/lib/dates';
import { getLogger } from '@/lib/logger';
import { settings } from '@/lib/settings';

const logger = getLogger('drafts');

export type SaveDraftInput = {
	// The draft the form opened or last saved, if any, and its version as the form has it.
	draftId?: string;
	draftVersion?: string;
	// The import whose review the form shows, if any, whose one draft this is.
	importId?: string;
	// The recipe form's values, which only the form reads.
	values: unknown;
	// What the list of drafts names it by, absent while it has no title.
	title?: string;
	// The images the values name, dish photos then scans, where a problem with the third is at
	// images.2.pathname.
	imagePathnames: readonly string[];
};

// The import a draft continues, with the provenance its recipe takes, which the draft keeps.
type ContinuedImport = Required<Pick<NewSavedDraft, 'importId' | 'provenance'>>;

// Where a draft saved from an import's review came from, as the import's own review says it.
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

// When an import's draft expires: its lifetime after the import started, as importDraftCutoff
// counts back.
function importDraftExpiry(importedAt: Date): Date {
	return new Date(
		importedAt.getTime() + daysInMilliseconds(settings.imports.importDraftLifetimeDays)
	);
}

function listedAt(entry: DraftSummaryDto): number {
	return (entry.kind === 'saved' ? entry.savedAt : entry.importedAt).getTime();
}

function toImportSummary({ id, mode, title, createdAt }: UnsavedImport): DraftSummaryDto {
	return {
		kind: 'import',
		id,
		mode,
		...(title !== undefined && { title }),
		importedAt: createdAt,
		expiresAt: importDraftExpiry(createdAt),
	};
}

// The drafts members save from the recipe form, each kept for the settings' lifetime after its last
// save, and listed in Drafts with their imports' drafts. Readers ignore an expired draft, which the
// daily cleanup deletes. A member sees and changes only their own drafts, and one that is not theirs
// reads as one that does not exist.
export class SavedDraftService {
	private readonly drafts: SavedDraftRepository;
	private readonly imports: RecipeImportRepository;
	private readonly recipes: RecipeRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	// Recipes, imports, the store, and the folders are where a draft's images are checked.
	constructor(
		drafts: SavedDraftRepository,
		imports: RecipeImportRepository,
		recipes: RecipeRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.drafts = drafts;
		this.imports = imports;
		this.recipes = recipes;
		this.images = images;
		this.actors = actors;
		this.folders = folders;
	}

	// Null for a draft that is not the member's or has expired. Ids arrive from URLs, so a malformed id
	// names no draft.
	async getDraft(id: string): Promise<SavedDraftDto | null> {
		const actor = requireMember(await this.actors.currentActor());
		const now = new Date();
		const parsed = savedDraftIdSchema.safeParse(id);
		const draft = parsed.success ? await this.drafts.findById(parsed.data) : null;
		return this.isOwnDraft(draft, actor.memberId, now)
			? this.toSavedDraftDto(draft, actor.memberId, now)
			: null;
	}

	// The member's draft that continues the import, for its review to open; null as getDraft is.
	async getImportDraft(importId: string): Promise<SavedDraftDto | null> {
		const actor = requireMember(await this.actors.currentActor());
		const now = new Date();
		const parsed = recipeImportIdSchema.safeParse(importId);
		const draft = parsed.success ? await this.drafts.findByImportId(parsed.data) : null;
		return this.isOwnDraft(draft, actor.memberId, now)
			? this.toSavedDraftDto(draft, actor.memberId, now)
			: null;
	}

	// Saves whatever the form holds, with nothing required: over the member's draft the form opened or
	// last saved, over an import's one draft for its review, or else as a new draft, as when the draft
	// was deleted elsewhere. A save over a draft must name the version the form has of it, so one
	// another page saved since, or an import's draft another page saved first, is never replaced: that
	// save is a conflict, which the form reports. An import's review saves only while the import is the
	// member's and can still be saved, as its recipe can, and its draft keeps the import's provenance,
	// so it still credits the import's source once the review is gone. Its images are checked as a
	// recipe's are, so a draft keeps alive only images the member could attach.
	async saveDraft(input: SaveDraftInput): Promise<SavedDraftRef> {
		const actor = requireMember(await this.actors.currentActor());
		const now = new Date();
		const continued =
			input.importId === undefined
				? undefined
				: await this.reviewableImport(input.importId, actor.memberId, now);
		const importId = continued?.importId;
		const found =
			importId === undefined
				? await this.findDraft(input.draftId)
				: await this.drafts.findByImportId(importId);
		const existing = this.isOwnDraft(found, actor.memberId, now) ? found : null;
		// Checked before the images, so a stale copy is not checked against images saved since.
		const version = editVersionSchema.safeParse(input.draftVersion);
		if (
			existing !== null &&
			(!version.success || version.data.getTime() !== existing.updatedAt.getTime())
		) {
			throw this.staleSave(actor.memberId, { draftId: existing.id, importId });
		}

		const problems = await unattachableImageProblems(
			input.imagePathnames,
			existing?.imagePathnames ?? [],
			actor.memberId,
			{
				folders: this.folders,
				images: this.images,
				recipes: this.recipes,
				imports: this.imports,
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
		const saved =
			updated ??
			(await this.drafts.create({ ...contents, memberId: actor.memberId, ...continued }));
		// Refused only for an import another page saved a draft of since this one looked.
		if (saved === null) {
			throw this.staleSave(actor.memberId, { importId });
		}

		logger.info('Draft saved', {
			draftId: saved.id,
			memberId: actor.memberId,
			...(importId !== undefined && { importId }),
		});
		return { id: saved.id, savedAt: saved.updatedAt, expiresAt: savedDraftExpiry(saved.updatedAt) };
	}

	// Deletes the member's draft, and the import's draft it continues, so neither stays in their Drafts.
	// A draft already gone, or another member's, is left as it is.
	async deleteDraft(id: string): Promise<void> {
		const actor = requireMember(await this.actors.currentActor());
		const draft = await this.findDraft(id);
		if (draft?.memberId !== actor.memberId) {
			return;
		}

		await this.drafts.delete(draft.id);
		if (draft.importId !== undefined) {
			await this.clearImportDraft(draft.importId, actor.memberId);
		}
		logger.info('Saved draft deleted', { draftId: draft.id, memberId: actor.memberId });
	}

	// Clears the member's import's draft, with any draft that continues it, as Drafts deletes it. The
	// import's record stays. One already cleared, or another member's, is left as it is.
	async deleteImportDraft(importId: string): Promise<void> {
		const actor = requireMember(await this.actors.currentActor());
		const parsed = recipeImportIdSchema.safeParse(importId);
		if (parsed.success) {
			await this.clearImportDraft(parsed.data, actor.memberId);
		}
	}

	// The member's drafts and their imports' drafts awaiting review, newest first, at most the settings'
	// number. An import a draft continues is listed once, as the draft, which is the newer of the two.
	async listDrafts(): Promise<DraftSummaryDto[]> {
		const actor = requireMember(await this.actors.currentActor());
		const now = new Date();
		const limit = settings.imports.maxUnsavedImports;
		const [saved, unsavedImports] = await Promise.all([
			this.drafts.list(actor.memberId, savedDraftCutoff(now), limit),
			this.imports.listUnsaved(actor.memberId, importDraftCutoff(now), limit),
		]);
		const continued = new Set(saved.flatMap(({ importId }) => importId ?? []));
		const entries = [
			...(await Promise.all(
				saved.map((draft) => this.toSavedDraftSummary(draft, actor.memberId, now))
			)),
			...unsavedImports.filter(({ id }) => !continued.has(id)).map(toImportSummary),
		];
		return entries.toSorted((a, b) => listedAt(b) - listedAt(a)).slice(0, limit);
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

	// The import a draft continues, while it is the member's and its review can still be saved;
	// otherwise the draft opens as a recipe of its own.
	private async continuedImport(
		importId: RecipeImportId | undefined,
		memberId: MemberId,
		now: Date
	): Promise<ContinuedImport | undefined> {
		if (importId === undefined) {
			return undefined;
		}
		const recipeImport = await this.imports.findById(importId);
		const draft = recipeImport?.memberId === memberId ? reviewableDraft(recipeImport, now) : null;
		return draft === null ? undefined : { importId, provenance: draft.provenance };
	}

	// Import ids arrive from forms, so a malformed one names no import. Logged, since the member has to
	// import the recipe again.
	private async reviewableImport(
		importId: string,
		memberId: MemberId,
		now: Date
	): Promise<ContinuedImport> {
		const parsed = recipeImportIdSchema.safeParse(importId);
		const continued = parsed.success
			? await this.continuedImport(parsed.data, memberId, now)
			: undefined;
		if (continued === undefined) {
			logger.warn('Draft save refused for an unavailable import', {
				...(parsed.success && { importId: parsed.data }),
				memberId,
			});
			throw new ImportUnavailableError();
		}
		return continued;
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
			throw error instanceof SavedDraftEditConflictError
				? this.staleSave(memberId, { draftId: id })
				: error;
		}
	}

	// Logged, since the member has to open the draft again and redo their changes.
	private staleSave(
		memberId: MemberId,
		refs: { draftId?: SavedDraftId; importId?: RecipeImportId }
	): SavedDraftEditConflictError {
		logger.warn('Draft save refused as stale', { ...refs, memberId });
		return new SavedDraftEditConflictError();
	}

	private async clearImportDraft(importId: RecipeImportId, memberId: MemberId): Promise<void> {
		const recipeImport = await this.imports.findById(importId);
		if (recipeImport?.memberId !== memberId) {
			return;
		}
		await this.imports.clearDraft(importId);
		await this.drafts.deleteByImportId(importId);
		logger.info('Import draft deleted', { importId, memberId });
	}

	private async toSavedDraftDto(
		draft: SavedDraft,
		memberId: MemberId,
		now: Date
	): Promise<SavedDraftDto> {
		const continued = await this.continuedImport(draft.importId, memberId, now);
		return {
			id: draft.id,
			...(continued !== undefined && { continuesImportId: continued.importId }),
			...importedFrom(draft.provenance),
			values: draft.values,
			savedAt: draft.updatedAt,
			expiresAt: savedDraftExpiry(draft.updatedAt),
		};
	}

	private async toSavedDraftSummary(
		draft: SavedDraftSummary,
		memberId: MemberId,
		now: Date
	): Promise<DraftSummaryDto> {
		const continued = await this.continuedImport(draft.importId, memberId, now);
		const { mode } = importedFrom(draft.provenance);
		return {
			kind: 'saved',
			id: draft.id,
			...(continued !== undefined && { continuesImportId: continued.importId }),
			...(mode !== undefined && { mode }),
			...(draft.title !== undefined && { title: draft.title }),
			savedAt: draft.updatedAt,
			expiresAt: savedDraftExpiry(draft.updatedAt),
		};
	}
}
