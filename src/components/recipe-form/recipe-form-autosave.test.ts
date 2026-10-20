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
const importId = '6d2b9f4a-8e1c-4b7d-a3f5-1c9e7d2b6a84';
const otherImportId = '6d2b9f4a-8e1c-4b7d-a3f5-1c9e7d2b6a85';
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
			status: 'current',
			entry: { version, writtenAt: writtenAt.toISOString(), form: keptEdit },
		});
	});

	it('reads nothing where nothing was written', () => {
		expect(readAutosavedRecipeForm(undefined, undefined, now)).toBeUndefined();
	});

	it('reads changes made to another version as outdated', () => {
		const outdated = { status: 'outdated', entry: autosavedRecipeForm(keptEdit, version, now) };

		expect(readAutosavedRecipeForm(entry(now, version), 'b', now)).toEqual(outdated);
		expect(readAutosavedRecipeForm(entry(now, version), undefined, now)).toEqual(outdated);
		expect(readAutosavedRecipeForm(entry(now), version, now)?.status).toBe('outdated');
	});

	it('reads nothing once the entry is as old as a saved draft’s lifetime', () => {
		const expired = new Date(now.getTime() - lifetime - 1);
		const kept = new Date(now.getTime() - lifetime + 1000);

		expect(readAutosavedRecipeForm(entry(expired), undefined, now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(expired, version), 'b', now)).toBeUndefined();
		expect(readAutosavedRecipeForm(entry(kept), undefined, now)?.status).toBe('current');
	});

	it.each([
		['text that isn’t JSON', '{"form":'],
		['no time it was written', JSON.stringify({ form: keptEdit })],
		['a form of the shape it had before', JSON.stringify({ ...keptEdit, writtenAt: now })],
		[
			'a form that can’t be read',
			JSON.stringify({
				writtenAt: now.toISOString(),
				form: { ...keptEdit, ingredientSections: { rows: [{ id: 0 }] } },
			}),
		],
	])('discards an entry holding %s', (_name, written) => {
		expect(readAutosavedRecipeForm(written, undefined, now)).toBeUndefined();
	});
});

describe('isStaleRecipeFormEntry', () => {
	const written = (writtenAt: number) =>
		JSON.stringify(autosavedRecipeForm(keptEdit, undefined, new Date(writtenAt)));
	const keyOf = (subject: RecipeFormEntrySubject, member = memberId) =>
		recipeFormAutosaveKey(member, subject);
	const newRecipe = keyOf({ kind: 'new' });
	const importKey = keyOf({ kind: 'import', importId });
	const recipeKey = keyOf({ kind: 'recipe', recipeId });
	const draftKey = keyOf({ kind: 'draft', draftId });
	const pruning = { now, memberId };

	it('finds stale an entry past its lifetime, or one that can’t be read, and nothing else', () => {
		const recent = written(now.getTime() - 1000);

		expect(isStaleRecipeFormEntry(newRecipe, written(now.getTime() - lifetime - 1), pruning)).toBe(
			true
		);
		expect(isStaleRecipeFormEntry(newRecipe, '{"text":', pruning)).toBe(true);
		expect(isStaleRecipeFormEntry(newRecipe, JSON.stringify(keptEdit), pruning)).toBe(true);
		for (const key of [newRecipe, importKey, recipeKey, draftKey]) {
			expect(isStaleRecipeFormEntry(key, recent, pruning)).toBe(false);
		}
	});

	it('finds stale any member’s entry for an import written longer ago than an import’s draft lasts', () => {
		const importLifetime = daysInMilliseconds(settings.imports.importDraftLifetimeDays);
		const closed = written(now.getTime() - importLifetime - 1);
		const open = written(now.getTime() - importLifetime + 1000);

		expect(isStaleRecipeFormEntry(importKey, closed, pruning)).toBe(true);
		expect(
			isStaleRecipeFormEntry(keyOf({ kind: 'import', importId }, otherMemberId), closed, pruning)
		).toBe(true);
		expect(isStaleRecipeFormEntry(importKey, open, pruning)).toBe(false);
		// A saved draft, and a recipe, last longer than an import's review.
		expect(isStaleRecipeFormEntry(draftKey, closed, pruning)).toBe(false);
		expect(isStaleRecipeFormEntry(recipeKey, closed, pruning)).toBe(false);
	});

	it('finds stale the member’s entry for an import or a recipe their page knows is gone, written before it found out', () => {
		const knownAt = new Date(now.getTime() - 60 * 1000);
		const before = written(knownAt.getTime() - 1000);
		const known = {
			now,
			memberId,
			existing: { knownAt, importIds: [otherImportId], recipeIds: [otherRecipeId] },
		};

		expect(isStaleRecipeFormEntry(importKey, before, known)).toBe(true);
		expect(isStaleRecipeFormEntry(recipeKey, before, known)).toBe(true);
		expect(
			isStaleRecipeFormEntry(keyOf({ kind: 'import', importId: otherImportId }), before, known)
		).toBe(false);
		expect(
			isStaleRecipeFormEntry(keyOf({ kind: 'recipe', recipeId: otherRecipeId }), before, known)
		).toBe(false);
		// Written since, as by another tab that opened an import or a recipe the page never knew of.
		expect(isStaleRecipeFormEntry(importKey, written(knownAt.getTime()), known)).toBe(false);
		expect(isStaleRecipeFormEntry(recipeKey, written(knownAt.getTime() + 1000), known)).toBe(false);
		// Another member's, whose imports the page never knew.
		expect(
			isStaleRecipeFormEntry(keyOf({ kind: 'import', importId }, otherMemberId), before, known)
		).toBe(false);
		expect(isStaleRecipeFormEntry(draftKey, before, known)).toBe(false);
		expect(isStaleRecipeFormEntry(newRecipe, before, known)).toBe(false);
	});

	it('keeps an entry of a kind the page doesn’t know every one of, or under a key no form names', () => {
		const knownAt = now;
		const before = written(now.getTime() - 1000);
		const recipesOnly = { now, memberId, existing: { knownAt, recipeIds: [] } };

		expect(isStaleRecipeFormEntry(importKey, before, recipesOnly)).toBe(false);
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
