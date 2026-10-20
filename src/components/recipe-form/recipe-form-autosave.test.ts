import { describe, expect, it } from 'vitest';
import {
	autosavedRecipeForm,
	isStaleRecipeFormEntry,
	readAutosavedRecipeForm,
	recipeFormAutosaveKey,
	recipeFormAutosavePrefix,
	recipeFormSubject,
	unsavedUploads,
	type RecipeFormEntrySubject,
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
const otherRecipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c11';
const draftId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const version = '2026-10-14T12:00:00.000Z';
const now = new Date('2026-10-15T12:00:00.000Z');
const lifetime = daysInMilliseconds(settings.drafts.draftLifetimeDays);

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
	it('names one entry for each member and recipe, kept for whoever is signed in', () => {
		const key = recipeFormAutosaveKey(memberId, { kind: 'recipe', recipeId });

		expect(key).toBe(`member:recipe-form:${memberId}:recipe:${recipeId}`);
		expect(key.startsWith(recipeFormAutosavePrefix)).toBe(true);
		expect(recipeFormAutosaveKey(otherMemberId, { kind: 'recipe', recipeId })).not.toBe(key);
	});

	it('names a recipe’s entry without its version', () => {
		const edit = (editVersion: string) => recipeFormSubject({ id: recipeId, version: editVersion });

		expect(recipeFormAutosaveKey(memberId, edit('a'))).toBe(
			recipeFormAutosaveKey(memberId, edit('b'))
		);
	});

	it('takes the subject from the recipe the form edits, with the version the form loaded', () => {
		expect(recipeFormSubject({ id: recipeId, version })).toEqual({
			kind: 'recipe',
			recipeId,
			version,
		});
	});
});

describe('readAutosavedRecipeForm', () => {
	const entry = (writtenAt: Date, entryVersion: string = version) =>
		JSON.stringify(autosavedRecipeForm(keptEdit, entryVersion, writtenAt));

	it('reads back what was written, with when it was written', () => {
		const writtenAt = new Date(now.getTime() - 60 * 1000);

		expect(readAutosavedRecipeForm(entry(writtenAt, version), version, now)).toEqual({
			status: 'current',
			entry: { version, writtenAt: writtenAt.toISOString(), form: keptEdit },
		});
	});

	it('reads nothing where nothing was written', () => {
		expect(readAutosavedRecipeForm(undefined, version, now)).toBeUndefined();
	});

	it('reads changes made to another version as outdated', () => {
		expect(readAutosavedRecipeForm(entry(now, version), 'b', now)).toEqual({
			status: 'outdated',
			entry: autosavedRecipeForm(keptEdit, version, now),
		});
	});

	it('reads nothing once the entry is as old as a saved draft’s lifetime', () => {
		const expired = new Date(now.getTime() - lifetime - 1);
		const kept = new Date(now.getTime() - lifetime + 1000);

		expect(readAutosavedRecipeForm(entry(expired), version, now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(expired), 'b', now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(kept), version, now)?.status).toBe('current');
	});

	it.each([
		['text that isn’t JSON', '{"form":'],
		['no time it was written', JSON.stringify({ version, form: keptEdit })],
		['no version', JSON.stringify({ writtenAt: now.toISOString(), form: keptEdit })],
		['a form of the shape it had before', JSON.stringify({ ...keptEdit, version, writtenAt: now })],
		[
			'a form that can’t be read',
			JSON.stringify({
				version,
				writtenAt: now.toISOString(),
				form: { ...keptEdit, ingredientSections: { rows: [{ id: 0 }] } },
			}),
		],
	])('discards an entry holding %s', (_name, written) => {
		expect(readAutosavedRecipeForm(written, version, now)).toBeUndefined();
	});
});

describe('isStaleRecipeFormEntry', () => {
	const written = (writtenAt: number) =>
		JSON.stringify(autosavedRecipeForm(keptEdit, version, new Date(writtenAt)));
	const keyOf = (subject: RecipeFormEntrySubject, member = memberId) =>
		recipeFormAutosaveKey(member, subject);
	const recipeKey = keyOf({ kind: 'recipe', recipeId });
	// A key no form makes, as another kind of form would name.
	const otherKindKey = `${recipeFormAutosavePrefix}${memberId}:draft:${draftId}`;
	const pruning = { now, memberId };

	it('finds stale an entry past its lifetime, or one that can’t be read, and nothing else', () => {
		const recent = written(now.getTime() - 1000);

		expect(isStaleRecipeFormEntry(recipeKey, written(now.getTime() - lifetime - 1), pruning)).toBe(
			true
		);
		expect(isStaleRecipeFormEntry(recipeKey, '{"text":', pruning)).toBe(true);
		expect(isStaleRecipeFormEntry(recipeKey, JSON.stringify(keptEdit), pruning)).toBe(true);
		for (const key of [recipeKey, otherKindKey]) {
			expect(isStaleRecipeFormEntry(key, recent, pruning)).toBe(false);
		}
	});

	it('finds stale the member’s entry for a recipe their page knows is gone, written before it found out', () => {
		const knownAt = new Date(now.getTime() - 60 * 1000);
		const before = written(knownAt.getTime() - 1000);
		const known = { now, memberId, existing: { knownAt, recipeIds: [otherRecipeId] } };

		expect(isStaleRecipeFormEntry(recipeKey, before, known)).toBe(true);
		expect(
			isStaleRecipeFormEntry(keyOf({ kind: 'recipe', recipeId: otherRecipeId }), before, known)
		).toBe(false);
		// Written since, as by another tab that opened a recipe the page never knew of.
		expect(isStaleRecipeFormEntry(recipeKey, written(knownAt.getTime()), known)).toBe(false);
		// Another member's, which only their own pages prune.
		expect(
			isStaleRecipeFormEntry(keyOf({ kind: 'recipe', recipeId }, otherMemberId), before, known)
		).toBe(false);
		expect(isStaleRecipeFormEntry(otherKindKey, before, known)).toBe(false);
	});

	it('keeps an entry under a key no form names', () => {
		const knownAt = now;
		const before = written(now.getTime() - 1000);
		const recipesOnly = { now, memberId, existing: { knownAt, recipeIds: [] } };

		expect(isStaleRecipeFormEntry(otherKindKey, before, recipesOnly)).toBe(false);
		expect(isStaleRecipeFormEntry(recipeKey, before, recipesOnly)).toBe(true);
		expect(isStaleRecipeFormEntry(`${recipeKey}:extra`, before, recipesOnly)).toBe(false);
		expect(
			isStaleRecipeFormEntry(`${recipeFormAutosavePrefix}recipe:${recipeId}`, before, recipesOnly)
		).toBe(false);
	});
});

describe('unsavedUploads', () => {
	it('looks up only the uploads the form didn’t load with, by the photos that show them', () => {
		expect(unsavedUploads(keptEdit, recipeFormValues(lemonBars))).toEqual([
			{ photoId: 3, pathname: 'dish/development/slice.jpg' },
		]);
	});
});
