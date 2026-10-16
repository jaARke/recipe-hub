import { describe, expect, it } from 'vitest';
import { settings } from '@/lib/settings';
import { settingsSchema } from '@/lib/settings-schema';

// Where the schema refuses an input, as dotted paths.
function refusedPaths(input: unknown): string[] {
	const result = settingsSchema.safeParse(input);
	return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('settingsSchema', () => {
	it('accepts the settings as they are', () => {
		expect(refusedPaths(settings)).toEqual([]);
	});

	it("refuses an import that reads more scans than a recipe keeps, on the import's limit", () => {
		const photos = { ...settings.photos, maxScansPerImport: 4, maxScansPerRecipe: 3 };

		expect(refusedPaths({ ...settings, photos })).toEqual(['photos.maxScansPerImport']);
	});

	it('refuses more scans in one import than one model request holds', () => {
		const photos = { ...settings.photos, maxScansPerImport: 7, maxScansPerRecipe: 12 };

		expect(refusedPaths({ ...settings, photos })).toEqual(['photos.maxScansPerImport']);
	});

	it("refuses deleting removed images before Neon's 35-day snapshots expire", () => {
		const retention = { ...settings.retention, removedImageLifetimeDays: 35 };

		expect(refusedPaths({ ...settings, retention })).toEqual([
			'retention.removedImageLifetimeDays',
		]);
	});

	it("refuses a model call that leaves no time in the import's limit after the page fetch", () => {
		const ai = { ...settings.ai, extractionTimeoutMs: 100_001 };

		expect(refusedPaths({ ...settings, ai })).toEqual(['ai.extractionTimeoutMs']);
	});

	it('refuses a sign-in code that works for more than two hours', () => {
		const accounts = { ...settings.accounts, signInCodeLifetimeMinutes: 121 };

		expect(refusedPaths({ ...settings, accounts })).toEqual(['accounts.signInCodeLifetimeMinutes']);
	});

	it('refuses a session that ends before Better Auth renews it', () => {
		const accounts = { ...settings.accounts, sessionLifetimeDays: 1 };

		expect(refusedPaths({ ...settings, accounts })).toEqual(['accounts.sessionLifetimeDays']);
	});

	it('refuses more favorites on a device than its cookie holds', () => {
		const favorites = { ...settings.favorites, maxPerDevice: 101 };

		expect(refusedPaths({ ...settings, favorites })).toEqual(['favorites.maxPerDevice']);
	});

	it('refuses more recipes on a page than one listing query returns', () => {
		const display = { ...settings.display, recipesPerPage: 101 };

		expect(refusedPaths({ ...settings, display })).toEqual(['display.recipesPerPage']);
	});

	it('refuses a tag long enough that its search key could outgrow its index', () => {
		const recipeLimits = { ...settings.recipeLimits, maxTagLength: 501 };

		expect(refusedPaths({ ...settings, recipeLimits })).toEqual(['recipeLimits.maxTagLength']);
	});

	it('refuses an unknown time zone and a model id without its provider', () => {
		const display = { ...settings.display, timeZone: 'Eastern' };
		const ai = { ...settings.ai, pageModelId: 'claude-sonnet-5.5' };

		expect(refusedPaths({ ...settings, display, ai })).toEqual([
			'ai.pageModelId',
			'display.timeZone',
		]);
	});
});
