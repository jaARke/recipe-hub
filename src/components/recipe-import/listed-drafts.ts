import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { RecipeFormEntrySubject } from '@/components/recipe-form/recipe-form-autosave';
import { settings } from '@/lib/settings';

// A draft as the list shows it: as the service listed it, or as the page's form saved it since, by
// the id the form holds.
export type ListedDraft =
	DraftSummaryDto | (Omit<Extract<DraftSummaryDto, { kind: 'saved' }>, 'id'> & { id: string });

// The form whose unsaved changes in this browser go with the draft: an import's review, which opens
// the draft that continues it, or the add page's form.
export function draftFormSubject(draft: ListedDraft): RecipeFormEntrySubject {
	if (draft.kind === 'import') {
		return { kind: 'import', importId: draft.id };
	}
	return draft.continuesImportId === undefined
		? { kind: 'draft', draftId: draft.id }
		: { kind: 'import', importId: draft.continuesImportId };
}

// The imports whose reviews the member's listed drafts open, or undefined where the list may leave
// some out: Drafts lists at most the settings' number, newest first, so a shorter list holds them all.
export function reviewableImportIds(drafts: readonly DraftSummaryDto[]): string[] | undefined {
	if (drafts.length >= settings.imports.maxUnsavedImports) {
		return undefined;
	}
	return drafts
		.map(draftFormSubject)
		.flatMap((subject) => (subject.kind === 'import' ? [subject.importId] : []));
}
