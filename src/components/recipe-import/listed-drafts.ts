import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { RecipeFormEntrySubject } from '@/components/recipe-form/recipe-form-autosave';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { settings } from '@/lib/settings';

// What the list of drafts, a draft's page, and the start page's notice call a draft: its title, until
// it has one.
export function draftName(title: string | undefined): string {
	return title ?? 'Untitled recipe';
}

// Where the draft opens: an import's review, which opens the draft that continues it, or the draft's
// own page.
export function listedDraftPath(draft: DraftSummaryDto): string {
	if (draft.kind === 'import') {
		return recipeImportPath(draft.id);
	}
	return draft.continuesImportId === undefined
		? savedDraftPath(draft.id)
		: recipeImportPath(draft.continuesImportId);
}

// The form whose unsaved changes in this browser go with the draft: an import's review, which opens
// the draft that continues it, or the draft's own page.
export function draftFormSubject(draft: DraftSummaryDto): RecipeFormEntrySubject {
	if (draft.kind === 'import') {
		return { kind: 'import', importId: draft.id };
	}
	return draft.continuesImportId === undefined
		? { kind: 'draft', draftId: draft.id }
		: { kind: 'import', importId: draft.continuesImportId };
}

// The imports whose reviews the member's listed drafts open, or undefined where the list may leave
// some out: the list holds at most the settings' number, newest first, so a shorter list holds them
// all.
export function reviewableImportIds(drafts: readonly DraftSummaryDto[]): string[] | undefined {
	if (drafts.length >= settings.imports.maxUnsavedImports) {
		return undefined;
	}
	return drafts
		.map(draftFormSubject)
		.flatMap((subject) => (subject.kind === 'import' ? [subject.importId] : []));
}
