import { describe, expect, it } from 'vitest';
import {
	readRecipeFormSnapshot,
	recipeFormSnapshot,
	recipeFormSnapshotFromForm,
	recipeFormSnapshotImages,
	recipeFormSnapshotTitle,
	restoredRecipeForm,
	savedDraftSnapshot,
	showSameRecipeForm,
	type RecipeFormSnapshot,
} from '@/components/recipe-form/recipe-form-snapshot';
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

// The size a new photo is drawn at, and the sizes lemon bars' photos were stored with.
const drawnSize = { width: 2400, height: 1600 };
const barsSize = { width: 2400, height: 1800 };
const sliceSize = { width: 1800, height: 2400 };

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
};

// A new recipe's form starts with ingredient line 0 and step 1, so a heading added takes 2 and three
// photos take 3 to 5: one uploaded and described, one still uploading, and one that failed. A chapter
// and a diet are chosen, and a save's error on the title shows too.
function halfFilledNewRecipe(): RecipeFormValues {
	return edited(
		recipeFormValues(),
		{ type: 'setText', field: 'title', text: 'Lemon bars' },
		{ type: 'setRowText', list: 'ingredientSections', rowId: 0, text: '1 cup flour' },
		{ type: 'addRow', list: 'ingredientSections', kind: 'heading' },
		{ type: 'setRowText', list: 'ingredientSections', rowId: 2, text: 'For the glaze' },
		{ type: 'setChapter', chapter: 'desserts' },
		{ type: 'setDiet', diet: 'vegan', chosen: true },
		{
			type: 'addPhotos',
			role: 'dish',
			fileNames: ['IMG_0001.jpg', 'IMG_0002.jpg', 'IMG_0003.jpg'],
		},
		{
			type: 'startPhotoUpload',
			photoId: 3,
			pathname: 'dish/development/a.jpg',
			size: drawnSize,
			file: photoFile,
		},
		{ type: 'finishPhotoUpload', photoId: 3 },
		{ type: 'setPhotoAlt', photoId: 3, alt: 'Bars on a plate' },
		{
			type: 'startPhotoUpload',
			photoId: 4,
			pathname: 'dish/development/b.jpg',
			size: drawnSize,
			file: photoFile,
		},
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
	images: [{ role: 'dish', pathname: 'dish/development/bars.jpg', size: barsSize }],
};

// What an edit of lemon bars kept: the saved photo, an upload still stored, one the sweep removed,
// and one that never finished, with a note left open on the line and one resolved on the step. The
// saved photo and the removed one were kept before sizes were recorded.
const keptEdit: RecipeFormSnapshot = {
	text: { ...blankText, title: 'Lemon squares' },
	yieldKind: 'makes',
	ingredientSections: {
		rows: [
			{ kind: 'heading', id: 7, text: 'For the crust' },
			{ kind: 'item', id: 0, text: '1 cup flour' },
		],
	},
	instructionSections: { rows: [{ kind: 'item', id: 1, text: 'Bake 20 minutes.' }] },
	chapter: 'desserts',
	holidays: ['christmas'],
	diets: ['vegan'],
	photos: {
		dish: [
			{ id: 2, alt: 'Bars on a plate', pathname: 'dish/development/bars.jpg' },
			{
				id: 3,
				fileName: 'IMG_0002.jpg',
				alt: 'A slice',
				pathname: 'dish/development/slice.jpg',
				size: sliceSize,
			},
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

describe('recipeFormSnapshot', () => {
	it('keeps what was typed and chosen, each list as rows, without errors or files', () => {
		expect(recipeFormSnapshot(halfFilledNewRecipe())).toEqual({
			text: { ...blankText, title: 'Lemon bars' },
			yieldKind: 'servings',
			ingredientSections: {
				rows: [
					{ kind: 'item', id: 0, text: '1 cup flour' },
					{ kind: 'heading', id: 2, text: 'For the glaze' },
				],
			},
			instructionSections: { rows: [{ kind: 'item', id: 1, text: '' }] },
			chapter: 'desserts',
			holidays: [],
			diets: ['vegan'],
			photos: {
				// Only a stored photo keeps its pathname and size.
				dish: [
					{
						id: 3,
						fileName: 'IMG_0001.jpg',
						alt: 'Bars on a plate',
						pathname: 'dish/development/a.jpg',
						size: drawnSize,
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

	it('keeps each review note’s state', () => {
		const values = edited(
			recipeFormValues(lemonBars, [
				{ path: 'title', message: 'Check the title.' },
				{ path: 'ingredientSections.0.lines.0', message: 'Check this line.' },
			]),
			{ type: 'resolveReviewNote', target: { kind: 'field', field: 'title' } }
		);

		expect(recipeFormSnapshot(values).reviewNotes).toEqual([
			['field:title', { message: 'Check the title.', status: 'resolved' }],
			['row:0', { message: 'Check this line.', status: 'open' }],
		]);
	});

	it('keeps in a saved draft only the photos that were stored, which this browser alone holds', () => {
		expect(savedDraftSnapshot(halfFilledNewRecipe()).photos).toEqual({
			dish: [
				{
					id: 3,
					fileName: 'IMG_0001.jpg',
					alt: 'Bars on a plate',
					pathname: 'dish/development/a.jpg',
					size: drawnSize,
				},
			],
			scan: [],
		});
	});

	it('names a draft by its title and the images it keeps, dish photos then scans', () => {
		const snapshot: RecipeFormSnapshot = {
			...keptEdit,
			photos: {
				dish: keptEdit.photos.dish,
				scan: [{ id: 9, alt: '', pathname: 'scan/development/card.jpg' }],
			},
		};

		expect(recipeFormSnapshotTitle(snapshot)).toBe('Lemon squares');
		expect(
			recipeFormSnapshotTitle({ ...snapshot, text: { ...blankText, title: '  ' } })
		).toBeUndefined();
		expect(recipeFormSnapshotImages(snapshot)).toEqual([
			'dish/development/bars.jpg',
			'dish/development/slice.jpg',
			'dish/development/swept.jpg',
			'scan/development/card.jpg',
		]);
	});
});

describe('showSameRecipeForm', () => {
	const loaded = recipeFormValues(lemonBars);
	const same = (values: RecipeFormValues, other: RecipeFormValues = loaded) =>
		showSameRecipeForm(recipeFormSnapshot(values), recipeFormSnapshot(other));

	it('finds a form showing what it loaded with, though rows came and went and ids moved on', () => {
		// The audit's reproduction: a blank line added, the first line removed, which leaves the form
		// looking as it loaded.
		const newRecipe = recipeFormValues();
		const blankRowSwapped = edited(
			newRecipe,
			{ type: 'addRow', list: 'ingredientSections', kind: 'item', afterRowId: 0 },
			{ type: 'removeRow', list: 'ingredientSections', rowId: 0 }
		);
		const addedAndRemoved = edited(
			loaded,
			{ type: 'addRow', list: 'ingredientSections', kind: 'item', afterRowId: 0 },
			{ type: 'removeRow', list: 'ingredientSections', rowId: 3 }
		);
		const blankHeadingAdded = edited(loaded, {
			type: 'addRow',
			list: 'instructionSections',
			kind: 'heading',
		});

		expect(blankRowSwapped.ingredientSections.rows.map(({ id }) => id)).toEqual([2]);
		expect(same(blankRowSwapped, newRecipe)).toBe(true);
		expect(addedAndRemoved.nextId).toBe(4);
		expect(same(addedAndRemoved)).toBe(true);
		expect(same(blankHeadingAdded)).toBe(true);
	});

	it('finds a form the same though a photo was kept before sizes were recorded', () => {
		const unsized = recipeFormValues({
			...lemonBars,
			images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
		});

		expect(same(unsized)).toBe(true);
	});

	it('finds a form the same though its text differs only at its ends, or a hidden unit changed', () => {
		const spaced = edited(
			loaded,
			{ type: 'setText', field: 'title', text: ' Lemon bars ' },
			{ type: 'setRowText', list: 'ingredientSections', rowId: 0, text: '1 cup flour ' }
		);
		const hiddenUnit = edited(loaded, { type: 'setText', field: 'yieldUnit', text: 'bars' });

		expect(same(spaced)).toBe(true);
		expect(same(hiddenUnit)).toBe(true);
	});

	it('finds a form changed by any edit the member sees', () => {
		const changes: RecipeFormEdit[][] = [
			[{ type: 'setText', field: 'title', text: 'Lemon squares' }],
			[{ type: 'setRowKind', list: 'ingredientSections', rowId: 0, kind: 'heading' }],
			[{ type: 'setPhotoAlt', photoId: 2, alt: 'Bars on a plate' }],
			[{ type: 'setYieldKind', kind: 'makes' }],
			[{ type: 'setChapter', chapter: 'desserts' }],
			[{ type: 'setHoliday', holiday: 'easter', chosen: true }],
			[{ type: 'setDiet', diet: 'gluten-free', chosen: true }],
			[{ type: 'removePhoto', photoId: 2 }],
			[
				{ type: 'addRow', list: 'ingredientSections', kind: 'item' },
				{ type: 'setRowText', list: 'ingredientSections', rowId: 3, text: '2 eggs' },
				{ type: 'moveRow', list: 'ingredientSections', rowId: 3, toIndex: 0 },
			],
		];

		for (const change of changes) {
			expect(same(edited(loaded, ...change))).toBe(false);
		}
	});

	it('finds a form changed by a note resolved, and the same though a removed row’s note stays', () => {
		const withNotes = recipeFormValues(lemonBars, [
			{ path: 'title', message: 'Check the title.' },
			{ path: 'instructionSections.0.steps.0', message: 'Check this step.' },
		]);
		const resolved = edited(withNotes, {
			type: 'resolveReviewNote',
			target: { kind: 'field', field: 'title' },
		});
		const stepCleared = edited(
			withNotes,
			{ type: 'addRow', list: 'instructionSections', kind: 'item' },
			{ type: 'setRowText', list: 'instructionSections', rowId: 3, text: 'Bake.' },
			{ type: 'removeRow', list: 'instructionSections', rowId: 1 }
		);

		expect(same(resolved, withNotes)).toBe(false);
		// The step reads as it did, but its note went with the row it was on.
		expect(same(stepCleared, withNotes)).toBe(false);
		expect(same(withNotes, withNotes)).toBe(true);
	});
});

describe('reading a snapshot', () => {
	it('reads back what was kept, from a draft or a posted form', () => {
		expect(readRecipeFormSnapshot(keptEdit)).toEqual(keptEdit);
		expect(recipeFormSnapshotFromForm(JSON.stringify(keptEdit))).toEqual(keptEdit);
	});

	it('reads a snapshot kept before the form offered choices as one with nothing chosen', () => {
		const unchanged = {
			yieldKind: keptEdit.yieldKind,
			ingredientSections: keptEdit.ingredientSections,
			instructionSections: keptEdit.instructionSections,
			photos: keptEdit.photos,
			reviewNotes: keptEdit.reviewNotes,
			nextId: keptEdit.nextId,
		};
		// The kept edit as the form kept it then, with tags, which reading drops.
		const earlier = {
			...unchanged,
			text: { ...keptEdit.text, tagDraft: 'Dess' },
			tags: [{ id: 8, label: 'Dessert' }],
		};
		const read = { ...unchanged, text: keptEdit.text, holidays: [], diets: [] };

		expect(readRecipeFormSnapshot(JSON.parse(JSON.stringify(earlier)))).toEqual(read);
		expect(recipeFormSnapshotFromForm(JSON.stringify(earlier))).toEqual(read);
		expect(restoredRecipeForm(read, recipeFormValues(lemonBars))).toMatchObject({
			chapter: undefined,
			holidays: [],
			diets: [],
		});
	});

	it('reads back each stored photo’s size, and photos kept before sizes were recorded', () => {
		const kept = recipeFormSnapshot(halfFilledNewRecipe());

		expect(readRecipeFormSnapshot(JSON.parse(JSON.stringify(kept)))?.photos.dish[0]).toEqual({
			id: 3,
			fileName: 'IMG_0001.jpg',
			alt: 'Bars on a plate',
			pathname: 'dish/development/a.jpg',
			size: drawnSize,
		});
		expect(readRecipeFormSnapshot(keptEdit)?.photos.dish[0]).toStrictEqual({
			id: 2,
			alt: 'Bars on a plate',
			pathname: 'dish/development/bars.jpg',
		});
	});

	it.each([
		['a list as sections rather than rows', { ingredientSections: { sections: [] } }],
		[
			'a row of no known kind',
			{ ingredientSections: { rows: [{ kind: 'section', id: 0, text: 'x' }] } },
		],
		['a missing text field', { text: { title: 'Lemon squares' } }],
		['a chapter the cookbook has no', { chapter: 'soups' }],
		['a holiday the cookbook has no', { holidays: ['groundhog-day'] }],
		['a diet the cookbook has no', { diets: ['keto'] }],
		[
			'a fractional id',
			{ instructionSections: { rows: [{ kind: 'item', id: 1.5, text: 'Bake 20 minutes.' }] } },
		],
		[
			'two things with one id',
			{ instructionSections: { rows: [{ kind: 'item', id: 0, text: 'Bake 20 minutes.' }] } },
		],
		[
			'a note on no place the form has',
			{ reviewNotes: [['field:color', { message: 'Check.', status: 'open' }]] },
		],
		[
			'a note in no known state',
			{ reviewNotes: [['form', { message: 'Check.', status: 'done' }]] },
		],
		[
			'a photo size that is no size',
			{
				photos: {
					dish: [{ id: 2, alt: '', pathname: 'dish/development/bars.jpg', size: { width: 0 } }],
					scan: [],
				},
			},
		],
	])('reads nothing from a snapshot holding %s', (_name, change) => {
		const snapshot = { ...keptEdit, ...change };

		expect(readRecipeFormSnapshot(snapshot)).toBeUndefined();
		expect(() => recipeFormSnapshotFromForm(JSON.stringify(snapshot))).toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [
					{ path: '', message: 'We couldn’t read the draft. Reload the page and try again.' },
				],
			})
		);
	});

	it('refuses a posted draft’s photo too large to write, at the photo, though it reads from a kept one', () => {
		const tooLarge = { width: 100000, height: 100000 };
		const posted: RecipeFormSnapshot = {
			...keptEdit,
			photos: {
				// The unsized bars photo, the slice, the swept upload, and one never stored, then a scan.
				dish: [
					...keptEdit.photos.dish.slice(0, 2),
					{ ...keptEdit.photos.dish[2]!, size: tooLarge },
					keptEdit.photos.dish[3]!,
				],
				scan: [{ id: 6, alt: '', pathname: 'scan/development/card.jpg', size: tooLarge }],
			},
		};

		expect(readRecipeFormSnapshot(posted)).toEqual(posted);
		expect(() => recipeFormSnapshotFromForm(JSON.stringify(posted))).toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [
					{
						path: 'images.2.size',
						message: 'This photo is too large. Remove it and add it again.',
					},
					{
						path: 'images.3.size',
						message: 'This photo is too large. Remove it and add it again.',
					},
				],
			})
		);
	});

	it('refuses a posted draft giving a size to a photo never stored, which names no image', () => {
		const posted: RecipeFormSnapshot = {
			...keptEdit,
			photos: {
				dish: [{ id: 2, alt: '', size: { width: 100000, height: 100000 } }],
				scan: [],
			},
		};

		expect(() => recipeFormSnapshotFromForm(JSON.stringify(posted))).toThrow(
			expect.objectContaining({
				problems: [
					{ path: '', message: 'We couldn’t read the draft. Reload the page and try again.' },
				],
			})
		);
	});

	it('refuses a posted form that isn’t JSON', () => {
		expect(() => recipeFormSnapshotFromForm('{"text":')).toThrow(
			expect.objectContaining({ code: 'recipe.invalid' })
		);
	});
});

describe('restoredRecipeForm', () => {
	const initial = recipeFormValues(lemonBars);

	it('takes back what was kept, with no errors', () => {
		const restored = restoredRecipeForm(keptEdit, initial);

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
		expect(restored).toMatchObject({
			chapter: 'desserts',
			holidays: ['christmas'],
			diets: ['vegan'],
		});
		expect(restored.fieldErrors).toEqual({});
		expect(restored.formError).toBeUndefined();
	});

	it('keeps a loaded photo saved, shows each stored upload from storage, and one never stored as not uploaded', () => {
		expect(restoredRecipeForm(keptEdit, initial).photos).toEqual({
			dish: [
				// Kept before sizes were recorded, so it takes the size the form loaded it with.
				{
					id: 2,
					alt: 'Bars on a plate',
					upload: { status: 'saved', pathname: 'dish/development/bars.jpg', size: barsSize },
				},
				{
					id: 3,
					fileName: 'IMG_0002.jpg',
					alt: 'A slice',
					upload: { status: 'uploaded', pathname: 'dish/development/slice.jpg', size: sliceSize },
				},
				{
					id: 4,
					fileName: 'IMG_0003.jpg',
					alt: '',
					upload: { status: 'uploaded', pathname: 'dish/development/swept.jpg' },
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

	it('saves the rest without the photos never stored or found gone, and waits for nothing', () => {
		const restored = editRecipeForm(restoredRecipeForm(keptEdit, initial), {
			type: 'failMissingUpload',
			photoId: 4,
		});

		expect(hasPhotosInProgress(restored)).toBe(false);
		expect(recipeFormSubmission(restored).payload.images).toEqual([
			{
				role: 'dish',
				pathname: 'dish/development/bars.jpg',
				size: barsSize,
				alt: 'Bars on a plate',
			},
			{ role: 'dish', pathname: 'dish/development/slice.jpg', size: sliceSize, alt: 'A slice' },
		]);
	});

	it('brings each note back in the state it was in, on its place', () => {
		expect(recipeFormChecks(restoredRecipeForm(keptEdit, initial))).toEqual([
			{
				target: { kind: 'row', list: 'ingredientSections', index: 1, id: 0 },
				note: 'Check this line.',
				markers: [],
				confirmable: true,
			},
		]);
	});

	it('goes on with ids above every restored one, even past the kept next id', () => {
		const restored = restoredRecipeForm({ ...keptEdit, nextId: 4 }, initial);

		expect(restored.nextId).toBe(8);
		const added = editRecipeForm(restored, {
			type: 'addRow',
			list: 'instructionSections',
			kind: 'item',
		});
		expect(added.instructionSections.rows.at(-1)?.id).toBe(8);
	});

	it('keeps the kept next id where it is above every id', () => {
		expect(restoredRecipeForm({ ...keptEdit, nextId: 12 }, initial).nextId).toBe(12);
	});
});
