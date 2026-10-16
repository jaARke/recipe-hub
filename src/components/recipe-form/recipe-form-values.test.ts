import { describe, expect, it } from 'vitest';
import { fieldErrorsFrom } from '@/components/forms/field-errors';
import type { FieldErrors } from '@/components/forms/form-state';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	editRecipeForm,
	hasPhotosInProgress,
	recipeFormChecks,
	recipeFormProblems,
	recipeFormRequiredErrors,
	recipeFormSubmission,
	recipeFormValues,
	tagLabelsFrom,
	tagLabelsToAdd,
	type RecipeFormEdit,
	type RecipeFormListName,
	type RecipeFormRowText,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { importDraftFromExtractedRecipe } from '@/domain/recipe/extracted-recipe';
import { parseAmountText, parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import { settings } from '@/lib/settings';

function edited(values: RecipeFormValues, ...edits: RecipeFormEdit[]): RecipeFormValues {
	return edits.reduce(editRecipeForm, values);
}

// Each row of the list as its kind, id, and text, leaving out its errors.
function rowsOf(values: RecipeFormValues, list: RecipeFormListName) {
	return values[list].rows.map(({ kind, id, text }) => ({ kind, id, text }));
}

const photoFile = new File(['jpeg'], 'IMG_0001.jpg', { type: 'image/jpeg' });

// The sizes the recipe's photos were stored with, and the size a new photo is drawn at.
const cardSize = { width: 3072, height: 1843 };
const barsSize = { width: 2400, height: 1800 };
const sliceSize = { width: 1800, height: 2400 };
const drawnSize = { width: 2400, height: 1600 };

// Ids follow the order the form builds things in: the ingredients' headings and lines (0 to 4), the
// steps, whose section has no heading and so no row (5 and 6), tags (7 and 8), then images in the
// recipe's order (9 to 11).
const lemonBars = parseRecipeContent({
	title: 'Lemon bars',
	description: 'Tart and sweet.',
	yield: { kind: 'makes', amount: { min: 16, max: 20 }, unit: 'bars' },
	times: { prepMinutes: 20, cookMinutes: 45 },
	ingredientSections: [
		{
			heading: 'For the crust',
			lines: [parseIngredientLine('1 cup flour'), parseIngredientLine('½ cup butter, softened')],
		},
		{ heading: 'For the filling', lines: [parseIngredientLine('2 eggs')] },
	],
	instructionSections: [
		{ steps: [{ text: 'Press the crust into the pan.' }, { text: 'Bake 20 minutes.' }] },
	],
	tags: ['Dessert', 'Baking'],
	images: [
		{ role: 'scan', pathname: 'scan/production/card.jpg', size: cardSize },
		{
			role: 'dish',
			pathname: 'dish/production/bars.jpg',
			alt: 'Lemon bars on a plate',
			size: barsSize,
		},
		{ role: 'dish', pathname: 'dish/production/slice.jpg', size: sliceSize },
	],
});

function lemonBarsForm(): RecipeFormValues {
	return recipeFormValues(lemonBars);
}

describe('recipeFormValues', () => {
	it('starts empty, with one blank ingredient and one blank step', () => {
		expect(recipeFormValues()).toEqual({
			text: {
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
			},
			yieldKind: 'servings',
			ingredientSections: { rows: [{ kind: 'item', id: 0, text: '' }] },
			instructionSections: { rows: [{ kind: 'item', id: 1, text: '' }] },
			tags: [],
			photos: { dish: [], scan: [] },
			fieldErrors: {},
			reviewNotes: new Map(),
			nextId: 2,
		});
	});

	it('fills every field from a recipe, each heading a row over its lines', () => {
		const values = lemonBarsForm();

		expect(values.text).toMatchObject({
			title: 'Lemon bars',
			description: 'Tart and sweet.',
			prepMinutes: '20',
			cookMinutes: '45',
			totalMinutes: '',
			yieldAmount: '16 to 20',
			yieldUnit: 'bars',
		});
		expect(values.yieldKind).toBe('makes');
		expect(values.ingredientSections).toEqual({
			rows: [
				{ kind: 'heading', id: 0, text: 'For the crust' },
				{ kind: 'item', id: 1, text: '1 cup flour' },
				{ kind: 'item', id: 2, text: '½ cup butter, softened' },
				{ kind: 'heading', id: 3, text: 'For the filling' },
				{ kind: 'item', id: 4, text: '2 eggs' },
			],
		});
		expect(values.instructionSections).toEqual({
			rows: [
				{ kind: 'item', id: 5, text: 'Press the crust into the pan.' },
				{ kind: 'item', id: 6, text: 'Bake 20 minutes.' },
			],
		});
		expect(values.tags).toEqual([
			{ id: 7, label: 'Dessert' },
			{ id: 8, label: 'Baking' },
		]);
		expect(values.photos).toEqual({
			dish: [
				{
					id: 10,
					alt: 'Lemon bars on a plate',
					upload: { status: 'saved', pathname: 'dish/production/bars.jpg', size: barsSize },
				},
				{
					id: 11,
					alt: '',
					upload: { status: 'saved', pathname: 'dish/production/slice.jpg', size: sliceSize },
				},
			],
			scan: [
				{
					id: 9,
					alt: '',
					upload: { status: 'saved', pathname: 'scan/production/card.jpg', size: cardSize },
				},
			],
		});
		expect(values.nextId).toBe(12);
	});

	it('loads two sections without headings as one run of lines', () => {
		const values = recipeFormValues(
			parseRecipeContent({
				...lemonBars,
				instructionSections: [
					{ steps: [{ text: 'Mix.' }] },
					{ steps: [{ text: 'Bake.' }, { text: 'Cool.' }] },
					{ heading: 'To serve', steps: [{ text: 'Dust with sugar.' }] },
					{ steps: [{ text: 'Slice.' }] },
				],
			})
		);

		expect(rowsOf(values, 'instructionSections')).toEqual([
			{ kind: 'item', id: 5, text: 'Mix.' },
			{ kind: 'item', id: 6, text: 'Bake.' },
			{ kind: 'item', id: 7, text: 'Cool.' },
			{ kind: 'heading', id: 8, text: 'To serve' },
			{ kind: 'item', id: 9, text: 'Dust with sugar.' },
			{ kind: 'item', id: 10, text: 'Slice.' },
		]);
		expect(recipeFormSubmission(values).payload.instructionSections).toEqual([
			{ steps: ['Mix.', 'Bake.', 'Cool.'] },
			{ heading: 'To serve', steps: ['Dust with sugar.', 'Slice.'] },
		]);
	});

	it('takes a draft’s problems as notes on the places they name, and none as errors', () => {
		// Ids: the lines (0 and 1), the glaze's heading (2) and line (3), the steps (4 and 5), and the
		// scans (6 and 7).
		const draft: RecipeDraftContent = {
			ingredientSections: [
				{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] },
				{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
			],
			instructionSections: [{ steps: [{ text: 'Mix.' }, { text: 'Bake until golden.' }] }],
			images: [
				{ role: 'scan', pathname: 'scan/production/front.jpg' },
				{ role: 'scan', pathname: 'scan/production/back.jpg' },
			],
		};

		const values = recipeFormValues(draft, [
			{ path: 'title', message: 'Add a title.' },
			{ path: 'ingredientSections.1.lines.0.amount', message: 'Check the amount.' },
			{ path: 'ingredientSections.1.heading', message: 'Check the heading.' },
			{ path: 'ingredientSections.1', message: 'A line of the glaze was too faint to read.' },
			{ path: 'instructionSections.0.steps.1', message: 'Check this step.' },
			{ path: 'images.1.pathname', message: 'Check this page.' },
			{ path: '', message: 'Part of the card was hard to read.' },
		]);

		expect(recipeFormChecks(values)).toEqual([
			{
				target: { kind: 'form' },
				note: 'Part of the card was hard to read.',
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'field', field: 'title' },
				note: 'Add a title.',
				markers: [],
				confirmable: false,
			},
			{
				target: { kind: 'row', list: 'ingredientSections', index: 2, id: 2 },
				note: 'Check the heading.',
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'section', list: 'ingredientSections', index: 2, id: 2 },
				note: 'A line of the glaze was too faint to read.',
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'row', list: 'ingredientSections', index: 3, id: 3 },
				note: 'Check the amount.',
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'row', list: 'instructionSections', index: 1, id: 5 },
				note: 'Check this step.',
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'photo', role: 'scan', index: 1, id: 7 },
				note: 'Check this page.',
				markers: [],
				confirmable: true,
			},
		]);
		// Nothing is marked invalid: the notes are no errors.
		expect(recipeFormProblems(values)).toEqual([]);
		expect(values.fieldErrors).toEqual({});
		expect(values.formError).toBeUndefined();
		expect(values.ingredientSections.rows).toEqual([
			{ kind: 'item', id: 0, text: '1 cup flour' },
			{ kind: 'item', id: 1, text: '2 eggs' },
			{ kind: 'heading', id: 2, text: 'For the glaze' },
			{ kind: 'item', id: 3, text: '1 cup sugar' },
		]);
		expect(values.photos.scan.map((photo) => photo.error)).toEqual([undefined, undefined]);
	});

	it('shows a note on a section without a heading, which has no row, with its list', () => {
		// Ids: the ingredient line (0), then the steps (1 to 3); the second section joins the first.
		const values = recipeFormValues(
			{
				instructionSections: [
					{ steps: [{ text: 'Mix.' }] },
					{ steps: [{ text: 'Bake.' }, { text: 'Cool.' }] },
				],
			},
			[
				{ path: 'instructionSections.0.heading', message: 'Check for a heading.' },
				{ path: 'instructionSections.1', message: 'A step was too faint to read.' },
				{ path: 'instructionSections.1.steps.1', message: 'Check this step.' },
			]
		);

		expect(recipeFormChecks(values).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'list', list: 'instructionSections' },
				note: 'Check for a heading. A step was too faint to read.',
			},
			{
				target: { kind: 'row', list: 'instructionSections', index: 2, id: 3 },
				note: 'Check this step.',
			},
		]);
	});

	it('joins a draft’s distinct problems for one line in order, without repeats', () => {
		const values = recipeFormValues(
			{ ingredientSections: [{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] }] },
			[
				{ path: 'ingredientSections.0.lines.1', message: 'Check this line.' },
				{ path: 'ingredientSections.0.lines.1', message: 'Part of it was hard to read.' },
				{ path: 'ingredientSections.0.lines.1.amount', message: 'Check this line.' },
			]
		);

		expect(recipeFormChecks(values).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'row', list: 'ingredientSections', index: 1, id: 1 },
				note: 'Check this line. Part of it was hard to read.',
			},
		]);
	});

	it('joins a draft’s problem and note that land on one field through its parts', () => {
		const values = recipeFormValues({ title: 'Biscuits' }, [
			{
				path: 'yield.amount',
				message: 'The original says “a dozen or so”. Use a number, or two numbers for a range.',
			},
			{ path: 'yield', message: 'Check the yield against the original.' },
		]);

		expect(recipeFormChecks(values).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'field', field: 'yieldAmount' },
				note: 'The original says “a dozen or so”. Use a number, or two numbers for a range. Check the yield against the original.',
			},
		]);
	});

	it('joins a draft’s notes on the whole recipe', () => {
		const values = recipeFormValues({ title: 'Biscuits' }, [
			{ path: '', message: 'The card holds a second recipe, left out.' },
			{ path: '', message: 'Part of the card was hard to read.' },
		]);

		expect(recipeFormChecks(values).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'form' },
				note: 'The card holds a second recipe, left out. Part of the card was hard to read.',
			},
		]);
	});
});

describe('editRecipeForm', () => {
	it('changes text fields and the yield’s kind', () => {
		const values = edited(
			recipeFormValues(),
			{ type: 'setText', field: 'title', text: 'Lemon bars' },
			{ type: 'setYieldKind', kind: 'makes' }
		);

		expect(values.text.title).toBe('Lemon bars');
		expect(values.yieldKind).toBe('makes');
	});

	it('adds a blank line with the next id at the end, or below a row', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addRow', list: 'ingredientSections', kind: 'item' },
			{ type: 'addRow', list: 'ingredientSections', kind: 'item', afterRowId: 1 }
		);

		expect(rowsOf(values, 'ingredientSections')).toEqual([
			{ kind: 'heading', id: 0, text: 'For the crust' },
			{ kind: 'item', id: 1, text: '1 cup flour' },
			{ kind: 'item', id: 13, text: '' },
			{ kind: 'item', id: 2, text: '½ cup butter, softened' },
			{ kind: 'heading', id: 3, text: 'For the filling' },
			{ kind: 'item', id: 4, text: '2 eggs' },
			{ kind: 'item', id: 12, text: '' },
		]);
		expect(values.nextId).toBe(14);
	});

	it('adds a heading at the end without changing the lines above it', () => {
		const values = edited(lemonBarsForm(), {
			type: 'addRow',
			list: 'ingredientSections',
			kind: 'heading',
		});

		expect(values.ingredientSections.rows.slice(0, 5)).toEqual(
			lemonBarsForm().ingredientSections.rows
		);
		expect(values.ingredientSections.rows[5]).toEqual({ kind: 'heading', id: 12, text: '' });
		// Blank, it sends nothing; named, it starts a section of its own.
		expect(recipeFormSubmission(values).payload.ingredientSections).toEqual(
			recipeFormSubmission(lemonBarsForm()).payload.ingredientSections
		);
		const named = edited(values, {
			type: 'setRowText',
			list: 'ingredientSections',
			rowId: 12,
			text: 'For the glaze',
		});
		expect(recipeFormSubmission(named).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened'] },
			{ heading: 'For the filling', lines: ['2 eggs'] },
			{ heading: 'For the glaze', lines: [] },
		]);
	});

	it('changes and removes a line', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setRowText', list: 'ingredientSections', rowId: 2, text: '½ cup cold butter' },
			{ type: 'removeRow', list: 'ingredientSections', rowId: 1 }
		);

		expect(rowsOf(values, 'ingredientSections').slice(0, 2)).toEqual([
			{ kind: 'heading', id: 0, text: 'For the crust' },
			{ kind: 'item', id: 2, text: '½ cup cold butter' },
		]);
	});

	it('keeps a removed heading’s lines, which join the lines above it', () => {
		const values = edited(lemonBarsForm(), {
			type: 'removeRow',
			list: 'ingredientSections',
			rowId: 3,
		});

		expect(rowsOf(values, 'ingredientSections').map(({ id }) => id)).toEqual([0, 1, 2, 4]);
		expect(recipeFormSubmission(values).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened', '2 eggs'] },
		]);
	});

	it('moves a row up and down, across headings', () => {
		const lineUp = edited(lemonBarsForm(), {
			type: 'moveRow',
			list: 'ingredientSections',
			rowId: 4,
			toIndex: 3,
		});
		expect(rowsOf(lineUp, 'ingredientSections').map(({ id }) => id)).toEqual([0, 1, 2, 4, 3]);
		expect(recipeFormSubmission(lineUp).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened', '2 eggs'] },
			{ heading: 'For the filling', lines: [] },
		]);

		const headingUp = edited(lemonBarsForm(), {
			type: 'moveRow',
			list: 'ingredientSections',
			rowId: 3,
			toIndex: 2,
		});
		expect(recipeFormSubmission(headingUp).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour'] },
			{ heading: 'For the filling', lines: ['½ cup butter, softened', '2 eggs'] },
		]);

		const lineDown = edited(lemonBarsForm(), {
			type: 'moveRow',
			list: 'ingredientSections',
			rowId: 1,
			toIndex: 2,
		});
		expect(rowsOf(lineDown, 'ingredientSections').map(({ id }) => id)).toEqual([0, 2, 1, 3, 4]);
	});

	it('changes a line to a heading and back, keeping its id and note but not its error', () => {
		// Ids: the lines (0 to 2), then the step (3).
		const draft = recipeFormValues(
			{
				ingredientSections: [
					{ lines: [{ text: '1 cup flour' }, { text: 'For the glaze' }, { text: '1 cup sugar' }] },
				],
				instructionSections: [{ steps: [{ text: 'Mix.' }] }],
			},
			[{ path: 'ingredientSections.0.lines.1', message: 'Check this line.' }]
		);
		const failed = editRecipeForm(draft, {
			type: 'attachErrors',
			fieldErrors: { 'ingredientSections.0.lines.1': 'Enter an amount.' },
			targets: recipeFormSubmission(draft).targets,
		});

		const changed = edited(failed, {
			type: 'setRowKind',
			list: 'ingredientSections',
			rowId: 1,
			kind: 'heading',
		});
		expect(changed.ingredientSections.rows).toEqual([
			{ kind: 'item', id: 0, text: '1 cup flour', error: undefined },
			{ kind: 'heading', id: 1, text: 'For the glaze' },
			{ kind: 'item', id: 2, text: '1 cup sugar', error: undefined },
		]);
		expect(recipeFormChecks(changed).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'row', list: 'ingredientSections', index: 1, id: 1 },
				note: 'Check this line.',
			},
		]);
		expect(recipeFormSubmission(changed).payload.ingredientSections).toEqual([
			{ lines: ['1 cup flour'] },
			{ heading: 'For the glaze', lines: ['1 cup sugar'] },
		]);

		const back = edited(changed, {
			type: 'setRowKind',
			list: 'ingredientSections',
			rowId: 1,
			kind: 'item',
		});
		expect(back.ingredientSections.rows[1]).toEqual({
			kind: 'item',
			id: 1,
			text: 'For the glaze',
		});
		expect(
			edited(back, { type: 'setRowKind', list: 'ingredientSections', rowId: 1, kind: 'item' })
		).toEqual(back);
	});

	it('puts a pasted list in place of a blank row, with the next ids', () => {
		const values = edited(recipeFormValues(), {
			type: 'pasteRows',
			list: 'ingredientSections',
			rowId: 0,
			text: '',
			rows: [
				{ kind: 'heading', text: 'For the crust' },
				{ kind: 'item', text: '1 cup flour' },
				{ kind: 'item', text: '2 eggs' },
			],
		});

		expect(rowsOf(values, 'ingredientSections')).toEqual([
			{ kind: 'heading', id: 2, text: 'For the crust' },
			{ kind: 'item', id: 3, text: '1 cup flour' },
			{ kind: 'item', id: 4, text: '2 eggs' },
		]);
		expect(values.nextId).toBe(5);
	});

	it('puts a pasted list below a row with text, which keeps the text around the paste', () => {
		const paste = (text: string): RecipeFormEdit => ({
			type: 'pasteRows',
			list: 'ingredientSections',
			rowId: 1,
			text,
			rows: [
				{ kind: 'item', text: '1 teaspoon salt' },
				{ kind: 'item', text: '1 cup sugar' },
			],
		});

		expect(rowsOf(edited(lemonBarsForm(), paste('1 cup flour')), 'ingredientSections')).toEqual([
			{ kind: 'heading', id: 0, text: 'For the crust' },
			{ kind: 'item', id: 1, text: '1 cup flour' },
			{ kind: 'item', id: 12, text: '1 teaspoon salt' },
			{ kind: 'item', id: 13, text: '1 cup sugar' },
			{ kind: 'item', id: 2, text: '½ cup butter, softened' },
			{ kind: 'heading', id: 3, text: 'For the filling' },
			{ kind: 'item', id: 4, text: '2 eggs' },
		]);
		expect(
			rowsOf(edited(lemonBarsForm(), paste('1 cup ')), 'ingredientSections').slice(1, 3)
		).toEqual([
			{ kind: 'item', id: 1, text: '1 cup ' },
			{ kind: 'item', id: 12, text: '1 teaspoon salt' },
		]);
	});

	it('adds each tag not already chosen, once, and clears the tag field', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setText', field: 'tagDraft', text: 'Summer, Make ahead, dessert, summer' },
			{ type: 'addTags', labels: ['Summer', 'Make ahead', 'dessert', ' SUMMER '] },
			{ type: 'removeTag', tagId: 7 }
		);

		expect(values.tags).toEqual([
			{ id: 8, label: 'Baking' },
			{ id: 12, label: 'Summer' },
			{ id: 13, label: 'Make ahead' },
		]);
		expect(values.text.tagDraft).toBe('');
		expect(values.nextId).toBe(14);
	});

	it('follows a photo from choosing it to its upload', () => {
		const added = edited(lemonBarsForm(), {
			type: 'addPhotos',
			role: 'dish',
			fileNames: ['IMG_0001.HEIC', 'IMG_0002.jpg'],
		});
		expect(added.photos.dish.slice(2)).toEqual([
			{ id: 12, fileName: 'IMG_0001.HEIC', alt: '', upload: { status: 'processing' } },
			{ id: 13, fileName: 'IMG_0002.jpg', alt: '', upload: { status: 'processing' } },
		]);
		expect(added.nextId).toBe(14);
		expect(hasPhotosInProgress(added)).toBe(true);

		const uploading = edited(
			added,
			{
				type: 'startPhotoUpload',
				photoId: 12,
				pathname: 'dish/development/a.jpg',
				size: drawnSize,
				file: photoFile,
			},
			{ type: 'setPhotoProgress', photoId: 12, fraction: 0.5 }
		);
		expect(uploading.photos.dish[2]?.upload).toEqual({
			status: 'uploading',
			pathname: 'dish/development/a.jpg',
			size: drawnSize,
			file: photoFile,
			fraction: 0.5,
		});

		const settled = edited(
			uploading,
			{ type: 'finishPhotoUpload', photoId: 12 },
			{ type: 'failPhoto', photoId: 13, failure: 'unreadable' }
		);
		expect(settled.photos.dish.slice(2).map((photo) => photo.upload)).toEqual([
			{ status: 'uploaded', pathname: 'dish/development/a.jpg', size: drawnSize, file: photoFile },
			{ status: 'failed', failure: 'unreadable' },
		]);
		expect(hasPhotosInProgress(settled)).toBe(false);
	});

	it('ignores a late report about a photo that was removed or never started', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addPhotos', role: 'scan', fileNames: ['card.jpg'] },
			{ type: 'removePhoto', photoId: 12 }
		);

		expect(
			edited(
				values,
				{
					type: 'startPhotoUpload',
					photoId: 12,
					pathname: 'scan/development/a.jpg',
					size: drawnSize,
					file: photoFile,
				},
				{ type: 'setPhotoProgress', photoId: 10, fraction: 0.5 },
				{ type: 'finishPhotoUpload', photoId: 10 },
				{ type: 'failPhoto', photoId: 11, failure: 'upload' }
			)
		).toEqual(values);
	});

	it('makes a dish photo the cover and describes it', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'makeCoverPhoto', photoId: 11 },
			{ type: 'setPhotoAlt', photoId: 11, alt: 'A slice on a fork' }
		);

		expect(values.photos.dish.map((photo) => [photo.id, photo.alt])).toEqual([
			[11, 'A slice on a fork'],
			[10, 'Lemon bars on a plate'],
		]);
	});

	it('moves a page up and down within its own field', () => {
		const added = edited(lemonBarsForm(), {
			type: 'addPhotos',
			role: 'scan',
			fileNames: ['back.jpg', 'notes.jpg'],
		});
		const scanIds = (values: RecipeFormValues) => values.photos.scan.map((photo) => photo.id);

		expect(scanIds(added)).toEqual([9, 12, 13]);
		expect(scanIds(edited(added, { type: 'movePhoto', photoId: 13, toIndex: 1 }))).toEqual([
			9, 13, 12,
		]);
		expect(scanIds(edited(added, { type: 'movePhoto', photoId: 9, toIndex: 1 }))).toEqual([
			12, 9, 13,
		]);
		expect(edited(added, { type: 'movePhoto', photoId: 9, toIndex: 1 }).photos.dish).toBe(
			added.photos.dish
		);
	});

	it('fails an uploaded photo whose upload is found gone, and changes nothing for any other', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addPhotos', role: 'dish', fileNames: ['IMG_0001.jpg', 'IMG_0002.jpg'] },
			{
				type: 'startPhotoUpload',
				photoId: 12,
				pathname: 'dish/development/a.jpg',
				size: drawnSize,
				file: photoFile,
			},
			{ type: 'finishPhotoUpload', photoId: 12 },
			{
				type: 'startPhotoUpload',
				photoId: 13,
				pathname: 'dish/development/b.jpg',
				size: drawnSize,
				file: photoFile,
			}
		);

		expect(
			edited(values, { type: 'failMissingUpload', photoId: 12 }).photos.dish.map(
				(photo) => photo.upload
			)
		).toEqual([
			{ status: 'saved', pathname: 'dish/production/bars.jpg', size: barsSize },
			{ status: 'saved', pathname: 'dish/production/slice.jpg', size: sliceSize },
			{ status: 'failed', failure: 'upload' },
			{
				status: 'uploading',
				pathname: 'dish/development/b.jpg',
				size: drawnSize,
				file: photoFile,
				fraction: 0,
			},
		]);
		// A saved photo, and one still uploading.
		expect(
			edited(
				values,
				{ type: 'failMissingUpload', photoId: 10 },
				{ type: 'failMissingUpload', photoId: 13 }
			)
		).toEqual(values);
		const removed = edited(values, { type: 'removePhoto', photoId: 12 });
		expect(edited(removed, { type: 'failMissingUpload', photoId: 12 })).toEqual(removed);
	});

	it('replaces the whole form, going on from the higher next id so no id is given twice', () => {
		const loaded = recipeFormValues();
		const added = edited(
			loaded,
			{ type: 'setText', field: 'title', text: 'Lemon bars' },
			{ type: 'addRow', list: 'ingredientSections', kind: 'item' },
			{ type: 'addTags', labels: ['Dessert'] }
		);

		const replaced = edited(added, { type: 'replaceForm', values: loaded });

		expect(replaced).toEqual({ ...loaded, nextId: 4 });
		expect(edited(replaced, { type: 'replaceForm', values: lemonBarsForm() }).nextId).toBe(12);
	});
});

describe('recipeFormProblems', () => {
	it('lists each of a save’s errors where the form shows it, in the order it shows them', () => {
		// Ids: the lines (0 and 1), the glaze's heading (2) and line (3), the steps (4 and 5), and the
		// scans (6 and 7).
		const draft: RecipeDraftContent = {
			ingredientSections: [
				{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] },
				{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
			],
			instructionSections: [{ steps: [{ text: 'Mix.' }, { text: 'Bake until golden.' }] }],
			images: [
				{ role: 'scan', pathname: 'scan/production/front.jpg' },
				{ role: 'scan', pathname: 'scan/production/back.jpg' },
			],
		};
		const values = recipeFormValues(draft);

		const failed = editRecipeForm(values, {
			type: 'attachErrors',
			fieldErrors: {
				'images.1': 'Check this page.',
				tags: 'Check the tags.',
				'instructionSections.0.steps.1': 'Check this step.',
				'ingredientSections.1': 'Check this section.',
				'ingredientSections.1.lines.0.amount': 'Check the amount.',
				'ingredientSections.1.heading': 'Check the heading.',
				ingredientSections: 'Check the ingredients.',
				notes: 'Check the notes.',
				'yield.amount': 'Check the yield.',
				description: 'Check the description.',
				source: 'Check the source.',
				title: 'Add a title.',
				'': 'Part of the card was hard to read.',
			},
			targets: recipeFormSubmission(values).targets,
		});

		expect(recipeFormProblems(failed)).toEqual([
			{ message: 'Part of the card was hard to read.', target: { kind: 'form' } },
			{ message: 'Add a title.', target: { kind: 'field', field: 'title' } },
			{ message: 'Check the source.', target: { kind: 'field', field: 'source' } },
			{ message: 'Check the ingredients.', target: { kind: 'list', list: 'ingredientSections' } },
			{
				message: 'Check the heading.',
				target: { kind: 'row', list: 'ingredientSections', index: 2, id: 2 },
			},
			{
				message: 'Check this section.',
				target: { kind: 'section', list: 'ingredientSections', index: 2, id: 2 },
			},
			{
				message: 'Check the amount.',
				target: { kind: 'row', list: 'ingredientSections', index: 3, id: 3 },
			},
			{
				message: 'Check this step.',
				target: { kind: 'row', list: 'instructionSections', index: 1, id: 5 },
			},
			{ message: 'Check the notes.', target: { kind: 'field', field: 'notes' } },
			{ message: 'Check the description.', target: { kind: 'field', field: 'description' } },
			{ message: 'Check the yield.', target: { kind: 'field', field: 'yieldAmount' } },
			{ message: 'Check the tags.', target: { kind: 'field', field: 'tags' } },
			{
				message: 'Check this page.',
				target: { kind: 'photo', role: 'scan', index: 1, id: 7 },
			},
		]);
		expect(recipeFormChecks(failed)).toEqual([]);
	});

	it('lists nothing for a form without problems', () => {
		expect(recipeFormProblems(lemonBarsForm())).toEqual([]);
	});
});

describe('recipeFormRequiredErrors', () => {
	it('names each empty place the recipe needs, keyed as a save’s problems are', () => {
		const values = edited(recipeFormValues({ title: '  ' }), {
			type: 'setRowKind',
			list: 'ingredientSections',
			rowId: 0,
			kind: 'heading',
		});
		const withHeading = edited(values, {
			type: 'setRowText',
			list: 'ingredientSections',
			rowId: 0,
			text: 'For the glaze',
		});

		expect(recipeFormRequiredErrors(withHeading)).toEqual({
			title: 'Enter a title.',
			'ingredientSections.0.lines': 'Add at least one ingredient.',
			instructionSections: 'Add at least one step.',
		});
	});

	it('finds nothing in a recipe with a title, an ingredient, and a step', () => {
		expect(recipeFormRequiredErrors(lemonBarsForm())).toEqual({});
	});

	// What the server answers a save of the form with: the problems the domain finds in what it sends.
	function serverFieldErrors(values: RecipeFormValues): FieldErrors {
		const sent = JSON.stringify(recipeFormSubmission(values).payload);
		try {
			parseRecipeContent(recipeContentFromForm(sent));
		} catch (error) {
			if (error instanceof InvalidRecipeError) {
				return fieldErrorsFrom(error.problems);
			}
			throw error;
		}
		return {};
	}

	it('puts a list of headings alone at each heading’s section, as the server does', () => {
		// The lemon bars' headings without their lines, with a blank heading between them, which the
		// form leaves out of what it sends.
		const headingsAlone = edited(
			lemonBarsForm(),
			...[1, 2, 4].map((rowId): RecipeFormEdit => ({
				type: 'removeRow',
				list: 'ingredientSections',
				rowId,
			})),
			{ type: 'addRow', list: 'ingredientSections', kind: 'heading', afterRowId: 0 }
		);
		const atEachSection = {
			'ingredientSections.0.lines': 'Add at least one ingredient.',
			'ingredientSections.1.lines': 'Add at least one ingredient.',
		};

		expect(recipeFormRequiredErrors(headingsAlone)).toEqual(atEachSection);
		expect(serverFieldErrors(headingsAlone)).toEqual(atEachSection);

		const checked = editRecipeForm(headingsAlone, {
			type: 'attachErrors',
			fieldErrors: recipeFormRequiredErrors(headingsAlone),
			targets: recipeFormSubmission(headingsAlone).targets,
		});
		expect(checked.ingredientSections.error).toBeUndefined();
		expect(recipeFormProblems(checked)).toEqual([
			{
				message: 'Add at least one ingredient.',
				target: { kind: 'section', list: 'ingredientSections', index: 0, id: 0 },
			},
			{
				message: 'Add at least one ingredient.',
				target: { kind: 'section', list: 'ingredientSections', index: 2, id: 3 },
			},
		]);
	});

	it('puts an empty list’s message at the list, as the server does', () => {
		const empty = { ...lemonBarsForm(), instructionSections: { rows: [] } };
		const atList = { instructionSections: 'Add at least one step.' };

		expect(recipeFormRequiredErrors(empty)).toEqual(atList);
		expect(serverFieldErrors(empty)).toEqual(atList);
	});
});

describe('review notes', () => {
	// Ids: the ingredient lines (0 and 1), then the step (2).
	const draft = recipeFormValues(
		{
			ingredientSections: [{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] }],
			instructionSections: [{ steps: [{ text: 'Mix.' }] }],
		},
		[
			{ path: 'title', message: 'Add a title. The original doesn’t show one.' },
			{ path: 'ingredientSections.0.lines.0', message: 'Check this line.' },
			{ path: 'ingredientSections.0.lines.1', message: 'Check this one too.' },
		]
	);

	function openNotes(values: RecipeFormValues): (string | undefined)[] {
		return recipeFormChecks(values).map((check) => check.note);
	}

	it('opens one for each place a draft’s problems name, and none for a recipe', () => {
		expect(openNotes(draft)).toEqual([
			'Add a title. The original doesn’t show one.',
			'Check this line.',
			'Check this one too.',
		]);
		expect(draft.reviewNotes.get('row:0')).toEqual({
			message: 'Check this line.',
			status: 'open',
		});
		expect(lemonBarsForm().reviewNotes.size).toBe(0);
		expect(recipeFormChecks(lemonBarsForm())).toEqual([]);
	});

	it('resolves a note when what it is on is edited', () => {
		const values = edited(
			draft,
			{ type: 'setText', field: 'title', text: 'Lemon bars' },
			{ type: 'setRowText', list: 'ingredientSections', rowId: 1, text: '3 eggs' }
		);

		expect(openNotes(values)).toEqual(['Check this line.']);
		expect(values.reviewNotes.get('field:title')).toEqual({
			message: 'Add a title. The original doesn’t show one.',
			status: 'resolved',
		});
	});

	it('resolves a note that looks right, and no other', () => {
		const values = edited(draft, {
			type: 'resolveReviewNote',
			target: { kind: 'row', id: 0 },
		});

		expect(openNotes(values)).toEqual([
			'Add a title. The original doesn’t show one.',
			'Check this one too.',
		]);
		expect(values.reviewNotes.get('row:0')?.status).toBe('resolved');
		expect(values.text).toBe(draft.text);
	});

	it('offers to look right everywhere but an empty field the recipe needs', () => {
		expect(recipeFormChecks(draft).map(({ confirmable }) => confirmable)).toEqual([
			false,
			true,
			true,
		]);

		const noIngredients = recipeFormValues({ title: 'Biscuits' }, [
			{
				path: 'ingredientSections',
				message: 'Add the ingredients. The original doesn’t show any.',
			},
		]);
		expect(recipeFormChecks(noIngredients)).toEqual([
			{
				target: { kind: 'list', list: 'ingredientSections' },
				note: 'Add the ingredients. The original doesn’t show any.',
				markers: [],
				confirmable: false,
			},
		]);
		// A heading alone is no ingredient.
		const headingOnly = edited(noIngredients, {
			type: 'setRowKind',
			list: 'ingredientSections',
			rowId: 0,
			kind: 'heading',
		});
		expect(recipeFormChecks(headingOnly).map(({ confirmable }) => confirmable)).toEqual([false]);
		// Typing the first ingredient answers the list's note, and so does pasting a list.
		expect(
			recipeFormChecks(
				edited(noIngredients, {
					type: 'setRowText',
					list: 'ingredientSections',
					rowId: 0,
					text: '2 cups flour',
				})
			)
		).toEqual([]);
		expect(
			recipeFormChecks(
				edited(noIngredients, {
					type: 'pasteRows',
					list: 'ingredientSections',
					rowId: 0,
					text: '',
					rows: [
						{ kind: 'item', text: '2 cups flour' },
						{ kind: 'item', text: '1 teaspoon salt' },
					],
				})
			)
		).toEqual([]);
	});

	it('answers notes only where a paste changes text or adds lines', () => {
		// Ids: the glaze's heading (0) and line (1), then the blank step (2).
		const values = recipeFormValues(
			{ ingredientSections: [{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] }] },
			[
				{ path: 'ingredientSections', message: 'Check the ingredients.' },
				{ path: 'ingredientSections.0', message: 'A line of the glaze was too faint to read.' },
				{ path: 'ingredientSections.0.lines.0', message: 'Check this line.' },
			]
		);
		const paste = (text: string, rows: RecipeFormRowText[]): RecipeFormEdit => ({
			type: 'pasteRows',
			list: 'ingredientSections',
			rowId: 1,
			text,
			rows,
		});

		// At the end of the line, with nothing selected: the line is unchanged, but the glaze and the
		// list gain lines.
		expect(
			openNotes(
				edited(
					values,
					paste('1 cup sugar', [
						{ kind: 'item', text: '2 eggs' },
						{ kind: 'item', text: '1 cup flour' },
					])
				)
			)
		).toEqual(['Check this line.']);
		// Headings alone add no lines.
		expect(
			openNotes(
				edited(
					values,
					paste('1 cup sugar', [
						{ kind: 'heading', text: 'For the crust' },
						{ kind: 'heading', text: 'For the filling' },
					])
				)
			)
		).toEqual(openNotes(values));
		// Lines under a pasted heading join its new section, but still the list.
		expect(
			openNotes(
				edited(
					values,
					paste('1 cup sugar', [
						{ kind: 'heading', text: 'To serve' },
						{ kind: 'item', text: 'Whipped cream' },
					])
				)
			)
		).toEqual(['A line of the glaze was too faint to read.', 'Check this line.']);
		// Replacing part of the line changes it, which answers what typing in it would.
		expect(
			openNotes(
				edited(
					values,
					paste('1 cup ', [
						{ kind: 'heading', text: 'For the crust' },
						{ kind: 'heading', text: 'For the filling' },
					])
				)
			)
		).toEqual([]);
	});

	it('moves a section’s open note to where its lines go when its heading becomes a line', () => {
		// Ids: the glaze's heading (0) and line (1), then the blank step (2).
		const values = recipeFormValues(
			{ ingredientSections: [{ heading: 'Glaze', lines: [{ text: '1 cup sugar' }] }] },
			[
				{ path: 'ingredientSections', message: 'Check the ingredients.' },
				{ path: 'ingredientSections.0', message: 'A line of the glaze was too faint to read.' },
			]
		);
		const toLine: RecipeFormEdit = {
			type: 'setRowKind',
			list: 'ingredientSections',
			rowId: 0,
			kind: 'item',
		};

		const changed = edited(values, toLine);
		expect(recipeFormChecks(changed).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'list', list: 'ingredientSections' },
				note: 'Check the ingredients. A line of the glaze was too faint to read.',
			},
		]);
		// Changing it back leaves the note where it went, never hidden and never twice.
		expect(
			openNotes(
				edited(changed, {
					type: 'setRowKind',
					list: 'ingredientSections',
					rowId: 0,
					kind: 'heading',
				})
			)
		).toEqual(['Check the ingredients. A line of the glaze was too faint to read.']);
		// A resolved note is left as it is.
		const checked = edited(
			values,
			{ type: 'resolveReviewNote', target: { kind: 'section', id: 0 } },
			toLine
		);
		expect(openNotes(checked)).toEqual(['Check the ingredients.']);
	});

	it('moves a removed heading’s open section note to the section its lines join', () => {
		// Ids: the crust's heading (0) and line (1), the glaze's heading (2) and line (3), then the
		// blank step (4).
		const values = recipeFormValues(
			{
				ingredientSections: [
					{ heading: 'For the crust', lines: [{ text: '1 cup flour' }] },
					{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
				],
			},
			[{ path: 'ingredientSections.1', message: 'A line of the glaze was too faint to read.' }]
		);

		const removed = edited(values, { type: 'removeRow', list: 'ingredientSections', rowId: 2 });
		expect(recipeFormChecks(removed).map(({ target, note }) => ({ target, note }))).toEqual([
			{
				target: { kind: 'section', list: 'ingredientSections', index: 0, id: 0 },
				note: 'A line of the glaze was too faint to read.',
			},
		]);
		// The glaze's line, now the crust's, answers it.
		expect(
			openNotes(
				edited(removed, {
					type: 'setRowText',
					list: 'ingredientSections',
					rowId: 3,
					text: '1 cup powdered sugar',
				})
			)
		).toEqual([]);
	});

	it('resolves a section’s note when one of its own lines is edited, but not its heading', () => {
		// Ids: the first line (0), then the glaze's heading (1) and line (2).
		const values = recipeFormValues(
			{
				ingredientSections: [
					{ lines: [{ text: '1 cup flour' }] },
					{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
				],
			},
			[
				{ path: 'ingredientSections.1', message: 'A line of the glaze was too faint to read.' },
				{ path: 'ingredientSections.1.heading', message: 'Check the heading.' },
			]
		);

		const otherLine = edited(values, {
			type: 'setRowText',
			list: 'ingredientSections',
			rowId: 0,
			text: '2 cups flour',
		});
		expect(openNotes(otherLine)).toEqual([
			'Check the heading.',
			'A line of the glaze was too faint to read.',
		]);

		const heading = edited(otherLine, {
			type: 'setRowText',
			list: 'ingredientSections',
			rowId: 1,
			text: 'For the icing',
		});
		expect(openNotes(heading)).toEqual(['A line of the glaze was too faint to read.']);

		const ownLine = edited(heading, {
			type: 'setRowText',
			list: 'ingredientSections',
			rowId: 2,
			text: '1 cup powdered sugar',
		});
		expect(openNotes(ownLine)).toEqual([]);
	});

	it('resolves a photo’s note when its description is edited', () => {
		// Ids: the blank ingredient (0) and step (1), then the photo (2).
		const values = recipeFormValues(
			{ images: [{ role: 'dish', pathname: 'dish/production/bars.jpg' }] },
			[{ path: 'images.0', message: 'Check this photo.' }]
		);

		expect(openNotes(values)).toEqual(['Check this photo.']);
		expect(
			openNotes(edited(values, { type: 'setPhotoAlt', photoId: 2, alt: 'Lemon bars on a plate' }))
		).toEqual([]);
	});

	it('follows a row that moves and drops one that is removed', () => {
		// Ids: the blank ingredient (0), then the steps (1 to 3).
		const values = recipeFormValues(
			{
				instructionSections: [{ steps: [{ text: 'Mix.' }, { text: 'Bake.' }, { text: 'Cool.' }] }],
			},
			[
				{ path: 'instructionSections.0.steps.0', message: 'Check this step.' },
				{ path: 'instructionSections.0.steps.2', message: 'Check this one too.' },
			]
		);
		const moved = edited(
			values,
			{ type: 'moveRow', list: 'instructionSections', rowId: 1, toIndex: 1 },
			{ type: 'removeRow', list: 'instructionSections', rowId: 3 }
		);

		expect(recipeFormChecks(moved)).toEqual([
			{
				target: { kind: 'row', list: 'instructionSections', index: 1, id: 1 },
				note: 'Check this step.',
				markers: [],
				confirmable: true,
			},
		]);
	});

	it('keeps the open notes, and the resolved ones, across a failed save', () => {
		const checked = edited(draft, { type: 'resolveReviewNote', target: { kind: 'row', id: 1 } });
		const failed = editRecipeForm(checked, {
			type: 'attachErrors',
			fieldErrors: { title: 'Enter some text.' },
			targets: recipeFormSubmission(checked).targets,
		});

		expect(failed.reviewNotes).toEqual(checked.reviewNotes);
		expect(openNotes(failed)).toEqual([
			'Add a title. The original doesn’t show one.',
			'Check this line.',
		]);
		expect(recipeFormProblems(failed)).toEqual([
			{ message: 'Enter some text.', target: { kind: 'field', field: 'title' } },
		]);

		const refused = editRecipeForm(failed, {
			type: 'attachErrors',
			fieldErrors: {},
			targets: recipeFormSubmission(failed).targets,
		});
		expect(openNotes(refused)).toEqual(openNotes(failed));
	});

	it('flags transcription markers left in text until they are deleted', () => {
		// Ids: the ingredient line (0), then the step (1).
		const values = recipeFormValues(
			{
				title: 'Aunt Edie’s [?] cake',
				ingredientSections: [{ lines: [{ text: '1 cup [Illegible]' }] }],
				instructionSections: [{ steps: [{ text: 'Bake [?] until [illegible].' }] }],
			},
			[{ path: 'instructionSections.0.steps.0', message: 'Part of this step was hard to read.' }]
		);
		const stepTarget = { kind: 'row', list: 'instructionSections', index: 0, id: 1 } as const;

		expect(recipeFormChecks(values)).toEqual([
			{
				target: { kind: 'field', field: 'title' },
				markers: ['unsure'],
				confirmable: false,
			},
			{
				target: { kind: 'row', list: 'ingredientSections', index: 0, id: 0 },
				markers: ['illegible'],
				confirmable: false,
			},
			{
				target: stepTarget,
				note: 'Part of this step was hard to read.',
				markers: ['illegible', 'unsure'],
				confirmable: false,
			},
		]);

		const partlyFixed = edited(values, {
			type: 'setRowText',
			list: 'instructionSections',
			rowId: 1,
			text: 'Bake 25 minutes, until [illegible].',
		});
		expect(recipeFormChecks(partlyFixed)[2]).toEqual({
			target: stepTarget,
			markers: ['illegible'],
			confirmable: false,
		});

		const fixed = edited(
			partlyFixed,
			{ type: 'setText', field: 'title', text: 'Aunt Edie’s cake' },
			{ type: 'setRowText', list: 'ingredientSections', rowId: 0, text: '1 cup flour' },
			{
				type: 'setRowText',
				list: 'instructionSections',
				rowId: 1,
				text: 'Bake 25 minutes, until golden.',
			}
		);
		expect(recipeFormChecks(fixed)).toEqual([]);
	});

	it('flags a marker in a heading', () => {
		const values = recipeFormValues({
			ingredientSections: [{ heading: 'For the [illegible]', lines: [{ text: '1 cup sugar' }] }],
		});

		expect(recipeFormChecks(values)).toEqual([
			{
				target: { kind: 'row', list: 'ingredientSections', index: 0, id: 0 },
				markers: ['illegible'],
				confirmable: false,
			},
		]);
	});

	it('flags a marker in a chosen tag or the tag being typed, whether or not its note is open', () => {
		// Ids: the blank ingredient (0) and step (1), then the tag (2).
		const values = recipeFormValues({ title: 'Biscuits', tags: ['Sweet [?]'] }, [
			{ path: 'tags', message: 'Check the tags against the card.' },
		]);
		const tagsCheck = (markers: string[], note?: string) => ({
			target: { kind: 'field', field: 'tags' },
			...(note === undefined ? {} : { note }),
			markers,
			confirmable: false,
		});

		expect(recipeFormChecks(values)).toEqual([
			tagsCheck(['unsure'], 'Check the tags against the card.'),
		]);
		// Typing another tag answers the note, but the marker stays to check.
		const typing = edited(values, { type: 'setText', field: 'tagDraft', text: 'Baking' });
		expect(typing.reviewNotes.get('field:tags')?.status).toBe('resolved');
		expect(recipeFormChecks(typing)).toEqual([tagsCheck(['unsure'])]);

		const replaced = edited(
			typing,
			{ type: 'removeTag', tagId: 2 },
			{ type: 'setText', field: 'tagDraft', text: 'Baking, [illegible] cakes' }
		);
		expect(recipeFormChecks(replaced)).toEqual([tagsCheck(['illegible'])]);
		expect(
			recipeFormChecks(edited(replaced, { type: 'setText', field: 'tagDraft', text: 'Baking' }))
		).toEqual([]);
	});

	it('flags a marker in a dish photo’s description, which saving stores', () => {
		// Ids: the blank ingredient (0) and step (1), then the photo (2).
		const values = recipeFormValues({
			images: [{ role: 'dish', pathname: 'dish/production/bars.jpg', alt: 'Bars on a [?] plate' }],
		});

		expect(recipeFormChecks(values)).toEqual([
			{
				target: { kind: 'photo', role: 'dish', index: 0, id: 2 },
				markers: ['unsure'],
				confirmable: false,
			},
		]);
	});

	it('checks the unit only while the yield is one the recipe makes', () => {
		const values = recipeFormValues({
			title: 'Biscuits',
			yield: { kind: 'makes', amount: { min: 12 }, unit: 'biscuits [?]' },
		});

		expect(recipeFormChecks(values).map(({ target }) => target)).toEqual([
			{ kind: 'field', field: 'yieldUnit' },
		]);
		expect(recipeFormChecks(edited(values, { type: 'setYieldKind', kind: 'servings' }))).toEqual(
			[]
		);
	});

	it('notes a field an import cut to fit, like the extractor’s own notes', () => {
		const max = settings.recipeLimits.maxTitleLength;
		const { content, problems } = importDraftFromExtractedRecipe(
			{
				title: 'Lemon bars '.repeat(30),
				times: {},
				ingredientSections: [{ lines: ['1 cup flour'] }],
				instructionSections: [{ steps: ['Mix.'] }],
				reviewNotes: [{ field: 'step', section: 0, line: 0, note: 'Check this step.' }],
			},
			[]
		);

		expect(recipeFormChecks(recipeFormValues(content, problems))).toEqual([
			{
				target: { kind: 'field', field: 'title' },
				note: `Check this against the original. It was cut to ${max} characters, the most it can hold.`,
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'row', list: 'instructionSections', index: 0, id: 1 },
				note: 'Check this step.',
				markers: [],
				confirmable: true,
			},
		]);
	});
});

describe('tagLabelsFrom', () => {
	it('splits on commas and drops blanks', () => {
		expect(tagLabelsFrom(' Soup,, Weeknight ,')).toEqual(['Soup', 'Weeknight']);
	});
});

describe('tagLabelsToAdd', () => {
	it('leaves out tags already chosen and repeats, by key', () => {
		const { tags } = lemonBarsForm();

		expect(tagLabelsToAdd(tags, ['BAKING', 'Make ahead', 'make  ahead', 'Soup'])).toEqual([
			'Make ahead',
			'Soup',
		]);
	});
});

describe('recipeFormSubmission', () => {
	it('sends the recipe without blank rows or blank optional text', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setText', field: 'description', text: '   ' },
			{ type: 'setText', field: 'source', text: ' Great-aunt Edie ' },
			{ type: 'setText', field: 'prepMinutes', text: '' },
			{ type: 'setText', field: 'tagDraft', text: 'Summer, Citrus' },
			{ type: 'addRow', list: 'ingredientSections', kind: 'item', afterRowId: 2 },
			{ type: 'addRow', list: 'instructionSections', kind: 'item' },
			{ type: 'setRowText', list: 'instructionSections', rowId: 13, text: ' Cool completely. ' }
		);

		expect(recipeFormSubmission(values).payload).toEqual({
			title: 'Lemon bars',
			source: 'Great-aunt Edie',
			yield: { kind: 'makes', amount: '16 to 20', unit: 'bars' },
			times: { cookMinutes: '45' },
			ingredientSections: [
				{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened'] },
				{ heading: 'For the filling', lines: ['2 eggs'] },
			],
			instructionSections: [
				{
					steps: ['Press the crust into the pan.', 'Bake 20 minutes.', 'Cool completely.'],
				},
			],
			tags: ['Dessert', 'Baking', 'Summer', 'Citrus'],
			images: [
				{
					role: 'dish',
					pathname: 'dish/production/bars.jpg',
					size: barsSize,
					alt: 'Lemon bars on a plate',
				},
				{ role: 'dish', pathname: 'dish/production/slice.jpg', size: sliceSize },
				{ role: 'scan', pathname: 'scan/production/card.jpg', size: cardSize },
			],
		});
	});

	it('leaves out a blank heading, whose lines join the lines above it', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addRow', list: 'ingredientSections', kind: 'heading' },
			{ type: 'addRow', list: 'ingredientSections', kind: 'item', afterRowId: 12 },
			{ type: 'setRowText', list: 'ingredientSections', rowId: 13, text: '1 tablespoon zest' },
			{ type: 'setRowText', list: 'ingredientSections', rowId: 12, text: '  ' }
		);

		expect(recipeFormSubmission(values).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened'] },
			{ heading: 'For the filling', lines: ['2 eggs', '1 tablespoon zest'] },
		]);
	});

	it('sends the lines before the first heading as a section without one', () => {
		const values = edited(recipeFormValues(), {
			type: 'pasteRows',
			list: 'instructionSections',
			rowId: 1,
			text: '',
			rows: [
				{ kind: 'item', text: 'Heat the oven.' },
				{ kind: 'heading', text: 'For the crust' },
				{ kind: 'item', text: 'Press the crust into the pan.' },
				{ kind: 'heading', text: 'For the filling' },
				{ kind: 'item', text: 'Whisk the eggs.' },
				{ kind: 'item', text: 'Pour over the crust.' },
			],
		});

		expect(recipeFormSubmission(values).payload.instructionSections).toEqual([
			{ steps: ['Heat the oven.'] },
			{ heading: 'For the crust', steps: ['Press the crust into the pan.'] },
			{ heading: 'For the filling', steps: ['Whisk the eggs.', 'Pour over the crust.'] },
		]);
	});

	it('round-trips a recipe saved from rows to the same sections', () => {
		const rows = edited(
			recipeFormValues(),
			{ type: 'setText', field: 'title', text: 'Lemon bars' },
			{
				type: 'pasteRows',
				list: 'ingredientSections',
				rowId: 0,
				text: '',
				rows: [
					{ kind: 'item', text: 'Butter for the pan' },
					{ kind: 'heading', text: 'For the crust' },
					{ kind: 'item', text: '1 cup flour' },
					{ kind: 'heading', text: 'For the filling' },
					{ kind: 'item', text: '2 eggs' },
				],
			},
			{ type: 'setRowText', list: 'instructionSections', rowId: 1, text: 'Bake.' }
		);
		const { payload } = recipeFormSubmission(rows);
		const saved = parseRecipeContent({
			...payload,
			times: {},
			ingredientSections: payload.ingredientSections.map(({ heading, lines }) => ({
				heading,
				lines: lines.map(parseIngredientLine),
			})),
			instructionSections: payload.instructionSections.map(({ heading, steps }) => ({
				heading,
				steps: steps.map((text) => ({ text })),
			})),
		});

		expect(
			saved.ingredientSections.map(({ heading, lines }) => ({
				heading,
				lines: lines.map((line) => line.text),
			}))
		).toEqual([
			{ heading: undefined, lines: ['Butter for the pan'] },
			{ heading: 'For the crust', lines: ['1 cup flour'] },
			{ heading: 'For the filling', lines: ['2 eggs'] },
		]);
		const loaded = recipeFormValues(saved);
		expect(recipeFormSubmission(loaded).payload.ingredientSections).toEqual(
			payload.ingredientSections
		);
		expect(recipeFormSubmission(lemonBarsForm()).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened'] },
			{ heading: 'For the filling', lines: ['2 eggs'] },
		]);
	});

	it('sends a serving count without a unit, and no yield without an amount', () => {
		const servings = edited(lemonBarsForm(), { type: 'setYieldKind', kind: 'servings' });
		expect(recipeFormSubmission(servings).payload.yield).toEqual({
			kind: 'servings',
			amount: '16 to 20',
		});

		const noAmount = edited(lemonBarsForm(), { type: 'setText', field: 'yieldAmount', text: ' ' });
		expect(recipeFormSubmission(noAmount).payload.yield).toBeUndefined();
	});

	it('sends only stored photos, each with its size', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addPhotos', role: 'dish', fileNames: ['a.jpg', 'b.jpg', 'c.heic'] },
			{
				type: 'startPhotoUpload',
				photoId: 12,
				pathname: 'dish/development/a.jpg',
				size: drawnSize,
				file: photoFile,
			},
			{ type: 'finishPhotoUpload', photoId: 12 },
			{
				type: 'startPhotoUpload',
				photoId: 13,
				pathname: 'dish/development/b.jpg',
				size: drawnSize,
				file: photoFile,
			},
			{ type: 'failPhoto', photoId: 14, failure: 'unreadable' }
		);

		expect(
			recipeFormSubmission(values).payload.images.map(({ pathname, size }) => ({ pathname, size }))
		).toEqual([
			{ pathname: 'dish/production/bars.jpg', size: barsSize },
			{ pathname: 'dish/production/slice.jpg', size: sliceSize },
			{ pathname: 'dish/development/a.jpg', size: drawnSize },
			{ pathname: 'scan/production/card.jpg', size: cardSize },
		]);
	});

	it('sends a photo stored before sizes were recorded without one, for the save to name', () => {
		const values = recipeFormValues({
			images: [{ role: 'dish', pathname: 'dish/production/bars.jpg' }],
		});

		expect(recipeFormSubmission(values).payload.images).toEqual([
			{ role: 'dish', pathname: 'dish/production/bars.jpg' },
		]);
	});
});

describe('attaching errors', () => {
	// A save's problems name places in what was sent, which leaves out blank rows.
	function failedSave(values: RecipeFormValues, problems: Record<string, string>) {
		const { targets } = recipeFormSubmission(values);
		return editRecipeForm(values, { type: 'attachErrors', fieldErrors: problems, targets });
	}

	// A blank line (12) first under the crust's heading.
	const withBlankLine = edited(lemonBarsForm(), {
		type: 'addRow',
		list: 'ingredientSections',
		kind: 'item',
		afterRowId: 0,
	});

	function rowErrors(values: RecipeFormValues) {
		return values.ingredientSections.rows.map((row) => ({ id: row.id, error: row.error }));
	}

	it('puts a problem with any part of a line on that line, past blank lines', () => {
		const values = failedSave(withBlankLine, {
			'ingredientSections.0.lines.1.amount.max': 'Make the end of the range larger than the start.',
		});

		expect(rowErrors(values)).toEqual([
			{ id: 0, error: undefined },
			{ id: 12, error: undefined },
			{ id: 1, error: undefined },
			{ id: 2, error: 'Make the end of the range larger than the start.' },
			{ id: 3, error: undefined },
			{ id: 4, error: undefined },
		]);
	});

	it('keeps the first of a save’s problems for one line', () => {
		const values = failedSave(lemonBarsForm(), {
			'ingredientSections.0.lines.0.amount.max': 'Make the end of the range larger than the start.',
			'ingredientSections.0.lines.0.item': 'Enter some text.',
		});

		expect(values.ingredientSections.rows[1]?.error).toBe(
			'Make the end of the range larger than the start.'
		);
	});

	it('keeps an error with its row as the row moves, and drops it when the row goes', () => {
		const values = failedSave(withBlankLine, {
			'ingredientSections.0.lines.0.item': 'Enter some text.',
		});
		const moved = edited(values, {
			type: 'moveRow',
			list: 'ingredientSections',
			rowId: 1,
			toIndex: 4,
		});

		expect(moved.ingredientSections.rows[4]).toEqual({
			kind: 'item',
			id: 1,
			text: '1 cup flour',
			error: 'Enter some text.',
		});

		const removed = edited(moved, { type: 'removeRow', list: 'ingredientSections', rowId: 1 });
		expect(rowErrors(removed).map(({ error }) => error)).toEqual([
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
		]);
	});

	it('puts a problem with a heading, and one with the lines under it, on the heading’s row', () => {
		const values = edited(lemonBarsForm(), {
			type: 'removeRow',
			list: 'ingredientSections',
			rowId: 4,
		});

		const failed = failedSave(values, {
			'ingredientSections.1.lines': 'Add at least one ingredient.',
			'ingredientSections.1.heading': 'Enter some text.',
			instructionSections: 'Add at least one step.',
		});

		expect(failed.ingredientSections.rows[3]).toEqual({
			kind: 'heading',
			id: 3,
			text: 'For the filling',
			error: 'Enter some text.',
			sectionError: 'Add at least one ingredient.',
		});
		expect(failed.instructionSections.error).toBe('Add at least one step.');
		expect(recipeFormProblems(failed).map(({ target }) => target)).toEqual([
			{ kind: 'row', list: 'ingredientSections', index: 3, id: 3 },
			{ kind: 'section', list: 'ingredientSections', index: 3, id: 3 },
			{ kind: 'list', list: 'instructionSections' },
		]);
	});

	it('puts a problem with a section without a heading on its list', () => {
		const failed = failedSave(lemonBarsForm(), {
			'instructionSections.0': 'Check these steps.',
		});

		expect(failed.instructionSections.error).toBe('Check these steps.');
	});

	it('puts problems with fields, tags, and photos on them', () => {
		const values = failedSave(lemonBarsForm(), {
			'times.prepMinutes': 'Enter whole minutes.',
			'yield.amount': 'We couldn’t read this amount. Use a number, or two numbers for a range.',
			'yield.unit': 'Enter some text.',
			'tags.1': 'Enter a tag.',
			'images.2.pathname': 'This photo didn’t upload. Remove it and add it again.',
		});

		expect(values.fieldErrors).toEqual({
			prepMinutes: 'Enter whole minutes.',
			yieldAmount: 'We couldn’t read this amount. Use a number, or two numbers for a range.',
			yieldUnit: 'Enter some text.',
			tags: 'Enter a tag.',
		});
		expect(values.photos.scan[0]?.error).toBe(
			'This photo didn’t upload. Remove it and add it again.'
		);
	});

	it('shows a problem that names nothing in the form as one with the whole recipe', () => {
		const values = failedSave(lemonBarsForm(), {
			'': 'We couldn’t read the recipe. Reload the page and try again.',
			provenance: 'Something else.',
		});

		expect(values.formError).toBe('We couldn’t read the recipe. Reload the page and try again.');
	});

	it('clears earlier errors', () => {
		const failed = failedSave(lemonBarsForm(), { title: 'Enter some text.', '': 'Try again.' });
		const cleared = failedSave(failed, {});

		expect(cleared.fieldErrors).toEqual({});
		expect(cleared.formError).toBeUndefined();
	});
});

describe('the yield as the form shows it', () => {
	function yieldText(amount: { min: number; max?: number }): string {
		const values = recipeFormValues({ ...lemonBars, yield: { kind: 'servings', amount } });
		return values.text.yieldAmount;
	}

	it('shows fractions that read back exactly, as the recipe page does', () => {
		expect(yieldText({ min: 0.5 })).toBe('½');
		expect(yieldText({ min: 1 / 3 })).toBe('⅓');
		expect(yieldText({ min: 4, max: 6 })).toBe('4 to 6');
	});

	it('shows plain decimals where the page rounds, so an untouched save keeps the amount', () => {
		expect(yieldText({ min: 1.996 })).toBe('1.996');
		expect(yieldText({ min: 1.996, max: 2.001 })).toBe('1.996 to 2.001');
		expect(parseAmountText(yieldText({ min: 1.996, max: 2.001 }))).toEqual({
			min: 1.996,
			max: 2.001,
		});
	});

	it('never writes an amount in exponent form, which would not read back', () => {
		expect(yieldText({ min: 0.0000001 })).toBe('0.0000001');
		expect(yieldText({ min: 1.5e-7 })).toBe('0.00000015');
		expect(parseAmountText(yieldText({ min: 1.5e-7 }))).toEqual({ min: 1.5e-7 });
	});
});
