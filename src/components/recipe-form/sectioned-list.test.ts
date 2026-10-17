import { describe, expect, it } from 'vitest';
import type { RecipeFormRowText } from '@/components/recipe-form/recipe-form-values';
import {
	describeKindChange,
	describePaste,
	describeRowAdded,
	describeRowMove,
	describeRowRemoval,
	itemName,
	listRowNames,
	rowsFromPastedText,
	sectionLabel,
	type ListNaming,
} from '@/components/recipe-form/sectioned-list';

function line(text: string): RecipeFormRowText {
	return { kind: 'item', text };
}

function heading(text: string): RecipeFormRowText {
	return { kind: 'heading', text };
}

// The form's two lists: ingredients, unnumbered, and steps, numbered.
const ingredients: ListNaming = { noun: 'ingredient', numbered: false };
const steps: ListNaming = { noun: 'step', numbered: true };

// Two lines before any heading, a glaze of two lines, and a topping whose heading is still blank.
const rows = [
	line('2 cups flour'),
	line('1 teaspoon salt'),
	heading('For the glaze'),
	line('1 cup powdered sugar'),
	line(''),
	heading('  '),
	line('1 egg'),
];

describe('listRowNames', () => {
	it('numbers a numbered list’s lines straight through its headings, as the recipe page numbers steps', () => {
		expect(listRowNames(rows, steps).map(({ label }) => label)).toEqual([
			'Step 1',
			'Step 2',
			'Step heading 1',
			'Step 3, For the glaze',
			'Step 4, For the glaze',
			'Step heading 2',
			'Step 5, heading 2',
		]);
	});

	it('numbers an unnumbered list’s lines from 1 again after each heading', () => {
		expect(listRowNames(rows, ingredients).map(({ label }) => label)).toEqual([
			'Ingredient 1',
			'Ingredient 2',
			'Ingredient heading 1',
			'Ingredient 1, For the glaze',
			'Ingredient 2, For the glaze',
			'Ingredient heading 2',
			'Ingredient 1, heading 2',
		]);
	});

	it('gives each row its number, its place under its heading, and the heading over it', () => {
		expect(listRowNames(rows, steps)).toEqual([
			{ label: 'Step 1', number: 1, position: 1 },
			{ label: 'Step 2', number: 2, position: 2 },
			{ label: 'Step heading 1', number: 1, position: 1, headingName: 'For the glaze' },
			{ label: 'Step 3, For the glaze', number: 3, position: 1, headingName: 'For the glaze' },
			{ label: 'Step 4, For the glaze', number: 4, position: 2, headingName: 'For the glaze' },
			{ label: 'Step heading 2', number: 2, position: 2, headingName: 'heading 2' },
			{ label: 'Step 5, heading 2', number: 5, position: 1, headingName: 'heading 2' },
		]);
	});

	it('names nothing for a list without headings', () => {
		expect(listRowNames([line('Mix.'), line('Bake.')], steps)).toEqual([
			{ label: 'Step 1', number: 1, position: 1 },
			{ label: 'Step 2', number: 2, position: 2 },
		]);
	});
});

describe('sectionLabel', () => {
	it('names the list and the heading', () => {
		expect(sectionLabel('Ingredients', 'For the glaze')).toBe('Ingredients, For the glaze');
	});
});

describe('itemName', () => {
	it('quotes the item’s own text', () => {
		expect(itemName('  2 cups flour ', 'ingredient')).toBe('“2 cups flour”');
	});

	it('cuts long text to 40 characters', () => {
		expect(
			itemName('Whisk the eggs and sugar until pale and thick, about 3 minutes.', 'step')
		).toBe('“Whisk the eggs and sugar until pale and…”');
	});

	it('uses the noun for a blank item', () => {
		expect(itemName('   ', 'step')).toBe('step');
	});
});

describe('describeRowMove', () => {
	it('names both positions for a line that stays under its heading', () => {
		expect(describeRowMove(rows, 1, 0, ingredients)).toBe(
			'Moved “1 teaspoon salt” from position 2 to 1 of 2.'
		);
		expect(describeRowMove(rows, 3, 4, ingredients)).toBe(
			'Moved “1 cup powdered sugar” from position 1 to 2 of 2.'
		);
	});

	it('names the heading a line moves under, and its new position', () => {
		expect(describeRowMove(rows, 1, 2, ingredients)).toBe(
			'Moved “1 teaspoon salt” to For the glaze, position 1 of 3.'
		);
		expect(describeRowMove(rows, 6, 5, ingredients)).toBe(
			'Moved “1 egg” to For the glaze, position 3 of 3.'
		);
	});

	it('names a step’s place under its heading, not its number', () => {
		expect(describeRowMove(rows, 3, 4, steps)).toBe(
			'Moved “1 cup powdered sugar” from position 1 to 2 of 2.'
		);
		expect(describeRowMove(rows, 1, 2, steps)).toBe(
			'Moved “1 teaspoon salt” to For the glaze, position 1 of 3.'
		);
	});

	it('names the first heading for a line that moves up above it', () => {
		expect(describeRowMove(rows, 3, 2, ingredients)).toBe(
			'Moved “1 cup powdered sugar” above For the glaze, position 3 of 3.'
		);
	});

	it('counts the lines under a heading that moves', () => {
		expect(describeRowMove(rows, 2, 1, ingredients)).toBe(
			'Moved “For the glaze” up, with 3 ingredients under it.'
		);
		expect(describeRowMove(rows, 5, 6, ingredients)).toBe(
			'Moved heading down, with no ingredients under it.'
		);
		expect(describeRowMove([heading('For the glaze'), line('1 egg')], 0, 1, steps)).toBe(
			'Moved “For the glaze” down, with no steps under it.'
		);
		expect(describeRowMove([line('Mix.'), heading('Finish'), line('Bake.')], 1, 0, steps)).toBe(
			'Moved “Finish” up, with 2 steps under it.'
		);
		expect(describeRowMove([heading('Finish'), line('Mix.'), line('Bake.')], 0, 1, steps)).toBe(
			'Moved “Finish” down, with 1 step under it.'
		);
	});
});

describe('describeRowAdded', () => {
	it('names the row as it is once added', () => {
		expect(describeRowAdded(rows.toSpliced(4, 0, line('')), 4, ingredients)).toBe(
			'Added Ingredient 2, For the glaze.'
		);
		expect(describeRowAdded([...rows, heading('')], 7, ingredients)).toBe(
			'Added Ingredient heading 3.'
		);
		expect(describeRowAdded(rows.toSpliced(4, 0, line('')), 4, steps)).toBe(
			'Added Step 4, For the glaze.'
		);
	});
});

describe('describeRowRemoval', () => {
	it('names a removed line', () => {
		expect(describeRowRemoval(rows, 4, ingredients)).toBe('Removed Ingredient 2, For the glaze.');
		expect(describeRowRemoval(rows, 4, steps)).toBe('Removed Step 4, For the glaze.');
	});

	it('says a removed heading’s lines stay', () => {
		expect(describeRowRemoval(rows, 2, ingredients)).toBe(
			'Removed Ingredient heading 1. The 2 ingredients under it stay.'
		);
		expect(describeRowRemoval(rows, 5, steps)).toBe(
			'Removed Step heading 2. The step under it stays.'
		);
		expect(describeRowRemoval([line('Mix.'), heading('Finish')], 1, steps)).toBe(
			'Removed Step heading 1.'
		);
	});
});

describe('describeKindChange', () => {
	it('names the row by its text, then by what it is called now', () => {
		expect(describeKindChange(rows, 3, ingredients)).toBe(
			'Changed “1 cup powdered sugar” to Ingredient heading 2.'
		);
		expect(describeKindChange(rows, 2, ingredients)).toBe(
			'Changed “For the glaze” to Ingredient 3.'
		);
		expect(describeKindChange(rows, 5, ingredients)).toBe(
			'Changed heading to Ingredient 3, For the glaze.'
		);
		expect(describeKindChange(rows, 5, steps)).toBe('Changed heading to Step 5, For the glaze.');
	});
});

describe('describePaste', () => {
	it('counts the lines and headings a paste brought', () => {
		expect(
			describePaste(
				[heading('Crust'), line('a'), line('b'), heading('Filling'), line('c')],
				'ingredient'
			)
		).toBe('Pasted 3 ingredients and 2 headings.');
		expect(describePaste([line('Mix.'), line('Bake.')], 'step')).toBe('Pasted 2 steps.');
		expect(describePaste([heading('Crust'), line('Mix.')], 'step')).toBe(
			'Pasted 1 step and 1 heading.'
		);
		expect(describePaste([heading('Crust'), heading('Filling')], 'step')).toBe(
			'Pasted 2 headings.'
		);
	});
});

describe('rowsFromPastedText', () => {
	it('makes a line of each line with words, without blank lines', () => {
		expect(rowsFromPastedText('2 cups flour\r\n\r\n  1 teaspoon salt  \n')).toEqual([
			line('2 cups flour'),
			line('1 teaspoon salt'),
		]);
	});

	it('drops the bullet or step number that starts a line, and a line of nothing else', () => {
		expect(rowsFromPastedText('• 2 cups flour\n1. Heat the oven.\nStep 5\n1.5 cups milk')).toEqual([
			line('2 cups flour'),
			line('Heat the oven.'),
			line('1.5 cups milk'),
		]);
	});

	it('makes a heading of each line ending in a colon', () => {
		expect(
			rowsFromPastedText('For the crust:\n• 1 cup flour\n2. For the glaze :\n1 cup sugar\n:')
		).toEqual([
			heading('For the crust'),
			line('1 cup flour'),
			heading('For the glaze'),
			line('1 cup sugar'),
		]);
	});
});
