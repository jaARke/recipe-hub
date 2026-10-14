import { describe, expect, it } from 'vitest';
import {
	autosavedRecipeForm,
	isAsLoaded,
	readAutosavedRecipeForm,
	recipeFormAutosaveKey,
	recipeFormAutosaveVersion,
	recipeFormSubject,
	restoredRecipeForm,
	unsavedUploadPathnames,
	type AutosavedRecipeForm,
} from '@/components/recipe-form/recipe-form-autosave';
import {
	editRecipeForm,
	hasPhotosInProgress,
	recipeFormChecks,
	recipeFormSubmission,
	recipeFormValues,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';

function edited(values: RecipeFormValues, ...edits: RecipeFormEdit[]): RecipeFormValues {
	return edits.reduce(editRecipeForm, values);
}

const photoFile = new File(['jpeg'], 'IMG_0001.jpg', { type: 'image/jpeg' });

const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const importId = '6d2b9f4a-8e1c-4b7d-a3f5-1c9e7d2b6a84';

const blankText = {
	title: '',
	description: '',
	source: '',
	notes: '',
	prepMinutes: '',
	cookMinutes: '',
	totalMinutes: '',
	yieldAmount: '',
	yieldUnit: '',
	tagDraft: '',
};

// A new recipe's form starts with ingredient line 0 and step 1, so a heading added takes 2 and three
// photos take 3 to 5: one uploaded and described, one still uploading, and one that failed. A save's
// error on the title shows too.
function halfFilledNewRecipe(): RecipeFormValues {
	return edited(
		recipeFormValues(),
		{ type: 'setText', field: 'title', text: 'Lemon bars' },
		{ type: 'setRowText', list: 'ingredientSections', rowId: 0, text: '1 cup flour' },
		{ type: 'addRow', list: 'ingredientSections', kind: 'heading' },
		{ type: 'setRowText', list: 'ingredientSections', rowId: 2, text: 'For the glaze' },
		{ type: 'setText', field: 'tagDraft', text: 'Dess' },
		{
			type: 'addPhotos',
			role: 'dish',
			fileNames: ['IMG_0001.jpg', 'IMG_0002.jpg', 'IMG_0003.jpg'],
		},
		{ type: 'startPhotoUpload', photoId: 3, pathname: 'dish/development/a.jpg', file: photoFile },
		{ type: 'finishPhotoUpload', photoId: 3 },
		{ type: 'setPhotoAlt', photoId: 3, alt: 'Bars on a plate' },
		{ type: 'startPhotoUpload', photoId: 4, pathname: 'dish/development/b.jpg', file: photoFile },
		{ type: 'failPhoto', photoId: 5, failure: 'unreadable' },
		{
			type: 'attachErrors',
			fieldErrors: { title: 'Use 120 characters or fewer.' },
			targets: new Map(),
		}
	);
}

// Ids: the line 0, the step 1, and the saved dish photo 2.
const lemonBars: RecipeDraftContent = {
	title: 'Lemon bars',
	ingredientSections: [{ lines: [{ text: '1 cup flour' }] }],
	instructionSections: [{ steps: [{ text: 'Bake.' }] }],
	images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
};

// What an edit of lemon bars stored: the saved photo, an upload still stored, one the sweep removed,
// and one that never finished, with a note left open on the line and one resolved on the step.
const storedEdit: AutosavedRecipeForm = {
	version: '2026-10-14T12:00:00.000Z',
	text: { ...blankText, title: 'Lemon squares' },
	yieldKind: 'makes',
	ingredientSections: {
		rows: [
			{ kind: 'heading', id: 7, text: 'For the crust' },
			{ kind: 'item', id: 0, text: '1 cup flour' },
		],
	},
	instructionSections: { rows: [{ kind: 'item', id: 1, text: 'Bake 20 minutes.' }] },
	tags: [{ id: 8, label: 'Dessert' }],
	photos: {
		dish: [
			{ id: 2, alt: 'Bars on a plate', pathname: 'dish/development/bars.jpg' },
			{ id: 3, fileName: 'IMG_0002.jpg', alt: 'A slice', pathname: 'dish/development/slice.jpg' },
			{ id: 4, fileName: 'IMG_0003.jpg', alt: '', pathname: 'dish/development/swept.jpg' },
			{ id: 5, fileName: 'IMG_0004.jpg', alt: '' },
		],
		scan: [],
	},
	reviewNotes: [
		['row:0', { message: 'Check this line.', status: 'open' }],
		['row:1', { message: 'Check this step.', status: 'resolved' }],
	],
	nextId: 9,
};

describe('recipeFormAutosaveKey', () => {
	it('names one entry for a new recipe, one for each import, and one for each recipe', () => {
		expect(recipeFormAutosaveKey({ kind: 'new' })).toBe('member:recipe-form:new');
		expect(recipeFormAutosaveKey({ kind: 'import', importId })).toBe(
			`member:recipe-form:import:${importId}`
		);
		expect(recipeFormAutosaveKey({ kind: 'recipe', recipeId, version: 'a' })).toBe(
			`member:recipe-form:recipe:${recipeId}`
		);
		expect(recipeFormAutosaveKey({ kind: 'recipe', recipeId, version: 'b' })).toBe(
			`member:recipe-form:recipe:${recipeId}`
		);
	});

	it('takes the subject from what the form edits, and an edit’s version with it', () => {
		const editing = { id: recipeId, version: '2026-10-14T12:00:00.000Z' };

		expect(recipeFormSubject({})).toEqual({ kind: 'new' });
		expect(recipeFormSubject({ importId })).toEqual({ kind: 'import', importId });
		expect(recipeFormSubject({ editing })).toEqual({
			kind: 'recipe',
			recipeId,
			version: '2026-10-14T12:00:00.000Z',
		});
		expect(recipeFormAutosaveVersion(recipeFormSubject({ editing }))).toBe(
			'2026-10-14T12:00:00.000Z'
		);
		expect(recipeFormAutosaveVersion({ kind: 'new' })).toBeUndefined();
		expect(recipeFormAutosaveVersion({ kind: 'import', importId })).toBeUndefined();
	});
});

describe('autosavedRecipeForm', () => {
	it('keeps what was typed and chosen, each list as rows, without errors or files', () => {
		expect(autosavedRecipeForm(halfFilledNewRecipe(), undefined)).toEqual({
			text: { ...blankText, title: 'Lemon bars', tagDraft: 'Dess' },
			yieldKind: 'servings',
			ingredientSections: {
				rows: [
					{ kind: 'item', id: 0, text: '1 cup flour' },
					{ kind: 'heading', id: 2, text: 'For the glaze' },
				],
			},
			instructionSections: { rows: [{ kind: 'item', id: 1, text: '' }] },
			tags: [],
			photos: {
				// Only a stored photo keeps its pathname.
				dish: [
					{
						id: 3,
						fileName: 'IMG_0001.jpg',
						alt: 'Bars on a plate',
						pathname: 'dish/development/a.jpg',
					},
					{ id: 4, fileName: 'IMG_0002.jpg', alt: '' },
					{ id: 5, fileName: 'IMG_0003.jpg', alt: '' },
				],
				scan: [],
			},
			reviewNotes: [],
			nextId: 6,
		});
	});

	it('keeps each review note’s state, and the version an edit loaded', () => {
		const values = edited(
			recipeFormValues(lemonBars, [
				{ path: 'title', message: 'Check the title.' },
				{ path: 'ingredientSections.0.lines.0', message: 'Check this line.' },
			]),
			{ type: 'resolveReviewNote', target: { kind: 'field', field: 'title' } }
		);

		const stored = autosavedRecipeForm(values, '2026-10-14T12:00:00.000Z');

		expect(stored.version).toBe('2026-10-14T12:00:00.000Z');
		expect(stored.reviewNotes).toEqual([
			['field:title', { message: 'Check the title.', status: 'resolved' }],
			['row:0', { message: 'Check this line.', status: 'open' }],
		]);
	});
});

describe('isAsLoaded', () => {
	const loaded = recipeFormValues(lemonBars);
	const entryOf = (values: RecipeFormValues) => autosavedRecipeForm(values, 'a');

	it('finds a form as it loaded though a row added and removed again took an id', () => {
		const addedAndRemoved = edited(
			loaded,
			{ type: 'addRow', list: 'ingredientSections', kind: 'item', afterRowId: 0 },
			{ type: 'removeRow', list: 'ingredientSections', rowId: 3 }
		);

		expect(addedAndRemoved.nextId).toBe(4);
		expect(isAsLoaded(entryOf(addedAndRemoved), entryOf(loaded))).toBe(true);
	});

	it('finds a form changed by any edit to what it holds', () => {
		const changes: RecipeFormEdit[] = [
			{ type: 'setText', field: 'title', text: 'Lemon squares' },
			{ type: 'setRowKind', list: 'ingredientSections', rowId: 0, kind: 'heading' },
			{ type: 'setPhotoAlt', photoId: 2, alt: 'Bars on a plate' },
			{ type: 'setYieldKind', kind: 'makes' },
		];

		for (const change of changes) {
			expect(isAsLoaded(entryOf(edited(loaded, change)), entryOf(loaded))).toBe(false);
		}
	});
});

describe('readAutosavedRecipeForm', () => {
	it('reads back what was stored', () => {
		expect(readAutosavedRecipeForm(JSON.stringify(storedEdit), storedEdit.version)).toEqual(
			storedEdit
		);
	});

	it('reads nothing where nothing was stored, or where an edit’s entry is about another version', () => {
		expect(readAutosavedRecipeForm(undefined, undefined)).toBeUndefined();
		expect(
			readAutosavedRecipeForm(JSON.stringify(storedEdit), '2026-10-15T09:30:00.000Z')
		).toBeUndefined();
		expect(readAutosavedRecipeForm(JSON.stringify(storedEdit), undefined)).toBeUndefined();
		expect(
			readAutosavedRecipeForm(JSON.stringify({ ...storedEdit, version: undefined }), 'a')
		).toBeUndefined();
	});

	it.each([
		['text that isn’t JSON', '{"text":'],
		['a list as sections rather than rows', { ingredientSections: { sections: [] } }],
		[
			'a row of no known kind',
			{ ingredientSections: { rows: [{ kind: 'section', id: 0, text: 'x' }] } },
		],
		['a missing text field', { text: { title: 'Lemon squares' } }],
		['a fractional id', { tags: [{ id: 8.5, label: 'Dessert' }] }],
		['two things with one id', { tags: [{ id: 0, label: 'Dessert' }] }],
		[
			'a note on no place the form has',
			{ reviewNotes: [['field:color', { message: 'Check.', status: 'open' }]] },
		],
		[
			'a note in no known state',
			{ reviewNotes: [['form', { message: 'Check.', status: 'done' }]] },
		],
	])('discards an entry holding %s', (_name, change) => {
		const entry =
			typeof change === 'string' ? change : JSON.stringify({ ...storedEdit, ...change });

		expect(readAutosavedRecipeForm(entry, storedEdit.version)).toBeUndefined();
	});
});

describe('restoredRecipeForm', () => {
	const initial = recipeFormValues(lemonBars);

	it('looks up only the uploads the form didn’t load with', () => {
		expect(unsavedUploadPathnames(storedEdit, initial)).toEqual([
			'dish/development/slice.jpg',
			'dish/development/swept.jpg',
		]);
	});

	it('takes back what was stored, with no errors', () => {
		const restored = restoredRecipeForm(storedEdit, initial, new Set());

		expect(restored.text).toEqual({ ...blankText, title: 'Lemon squares' });
		expect(restored.yieldKind).toBe('makes');
		expect(restored.ingredientSections).toEqual({
			rows: [
				{ kind: 'heading', id: 7, text: 'For the crust' },
				{ kind: 'item', id: 0, text: '1 cup flour' },
			],
		});
		expect(restored.instructionSections).toEqual({
			rows: [{ kind: 'item', id: 1, text: 'Bake 20 minutes.' }],
		});
		expect(restored.tags).toEqual([{ id: 8, label: 'Dessert' }]);
		expect(restored.fieldErrors).toEqual({});
		expect(restored.formError).toBeUndefined();
	});

	it('keeps a loaded photo saved, shows a stored upload from storage, and a missing one as not uploaded', () => {
		const restored = restoredRecipeForm(
			storedEdit,
			initial,
			new Set(['dish/development/swept.jpg'])
		);

		expect(restored.photos).toEqual({
			dish: [
				{
					id: 2,
					alt: 'Bars on a plate',
					upload: { status: 'saved', pathname: 'dish/development/bars.jpg' },
				},
				{
					id: 3,
					fileName: 'IMG_0002.jpg',
					alt: 'A slice',
					upload: { status: 'uploaded', pathname: 'dish/development/slice.jpg' },
				},
				{
					id: 4,
					fileName: 'IMG_0003.jpg',
					alt: '',
					upload: { status: 'failed', failure: 'upload' },
				},
				{
					id: 5,
					fileName: 'IMG_0004.jpg',
					alt: '',
					upload: { status: 'failed', failure: 'upload' },
				},
			],
			scan: [],
		});
	});

	it('saves the rest without the missing photos, and waits for nothing', () => {
		const restored = restoredRecipeForm(
			storedEdit,
			initial,
			new Set(['dish/development/swept.jpg'])
		);

		expect(hasPhotosInProgress(restored)).toBe(false);
		expect(recipeFormSubmission(restored).payload.images).toEqual([
			{ role: 'dish', pathname: 'dish/development/bars.jpg', alt: 'Bars on a plate' },
			{ role: 'dish', pathname: 'dish/development/slice.jpg', alt: 'A slice' },
		]);
	});

	it('brings each note back in the state it was in, on its place', () => {
		const restored = restoredRecipeForm(storedEdit, initial, new Set());

		expect(recipeFormChecks(restored)).toEqual([
			{
				target: { kind: 'row', list: 'ingredientSections', index: 1, id: 0 },
				note: 'Check this line.',
				markers: [],
				confirmable: true,
			},
		]);
	});

	it('goes on with ids above every restored one, even past the stored next id', () => {
		const restored = restoredRecipeForm({ ...storedEdit, nextId: 4 }, initial, new Set());

		expect(restored.nextId).toBe(9);
		const added = editRecipeForm(restored, {
			type: 'addRow',
			list: 'instructionSections',
			kind: 'item',
		});
		expect(added.instructionSections.rows.at(-1)?.id).toBe(9);
	});

	it('keeps the stored next id where it is above every id', () => {
		expect(restoredRecipeForm({ ...storedEdit, nextId: 12 }, initial, new Set()).nextId).toBe(12);
	});
});
