import { describe, expect, it } from 'vitest';
import {
	autosavedRecipeForm,
	isStaleRecipeFormEntry,
	readAutosavedRecipeForm,
	recipeFormAutosaveKey,
	recipeFormAutosavePrefix,
	recipeFormAutosaveVersion,
	recipeFormSubject,
	unsavedUploads,
} from '@/components/recipe-form/recipe-form-autosave';
import {
	recipeFormSnapshot,
	type RecipeFormSnapshot,
} from '@/components/recipe-form/recipe-form-snapshot';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const otherMemberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c';
const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const importId = '6d2b9f4a-8e1c-4b7d-a3f5-1c9e7d2b6a84';
const draftId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const version = '2026-10-14T12:00:00.000Z';
const now = new Date('2026-10-15T12:00:00.000Z');
const lifetime = daysInMilliseconds(settings.drafts.savedDraftLifetimeDays);

// Ids: the line 0, the step 1, and the saved dish photo 2.
const lemonBars: RecipeDraftContent = {
	title: 'Lemon bars',
	ingredientSections: [{ lines: [{ text: '1 cup flour' }] }],
	instructionSections: [{ steps: [{ text: 'Bake.' }] }],
	images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
};

// The edited lemon bars as kept: the saved photo, an upload still stored, and one never stored.
const keptEdit: RecipeFormSnapshot = {
	...recipeFormSnapshot(recipeFormValues(lemonBars)),
	photos: {
		dish: [
			{ id: 2, alt: '', pathname: 'dish/development/bars.jpg' },
			{ id: 3, fileName: 'IMG_0002.jpg', alt: '', pathname: 'dish/development/slice.jpg' },
			{ id: 4, fileName: 'IMG_0003.jpg', alt: '' },
		],
		scan: [],
	},
	nextId: 5,
};

describe('recipeFormAutosaveKey', () => {
	it('names one entry for each member and form, kept for whoever is signed in', () => {
		expect(recipeFormAutosaveKey(memberId, { kind: 'new' })).toBe(
			`member:recipe-form:${memberId}:new`
		);
		expect(recipeFormAutosaveKey(memberId, { kind: 'import', importId })).toBe(
			`member:recipe-form:${memberId}:import:${importId}`
		);
		expect(recipeFormAutosaveKey(memberId, { kind: 'draft', draftId })).toBe(
			`member:recipe-form:${memberId}:draft:${draftId}`
		);
		expect(recipeFormAutosaveKey(memberId, { kind: 'recipe', recipeId })).toBe(
			`member:recipe-form:${memberId}:recipe:${recipeId}`
		);
		expect(recipeFormAutosaveKey(otherMemberId, { kind: 'new' })).not.toBe(
			recipeFormAutosaveKey(memberId, { kind: 'new' })
		);
		for (const subject of [{ kind: 'new' } as const, { kind: 'draft', draftId } as const]) {
			expect(recipeFormAutosaveKey(memberId, subject).startsWith(recipeFormAutosavePrefix)).toBe(
				true
			);
		}
	});

	it('names a recipe’s or a draft’s entry without its version', () => {
		const edit = (editVersion: string) =>
			recipeFormSubject({ editing: { id: recipeId, version: editVersion } });
		const saved = (savedAt: string) =>
			recipeFormSubject({ draft: { id: draftId, savedAt: new Date(savedAt) } });

		expect(recipeFormAutosaveKey(memberId, edit('a'))).toBe(
			recipeFormAutosaveKey(memberId, edit('b'))
		);
		expect(recipeFormAutosaveKey(memberId, saved(version))).toBe(
			recipeFormAutosaveKey(memberId, saved(now.toISOString()))
		);
	});

	it('takes the subject from what the form edits, with the version of it the form has', () => {
		const editing = { id: recipeId, version };
		const draft = { id: draftId, savedAt: new Date(version) };

		expect(recipeFormSubject({})).toEqual({ kind: 'new' });
		expect(recipeFormSubject({ draft })).toEqual({ kind: 'draft', draftId, version });
		expect(recipeFormSubject({ importId })).toEqual({ kind: 'import', importId });
		// A saved draft continuing an import is the import's review, at the draft's version.
		expect(recipeFormSubject({ importId, draft })).toEqual({ kind: 'import', importId, version });
		expect(recipeFormSubject({ editing })).toEqual({ kind: 'recipe', recipeId, version });
		expect(recipeFormAutosaveVersion(recipeFormSubject({ editing }))).toBe(version);
		expect(recipeFormAutosaveVersion(recipeFormSubject({ draft }))).toBe(version);
		expect(recipeFormAutosaveVersion(recipeFormSubject({ importId, draft }))).toBe(version);
		expect(recipeFormAutosaveVersion({ kind: 'import', importId })).toBeUndefined();
		expect(recipeFormAutosaveVersion({ kind: 'new' })).toBeUndefined();
	});
});

describe('readAutosavedRecipeForm', () => {
	const entry = (writtenAt: Date, entryVersion?: string) =>
		JSON.stringify(autosavedRecipeForm(keptEdit, entryVersion, writtenAt));

	it('reads back what was written, with when it was written', () => {
		const writtenAt = new Date(now.getTime() - 60 * 1000);

		expect(readAutosavedRecipeForm(entry(writtenAt, version), version, now)).toEqual({
			version,
			writtenAt: writtenAt.toISOString(),
			form: keptEdit,
		});
	});

	it('reads nothing where nothing was written, or where an entry is about another version', () => {
		expect(readAutosavedRecipeForm(undefined, undefined, now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(now, version), 'b', now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(now, version), undefined, now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(now), version, now)).toBeUndefined();
	});

	it('reads nothing once the entry is as old as a saved draft’s lifetime', () => {
		const expired = new Date(now.getTime() - lifetime - 1);
		const kept = new Date(now.getTime() - lifetime + 1000);

		expect(readAutosavedRecipeForm(entry(expired), undefined, now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(kept), undefined, now)).toBeDefined();
	});

	it.each([
		['text that isn’t JSON', '{"form":'],
		['no time it was written', JSON.stringify({ form: keptEdit })],
		['a form of the shape it had before', JSON.stringify({ ...keptEdit, writtenAt: now })],
		[
			'a form that can’t be read',
			JSON.stringify({ writtenAt: now.toISOString(), form: { ...keptEdit, tags: [{ id: 0 }] } }),
		],
	])('discards an entry holding %s', (_name, written) => {
		expect(readAutosavedRecipeForm(written, undefined, now)).toBeUndefined();
	});
});

describe('isStaleRecipeFormEntry', () => {
	it('finds stale an entry past its lifetime, or one that can’t be read, and nothing else', () => {
		const written = (writtenAt: Date) =>
			JSON.stringify(autosavedRecipeForm(keptEdit, undefined, writtenAt));

		expect(isStaleRecipeFormEntry(written(new Date(now.getTime() - lifetime - 1)), now)).toBe(true);
		expect(isStaleRecipeFormEntry('{"text":', now)).toBe(true);
		expect(isStaleRecipeFormEntry(JSON.stringify(keptEdit), now)).toBe(true);
		expect(isStaleRecipeFormEntry(written(new Date(now.getTime() - 1000)), now)).toBe(false);
	});
});

describe('unsavedUploads', () => {
	it('looks up only the uploads the form didn’t load with, by the photos that show them', () => {
		expect(unsavedUploads(keptEdit, recipeFormValues(lemonBars))).toEqual([
			{ photoId: 3, pathname: 'dish/development/slice.jpg' },
		]);
	});
});
