import { describe, expect, it } from 'vitest';
import {
	keptDraftPath,
	movedRecipeEntryHref,
	parseKeptDraftParam,
	savedDraftPath,
} from '@/components/recipe-import/recipe-entry-paths';

const draftId = '0199d2a0-1b2c-7d3e-8f40-000000000004';

describe('savedDraftPath and keptDraftPath', () => {
	it('name a draft’s own page, and the start page saying the draft is kept', () => {
		expect(savedDraftPath(draftId)).toBe(`/contribute/drafts/${draftId}`);
		expect(keptDraftPath(draftId)).toBe(`/contribute?kept=${draftId}`);
	});
});

describe('parseKeptDraftParam', () => {
	it('reads one draft, and none from a missing or repeated parameter', () => {
		expect(parseKeptDraftParam(draftId)).toBe(draftId);
		expect(parseKeptDraftParam(undefined)).toBeUndefined();
		expect(parseKeptDraftParam([draftId, draftId])).toBeUndefined();
	});
});

describe('movedRecipeEntryHref', () => {
	it('leads a saved draft opened in the start page’s form to its own page, whatever the tab', () => {
		expect(movedRecipeEntryHref({ draft: draftId })).toBe(`/contribute/drafts/${draftId}`);
		expect(movedRecipeEntryHref({ draft: draftId, tab: 'url' })).toBe(
			`/contribute/drafts/${draftId}`
		);
	});

	it('leads each tab to the page of its way in, and Drafts to the start page', () => {
		expect(movedRecipeEntryHref({ tab: 'manual' })).toBe('/contribute/new');
		expect(movedRecipeEntryHref({ tab: 'url' })).toBe('/contribute/link');
		expect(movedRecipeEntryHref({ tab: 'photo' })).toBe('/contribute/photos');
		expect(movedRecipeEntryHref({ tab: 'drafts' })).toBe('/contribute');
	});

	it('leads a tab or a draft it can’t read to the start page, without the parameter', () => {
		expect(movedRecipeEntryHref({ tab: 'toString' })).toBe('/contribute');
		expect(movedRecipeEntryHref({ tab: ['url', 'photo'] })).toBe('/contribute');
		expect(movedRecipeEntryHref({ draft: [draftId, draftId] })).toBe('/contribute');
	});

	it('leaves the start page’s own addresses where they are', () => {
		expect(movedRecipeEntryHref({})).toBeUndefined();
		expect(movedRecipeEntryHref({ kept: draftId })).toBeUndefined();
	});
});
