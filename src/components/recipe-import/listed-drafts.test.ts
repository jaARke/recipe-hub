import { describe, expect, it } from 'vitest';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import {
	draftFormSubject,
	draftName,
	listedDraftPath,
	reviewableImportIds,
} from '@/components/recipe-import/listed-drafts';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import { settings } from '@/lib/settings';

const savedId = '0199d2a0-1b2c-7d3e-8f40-000000000004' as SavedDraftId;
const continuingId = '0199d2a0-1b2c-7d3e-8f40-000000000005' as SavedDraftId;
const continuedImportId = '0199d2a0-1b2c-7d3e-8f40-000000000006' as RecipeImportId;
const importId = '0199d2a0-1b2c-7d3e-8f40-000000000003' as RecipeImportId;

const savedAt = new Date('2026-10-15T15:00:00.000Z');
const expiresAt = new Date('2026-11-14T15:00:00.000Z');

// A draft saved by hand, one continuing an import, and an import's draft.
const saved: DraftSummaryDto = { kind: 'saved', id: savedId, savedAt, expiresAt };
const continuing: DraftSummaryDto = {
	kind: 'saved',
	id: continuingId,
	continuesImportId: continuedImportId,
	mode: 'url',
	savedAt,
	expiresAt,
};
const imported: DraftSummaryDto = {
	kind: 'import',
	id: importId,
	mode: 'photo',
	importedAt: savedAt,
	expiresAt,
};

describe('draftName', () => {
	it('names a draft by its title, or as untitled until it has one', () => {
		expect(draftName('Lemon bars')).toBe('Lemon bars');
		expect(draftName(undefined)).toBe('Untitled recipe');
	});
});

describe('listedDraftPath', () => {
	it('opens a draft on its own page, or in the review of the import it continues', () => {
		expect(listedDraftPath(saved)).toBe(`/contribute/drafts/${savedId}`);
		expect(listedDraftPath(continuing)).toBe(`/contribute/imports/${continuedImportId}`);
		expect(listedDraftPath(imported)).toBe(`/contribute/imports/${importId}`);
	});
});

describe('draftFormSubject', () => {
	it('names the form a draft opens in: its import’s review, or the draft’s own page', () => {
		expect(draftFormSubject(saved)).toEqual({ kind: 'draft', draftId: savedId });
		expect(draftFormSubject(continuing)).toEqual({ kind: 'import', importId: continuedImportId });
		expect(draftFormSubject(imported)).toEqual({ kind: 'import', importId });
	});
});

describe('reviewableImportIds', () => {
	it('names the imports whose reviews the listed drafts open', () => {
		expect(reviewableImportIds([saved, continuing, imported])).toEqual([
			continuedImportId,
			importId,
		]);
		expect(reviewableImportIds([saved])).toEqual([]);
		expect(reviewableImportIds([])).toEqual([]);
	});

	it('names none where the list is full, and may leave some out', () => {
		const full = Array.from({ length: settings.imports.maxUnsavedImports }, () => saved);

		expect(reviewableImportIds([imported, ...full.slice(1)])).toBeUndefined();
		expect(reviewableImportIds([imported, ...full.slice(2)])).toEqual([importId]);
	});
});
