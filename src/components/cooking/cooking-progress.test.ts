import { describe, expect, it } from 'vitest';
import {
	cookingProgressEntry,
	cookingProgressKey,
	isStaleCookingProgress,
	readCookingProgress,
	type CookingProgress,
	type CookingRecipe,
} from '@/components/cooking/cooking-progress';
import { memberBrowserStorageKey } from '@/lib/browser-storage';

const soup: CookingRecipe = {
	id: '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
	version: '2026-10-05T08:30:00.000Z',
};

const cooking: CookingProgress = {
	on: true,
	checked: new Set(['ingredient:0:1', 'ingredient:1:0', 'step:0:0']),
};

const savedAt = new Date('2026-10-15T18:00:00.000Z');

function kept(progress: CookingProgress = cooking): string | undefined {
	return cookingProgressEntry(progress, soup, savedAt);
}

describe('cooking progress', () => {
	it('reads back the mode and the checked rows it kept', () => {
		expect(readCookingProgress(kept(), soup, savedAt)).toEqual(cooking);
	});

	it('keeps progress for 48 hours after its last change, and then reads nothing', () => {
		expect(readCookingProgress(kept(), soup, new Date('2026-10-17T18:00:00.000Z'))).toEqual(
			cooking
		);
		expect(readCookingProgress(kept(), soup, new Date('2026-10-17T18:00:00.001Z'))).toBeUndefined();
	});

	it('finds an entry stale once it expires or when it cannot be read, whatever its version', () => {
		const entry = kept() ?? '';
		expect(isStaleCookingProgress(entry, new Date('2026-10-17T18:00:00.000Z'))).toBe(false);
		expect(isStaleCookingProgress(entry, new Date('2026-10-17T18:00:00.001Z'))).toBe(true);
		expect(isStaleCookingProgress('not json', savedAt)).toBe(true);
		expect(isStaleCookingProgress('{"on":true}', savedAt)).toBe(true);
	});

	it('reads nothing once the recipe has been edited since', () => {
		const edited = { ...soup, version: '2026-10-16T09:00:00.000Z' };

		expect(readCookingProgress(kept(), edited, savedAt)).toBeUndefined();
	});

	it('reads nothing from an entry it cannot read', () => {
		expect(readCookingProgress(undefined, soup, savedAt)).toBeUndefined();
		expect(readCookingProgress('{"on":tru', soup, savedAt)).toBeUndefined();
		expect(
			readCookingProgress(
				JSON.stringify({ version: soup.version, savedAt, on: true, checked: ['line:0:1'] }),
				soup,
				savedAt
			)
		).toBeUndefined();
	});

	it('keeps checked rows with cooking mode off, and nothing once both are cleared', () => {
		const off: CookingProgress = { on: false, checked: new Set(['step:2:3']) };

		expect(readCookingProgress(kept(off), soup, savedAt)).toEqual(off);
		expect(kept({ on: false, checked: new Set() })).toBeUndefined();
	});

	it('keys progress by recipe, outside what signing out removes', () => {
		expect(cookingProgressKey(soup.id)).toBe('cooking:0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
		expect(cookingProgressKey(soup.id).startsWith(memberBrowserStorageKey(''))).toBe(false);
	});
});
