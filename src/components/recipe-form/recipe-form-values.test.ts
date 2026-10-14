import { describe, expect, it } from 'vitest';
import {
	editRecipeForm,
	hasPhotosInProgress,
	recipeFormChecks,
	recipeFormProblems,
	recipeFormSubmission,
	recipeFormValues,
	tagLabelsFrom,
	tagLabelsToAdd,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { importDraftFromExtractedRecipe } from '@/domain/recipe/extracted-recipe';
import { parseAmountText, parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import { settings } from '@/lib/settings';

function edited(values: RecipeFormValues, ...edits: RecipeFormEdit[]): RecipeFormValues {
	return edits.reduce(editRecipeForm, values);
}

const photoFile = new File(['jpeg'], 'IMG_0001.jpg', { type: 'image/jpeg' });

// Ids follow the order the form builds things in: ingredient sections and their lines (0 to 4), step
// sections and their steps (5 to 7), tags (8 and 9), then images in the recipe's order (10 to 12).
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
		{ role: 'scan', pathname: 'scan/production/card.jpg' },
		{ role: 'dish', pathname: 'dish/production/bars.jpg', alt: 'Lemon bars on a plate' },
		{ role: 'dish', pathname: 'dish/production/slice.jpg' },
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
			ingredientSections: {
				sections: [{ id: 0, heading: '', items: [{ id: 1, text: '' }] }],
				showsHeadings: false,
			},
			instructionSections: {
				sections: [{ id: 2, heading: '', items: [{ id: 3, text: '' }] }],
				showsHeadings: false,
			},
			tags: [],
			photos: { dish: [], scan: [] },
			fieldErrors: {},
			reviewNotes: new Map(),
			nextId: 4,
		});
	});

	it('fills every field from a recipe', () => {
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
			sections: [
				{
					id: 0,
					heading: 'For the crust',
					items: [
						{ id: 1, text: '1 cup flour' },
						{ id: 2, text: '½ cup butter, softened' },
					],
				},
				{ id: 3, heading: 'For the filling', items: [{ id: 4, text: '2 eggs' }] },
			],
			showsHeadings: true,
		});
		expect(values.instructionSections.showsHeadings).toBe(false);
		expect(values.tags).toEqual([
			{ id: 8, label: 'Dessert' },
			{ id: 9, label: 'Baking' },
		]);
		expect(values.photos).toEqual({
			dish: [
				{
					id: 11,
					alt: 'Lemon bars on a plate',
					upload: { status: 'saved', pathname: 'dish/production/bars.jpg' },
				},
				{ id: 12, alt: '', upload: { status: 'saved', pathname: 'dish/production/slice.jpg' } },
			],
			scan: [
				{ id: 10, alt: '', upload: { status: 'saved', pathname: 'scan/production/card.jpg' } },
			],
		});
		expect(values.nextId).toBe(13);
	});

	it('shows a heading field when the only section has a heading', () => {
		const values = recipeFormValues({
			instructionSections: [{ heading: 'For the roast', steps: [{ text: 'Sear the roast.' }] }],
		});

		expect(values.instructionSections.showsHeadings).toBe(true);
	});

	it('shows a heading field for a heading’s note, so the note has a field to sit beside', () => {
		const values = recipeFormValues({ instructionSections: [{ steps: [{ text: 'Mix.' }] }] }, [
			{ path: 'instructionSections.0.heading', message: 'Check the heading.' },
		]);

		expect(values.instructionSections).toMatchObject({
			sections: [{ heading: '' }],
			showsHeadings: true,
		});
		expect(recipeFormChecks(values).map(({ target }) => target)).toEqual([
			{ kind: 'heading', list: 'instructionSections', sectionIndex: 0, id: 2 },
		]);
	});

	it('takes a draft’s problems as notes on the places they name, and none as errors', () => {
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
				target: { kind: 'heading', list: 'ingredientSections', sectionIndex: 1, id: 3 },
				note: 'Check the heading.',
				markers: [],
				confirmable: true,
			},
			{
				target: {
					kind: 'item',
					list: 'ingredientSections',
					place: { sectionIndex: 1, itemIndex: 0 },
					id: 4,
				},
				note: 'Check the amount.',
				markers: [],
				confirmable: true,
			},
			{
				target: {
					kind: 'item',
					list: 'instructionSections',
					place: { sectionIndex: 0, itemIndex: 1 },
					id: 7,
				},
				note: 'Check this step.',
				markers: [],
				confirmable: true,
			},
			{
				target: { kind: 'photo', role: 'scan', index: 1, id: 9 },
				note: 'Check this page.',
				markers: [],
				confirmable: true,
			},
		]);
		// Nothing is marked invalid: the notes are no errors.
		expect(recipeFormProblems(values)).toEqual([]);
		expect(values.fieldErrors).toEqual({});
		expect(values.formError).toBeUndefined();
		expect(
			values.ingredientSections.sections.flatMap((section) => [
				section.headingError,
				...section.items.map((item) => item.error),
			])
		).toEqual([undefined, undefined, undefined, undefined, undefined]);
		expect(values.photos.scan.map((photo) => photo.error)).toEqual([undefined, undefined]);
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
				target: {
					kind: 'item',
					list: 'ingredientSections',
					place: { sectionIndex: 0, itemIndex: 1 },
					id: 2,
				},
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

	it('adds a blank item with the next id', () => {
		const values = edited(lemonBarsForm(), {
			type: 'addItem',
			list: 'ingredientSections',
			sectionId: 3,
		});

		expect(values.ingredientSections.sections[1]?.items).toEqual([
			{ id: 4, text: '2 eggs' },
			{ id: 13, text: '' },
		]);
		expect(values.nextId).toBe(14);
	});

	it('changes and removes an item', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setItemText', list: 'ingredientSections', itemId: 2, text: '½ cup cold butter' },
			{ type: 'removeItem', list: 'ingredientSections', itemId: 1 }
		);

		expect(values.ingredientSections.sections[0]?.items).toEqual([
			{ id: 2, text: '½ cup cold butter' },
		]);
	});

	it('moves an item within its section and to another section', () => {
		const withinSection = edited(lemonBarsForm(), {
			type: 'moveItem',
			list: 'ingredientSections',
			itemId: 2,
			to: { sectionIndex: 0, itemIndex: 0 },
		});
		expect(withinSection.ingredientSections.sections[0]?.items.map((item) => item.id)).toEqual([
			2, 1,
		]);

		const toOtherSection = edited(lemonBarsForm(), {
			type: 'moveItem',
			list: 'ingredientSections',
			itemId: 1,
			to: { sectionIndex: 1, itemIndex: 1 },
		});
		expect(
			toOtherSection.ingredientSections.sections.map((section) =>
				section.items.map((item) => item.text)
			)
		).toEqual([['½ cup butter, softened'], ['2 eggs', '1 cup flour']]);
	});

	it('adds a section with a blank item, which shows every heading field', () => {
		const values = edited(lemonBarsForm(), { type: 'addSection', list: 'instructionSections' });

		expect(values.instructionSections.sections[1]).toEqual({
			id: 13,
			heading: '',
			items: [{ id: 14, text: '' }],
		});
		expect(values.instructionSections.showsHeadings).toBe(true);
		expect(values.nextId).toBe(15);
	});

	it('names and removes a section, but keeps the last one', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setHeading', list: 'ingredientSections', sectionId: 3, heading: 'For the topping' },
			{ type: 'removeSection', list: 'ingredientSections', sectionId: 0 }
		);
		expect(values.ingredientSections.sections).toEqual([
			{ id: 3, heading: 'For the topping', items: [{ id: 4, text: '2 eggs' }] },
		]);
		// The heading field stays, since it holds text.
		expect(values.ingredientSections.showsHeadings).toBe(true);

		expect(
			edited(values, { type: 'removeSection', list: 'ingredientSections', sectionId: 3 })
		).toBe(values);
	});

	it('hides the heading fields again when an added section is removed', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addSection', list: 'instructionSections' },
			{ type: 'removeSection', list: 'instructionSections', sectionId: 13 }
		);

		expect(values.instructionSections).toEqual(lemonBarsForm().instructionSections);
	});

	it('hides the heading fields when the section left has a blank heading', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addSection', list: 'instructionSections' },
			{ type: 'setHeading', list: 'instructionSections', sectionId: 13, heading: '  ' },
			{ type: 'removeSection', list: 'instructionSections', sectionId: 5 }
		);

		expect(values.instructionSections).toEqual({
			sections: [{ id: 13, heading: '  ', items: [{ id: 14, text: '' }] }],
			showsHeadings: false,
		});
	});

	it('keeps a heading field while its text is cleared', () => {
		const values = edited(
			recipeFormValues({
				instructionSections: [{ heading: 'For the roast', steps: [{ text: 'Sear the roast.' }] }],
			}),
			{ type: 'setHeading', list: 'instructionSections', sectionId: 2, heading: '' }
		);

		expect(values.instructionSections.showsHeadings).toBe(true);
	});

	it('keeps the heading fields when the section left has a heading error or an open note', () => {
		const twoSections = recipeFormValues(
			{ instructionSections: [{ steps: [{ text: 'Mix.' }] }, { steps: [{ text: 'Bake.' }] }] },
			[{ path: 'instructionSections.1.heading', message: 'Check the heading.' }]
		);
		const removeFirst: RecipeFormEdit = {
			type: 'removeSection',
			list: 'instructionSections',
			sectionId: 2,
		};

		expect(edited(twoSections, removeFirst).instructionSections).toMatchObject({
			sections: [{ id: 4, heading: '' }],
			showsHeadings: true,
		});

		const failed = editRecipeForm(
			edited(twoSections, { type: 'resolveReviewNote', target: { kind: 'heading', id: 4 } }),
			{
				type: 'attachErrors',
				fieldErrors: { 'instructionSections.1.heading': 'Enter some text.' },
				targets: recipeFormSubmission(twoSections).targets,
			}
		);
		expect(edited(failed, removeFirst).instructionSections).toMatchObject({
			sections: [{ id: 4, heading: '', headingError: 'Enter some text.' }],
			showsHeadings: true,
		});
	});

	it('adds each tag not already chosen, once, and clears the tag field', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setText', field: 'tagDraft', text: 'Summer, Make ahead, dessert, summer' },
			{ type: 'addTags', labels: ['Summer', 'Make ahead', 'dessert', ' SUMMER '] },
			{ type: 'removeTag', tagId: 8 }
		);

		expect(values.tags).toEqual([
			{ id: 9, label: 'Baking' },
			{ id: 13, label: 'Summer' },
			{ id: 14, label: 'Make ahead' },
		]);
		expect(values.text.tagDraft).toBe('');
		expect(values.nextId).toBe(15);
	});

	it('follows a photo from choosing it to its upload', () => {
		const added = edited(lemonBarsForm(), {
			type: 'addPhotos',
			role: 'dish',
			fileNames: ['IMG_0001.HEIC', 'IMG_0002.jpg'],
		});
		expect(added.photos.dish.slice(2)).toEqual([
			{ id: 13, fileName: 'IMG_0001.HEIC', alt: '', upload: { status: 'processing' } },
			{ id: 14, fileName: 'IMG_0002.jpg', alt: '', upload: { status: 'processing' } },
		]);
		expect(added.nextId).toBe(15);
		expect(hasPhotosInProgress(added)).toBe(true);

		const uploading = edited(
			added,
			{
				type: 'startPhotoUpload',
				photoId: 13,
				pathname: 'dish/development/a.jpg',
				file: photoFile,
			},
			{ type: 'setPhotoProgress', photoId: 13, fraction: 0.5 }
		);
		expect(uploading.photos.dish[2]?.upload).toEqual({
			status: 'uploading',
			pathname: 'dish/development/a.jpg',
			file: photoFile,
			fraction: 0.5,
		});

		const settled = edited(
			uploading,
			{ type: 'finishPhotoUpload', photoId: 13 },
			{ type: 'failPhoto', photoId: 14, failure: 'unreadable' }
		);
		expect(settled.photos.dish.slice(2).map((photo) => photo.upload)).toEqual([
			{ status: 'uploaded', pathname: 'dish/development/a.jpg', file: photoFile },
			{ status: 'failed', failure: 'unreadable' },
		]);
		expect(hasPhotosInProgress(settled)).toBe(false);
	});

	it('ignores a late report about a photo that was removed or never started', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addPhotos', role: 'scan', fileNames: ['card.jpg'] },
			{ type: 'removePhoto', photoId: 13 }
		);

		expect(
			edited(
				values,
				{
					type: 'startPhotoUpload',
					photoId: 13,
					pathname: 'scan/development/a.jpg',
					file: photoFile,
				},
				{ type: 'setPhotoProgress', photoId: 11, fraction: 0.5 },
				{ type: 'finishPhotoUpload', photoId: 11 },
				{ type: 'failPhoto', photoId: 12, failure: 'upload' }
			)
		).toEqual(values);
	});

	it('makes a dish photo the cover and describes it', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'makeCoverPhoto', photoId: 12 },
			{ type: 'setPhotoAlt', photoId: 12, alt: 'A slice on a fork' }
		);

		expect(values.photos.dish.map((photo) => [photo.id, photo.alt])).toEqual([
			[12, 'A slice on a fork'],
			[11, 'Lemon bars on a plate'],
		]);
	});

	it('moves a page up and down within its own field', () => {
		const added = edited(lemonBarsForm(), {
			type: 'addPhotos',
			role: 'scan',
			fileNames: ['back.jpg', 'notes.jpg'],
		});
		const scanIds = (values: RecipeFormValues) => values.photos.scan.map((photo) => photo.id);

		expect(scanIds(added)).toEqual([10, 13, 14]);
		expect(scanIds(edited(added, { type: 'movePhoto', photoId: 14, toIndex: 1 }))).toEqual([
			10, 14, 13,
		]);
		expect(scanIds(edited(added, { type: 'movePhoto', photoId: 10, toIndex: 1 }))).toEqual([
			13, 10, 14,
		]);
		expect(edited(added, { type: 'movePhoto', photoId: 10, toIndex: 1 }).photos.dish).toBe(
			added.photos.dish
		);
	});
});

describe('recipeFormProblems', () => {
	it('lists each of a save’s errors where the form shows it, in the order it shows them', () => {
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
				title: 'Add a title.',
				'': 'Part of the card was hard to read.',
			},
			targets: recipeFormSubmission(values).targets,
		});

		expect(recipeFormProblems(failed)).toEqual([
			{ message: 'Part of the card was hard to read.', target: { kind: 'form' } },
			{ message: 'Add a title.', target: { kind: 'field', field: 'title' } },
			{ message: 'Check the yield.', target: { kind: 'field', field: 'yieldAmount' } },
			{ message: 'Check the ingredients.', target: { kind: 'list', list: 'ingredientSections' } },
			{
				message: 'Check the heading.',
				target: { kind: 'heading', list: 'ingredientSections', sectionIndex: 1, id: 3 },
			},
			{
				message: 'Check the amount.',
				target: {
					kind: 'item',
					list: 'ingredientSections',
					place: { sectionIndex: 1, itemIndex: 0 },
					id: 4,
				},
			},
			{
				message: 'Check this section.',
				target: { kind: 'section', list: 'ingredientSections', sectionIndex: 1, id: 3 },
			},
			{
				message: 'Check this step.',
				target: {
					kind: 'item',
					list: 'instructionSections',
					place: { sectionIndex: 0, itemIndex: 1 },
					id: 7,
				},
			},
			{ message: 'Check the notes.', target: { kind: 'field', field: 'notes' } },
			{ message: 'Check the tags.', target: { kind: 'field', field: 'tags' } },
			{
				message: 'Check this page.',
				target: { kind: 'photo', role: 'scan', index: 1, id: 9 },
			},
		]);
		expect(recipeFormChecks(failed)).toEqual([]);
	});

	it('lists nothing for a form without problems', () => {
		expect(recipeFormProblems(lemonBarsForm())).toEqual([]);
	});
});

describe('review notes', () => {
	// Ids: the ingredient section (0), its lines (1 and 2), the step section (3), and its step (4).
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
		expect(draft.reviewNotes.get('item:1')).toEqual({
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
			{ type: 'setItemText', list: 'ingredientSections', itemId: 2, text: '3 eggs' }
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
			target: { kind: 'item', id: 1 },
		});

		expect(openNotes(values)).toEqual([
			'Add a title. The original doesn’t show one.',
			'Check this one too.',
		]);
		expect(values.reviewNotes.get('item:1')?.status).toBe('resolved');
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
		// Typing the first ingredient answers the list's note.
		expect(
			recipeFormChecks(
				edited(noIngredients, {
					type: 'setItemText',
					list: 'ingredientSections',
					itemId: 1,
					text: '2 cups flour',
				})
			)
		).toEqual([]);
	});

	it('resolves a section’s note when one of its own lines is edited', () => {
		// Ids: the first section (0) and its line (1), then the glaze (2) and its line (3).
		const values = recipeFormValues(
			{
				ingredientSections: [
					{ lines: [{ text: '1 cup flour' }] },
					{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
				],
			},
			[{ path: 'ingredientSections.1', message: 'A line of the glaze was too faint to read.' }]
		);

		const otherSection = edited(values, {
			type: 'setItemText',
			list: 'ingredientSections',
			itemId: 1,
			text: '2 cups flour',
		});
		expect(openNotes(otherSection)).toEqual(['A line of the glaze was too faint to read.']);

		const ownSection = edited(otherSection, {
			type: 'setItemText',
			list: 'ingredientSections',
			itemId: 3,
			text: '1 cup powdered sugar',
		});
		expect(openNotes(ownSection)).toEqual([]);
	});

	it('resolves a photo’s note when its description is edited', () => {
		const values = recipeFormValues(
			{ images: [{ role: 'dish', pathname: 'dish/production/bars.jpg' }] },
			[{ path: 'images.0', message: 'Check this photo.' }]
		);

		expect(openNotes(values)).toEqual(['Check this photo.']);
		expect(
			openNotes(edited(values, { type: 'setPhotoAlt', photoId: 4, alt: 'Lemon bars on a plate' }))
		).toEqual([]);
	});

	it('follows an item that moves and drops one that is removed', () => {
		// Ids: the ingredient section (0) and its line (1), then the step section (2) and its steps.
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
			{
				type: 'moveItem',
				list: 'instructionSections',
				itemId: 3,
				to: { sectionIndex: 0, itemIndex: 1 },
			},
			{ type: 'removeItem', list: 'instructionSections', itemId: 5 }
		);

		expect(recipeFormChecks(moved)).toEqual([
			{
				target: {
					kind: 'item',
					list: 'instructionSections',
					place: { sectionIndex: 0, itemIndex: 1 },
					id: 3,
				},
				note: 'Check this step.',
				markers: [],
				confirmable: true,
			},
		]);
	});

	it('keeps the open notes, and the resolved ones, across a failed save', () => {
		const checked = edited(draft, { type: 'resolveReviewNote', target: { kind: 'item', id: 2 } });
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
		// Ids: the ingredient section (0) and its line (1), then the step section (2) and its step (3).
		const values = recipeFormValues(
			{
				title: 'Aunt Edie’s [?] cake',
				ingredientSections: [{ lines: [{ text: '1 cup [Illegible]' }] }],
				instructionSections: [{ steps: [{ text: 'Bake [?] until [illegible].' }] }],
			},
			[{ path: 'instructionSections.0.steps.0', message: 'Part of this step was hard to read.' }]
		);

		expect(recipeFormChecks(values)).toEqual([
			{
				target: { kind: 'field', field: 'title' },
				markers: ['unsure'],
				confirmable: false,
			},
			{
				target: {
					kind: 'item',
					list: 'ingredientSections',
					place: { sectionIndex: 0, itemIndex: 0 },
					id: 1,
				},
				markers: ['illegible'],
				confirmable: false,
			},
			{
				target: {
					kind: 'item',
					list: 'instructionSections',
					place: { sectionIndex: 0, itemIndex: 0 },
					id: 3,
				},
				note: 'Part of this step was hard to read.',
				markers: ['illegible', 'unsure'],
				confirmable: false,
			},
		]);

		const partlyFixed = edited(values, {
			type: 'setItemText',
			list: 'instructionSections',
			itemId: 3,
			text: 'Bake 25 minutes, until [illegible].',
		});
		expect(recipeFormChecks(partlyFixed)[2]).toEqual({
			target: {
				kind: 'item',
				list: 'instructionSections',
				place: { sectionIndex: 0, itemIndex: 0 },
				id: 3,
			},
			markers: ['illegible'],
			confirmable: false,
		});

		const fixed = edited(
			partlyFixed,
			{ type: 'setText', field: 'title', text: 'Aunt Edie’s cake' },
			{ type: 'setItemText', list: 'ingredientSections', itemId: 1, text: '1 cup flour' },
			{
				type: 'setItemText',
				list: 'instructionSections',
				itemId: 3,
				text: 'Bake 25 minutes, until golden.',
			}
		);
		expect(recipeFormChecks(fixed)).toEqual([]);
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
				target: {
					kind: 'item',
					list: 'instructionSections',
					place: { sectionIndex: 0, itemIndex: 0 },
					id: 3,
				},
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
	it('sends the recipe without blank items or blank optional text', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'setText', field: 'description', text: '   ' },
			{ type: 'setText', field: 'source', text: ' Great-aunt Edie ' },
			{ type: 'setText', field: 'prepMinutes', text: '' },
			{ type: 'setText', field: 'tagDraft', text: 'Summer, Citrus' },
			{ type: 'addItem', list: 'ingredientSections', sectionId: 0 },
			{ type: 'addItem', list: 'instructionSections', sectionId: 5 },
			{ type: 'setItemText', list: 'instructionSections', itemId: 14, text: ' Cool completely. ' }
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
				{ role: 'dish', pathname: 'dish/production/bars.jpg', alt: 'Lemon bars on a plate' },
				{ role: 'dish', pathname: 'dish/production/slice.jpg' },
				{ role: 'scan', pathname: 'scan/production/card.jpg' },
			],
		});
	});

	it('leaves out an empty section without a heading, but keeps one with a heading', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addSection', list: 'ingredientSections' },
			{ type: 'addSection', list: 'ingredientSections' },
			{ type: 'setHeading', list: 'ingredientSections', sectionId: 15, heading: 'For the glaze' }
		);

		expect(recipeFormSubmission(values).payload.ingredientSections).toEqual([
			{ heading: 'For the crust', lines: ['1 cup flour', '½ cup butter, softened'] },
			{ heading: 'For the filling', lines: ['2 eggs'] },
			{ heading: 'For the glaze', lines: [] },
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

	it('sends only stored photos', () => {
		const values = edited(
			lemonBarsForm(),
			{ type: 'addPhotos', role: 'dish', fileNames: ['a.jpg', 'b.jpg', 'c.heic'] },
			{
				type: 'startPhotoUpload',
				photoId: 13,
				pathname: 'dish/development/a.jpg',
				file: photoFile,
			},
			{ type: 'finishPhotoUpload', photoId: 13 },
			{
				type: 'startPhotoUpload',
				photoId: 14,
				pathname: 'dish/development/b.jpg',
				file: photoFile,
			},
			{ type: 'failPhoto', photoId: 15, failure: 'unreadable' }
		);

		expect(recipeFormSubmission(values).payload.images.map((image) => image.pathname)).toEqual([
			'dish/production/bars.jpg',
			'dish/production/slice.jpg',
			'dish/development/a.jpg',
			'scan/production/card.jpg',
		]);
	});
});

describe('attaching errors', () => {
	// A save's problems name places in what was sent, which leaves out blank items.
	function failedSave(values: RecipeFormValues, problems: Record<string, string>) {
		const { targets } = recipeFormSubmission(values);
		return editRecipeForm(values, { type: 'attachErrors', fieldErrors: problems, targets });
	}

	const withBlankLine = edited(
		lemonBarsForm(),
		{ type: 'addItem', list: 'ingredientSections', sectionId: 0 },
		{
			type: 'moveItem',
			list: 'ingredientSections',
			itemId: 13,
			to: { sectionIndex: 0, itemIndex: 0 },
		}
	);

	it('puts a problem with any part of a line on that line, past blank lines', () => {
		const values = failedSave(withBlankLine, {
			'ingredientSections.0.lines.1.amount.max': 'Make the end of the range larger than the start.',
		});

		expect(values.ingredientSections.sections[0]?.items).toEqual([
			{ id: 13, text: '', error: undefined },
			{ id: 1, text: '1 cup flour', error: undefined },
			{
				id: 2,
				text: '½ cup butter, softened',
				error: 'Make the end of the range larger than the start.',
			},
		]);
	});

	it('keeps the first of a save’s problems for one line', () => {
		const values = failedSave(lemonBarsForm(), {
			'ingredientSections.0.lines.0.amount.max': 'Make the end of the range larger than the start.',
			'ingredientSections.0.lines.0.item': 'Enter some text.',
		});

		expect(values.ingredientSections.sections[0]?.items[0]?.error).toBe(
			'Make the end of the range larger than the start.'
		);
	});

	it('keeps an error with its item as the item moves, and drops it when the item goes', () => {
		const values = failedSave(withBlankLine, {
			'ingredientSections.0.lines.0.item': 'Enter some text.',
		});
		const moved = edited(values, {
			type: 'moveItem',
			list: 'ingredientSections',
			itemId: 1,
			to: { sectionIndex: 1, itemIndex: 0 },
		});

		expect(moved.ingredientSections.sections[1]?.items[0]).toEqual({
			id: 1,
			text: '1 cup flour',
			error: 'Enter some text.',
		});

		const removed = edited(moved, { type: 'removeItem', list: 'ingredientSections', itemId: 1 });
		expect(
			removed.ingredientSections.sections.flatMap((section) =>
				section.items.map((item) => item.error)
			)
		).toEqual([undefined, undefined, undefined]);
	});

	it('puts a problem with a section’s items on the section, and one with the list on the list', () => {
		const values = edited(withBlankLine, {
			type: 'removeItem',
			list: 'ingredientSections',
			itemId: 4,
		});

		const failed = failedSave(values, {
			'ingredientSections.1.lines': 'Add at least one ingredient.',
			'ingredientSections.1.heading': 'Enter some text.',
			instructionSections: 'Add at least one step.',
		});

		expect(failed.ingredientSections.sections[1]).toMatchObject({
			error: 'Add at least one ingredient.',
			headingError: 'Enter some text.',
		});
		expect(failed.instructionSections.error).toBe('Add at least one step.');
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
