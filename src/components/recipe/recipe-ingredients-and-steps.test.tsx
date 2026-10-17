import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { RecipeIngredientsAndSteps } from '@/components/recipe/recipe-ingredients-and-steps';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import type { InstructionSection } from '@/domain/recipe/instruction';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

const ingredientSections: IngredientSection[] = [
	{
		lines: [
			{ text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' },
			{ text: 'Salt to taste', item: 'Salt', preparation: 'to taste' },
		],
	},
	{
		heading: 'For the glaze',
		lines: [{ text: '1 cup sugar', amount: { min: 1 }, unit: 'cup', item: 'sugar' }],
	},
];

const instructionSections: InstructionSection[] = [
	{ steps: [{ text: 'Mix the flour and salt.' }, { text: 'Bake for 20 minutes.' }] },
	{ heading: 'For the glaze', steps: [{ text: 'Whisk the sugar with lemon juice.' }] },
];

const serves6: RecipeYield = { kind: 'servings', amount: { min: 6 } };

function listItems(): (string | null)[] {
	return page
		.getByRole('listitem')
		.elements()
		.map((item) => item.textContent);
}

// Where an item's first line of text starts, in pixels from the page's left edge.
function textStart(item: Element): number {
	const range = document.createRange();
	range.selectNodeContents(item);
	return range.getClientRects()[0]?.left ?? Number.NaN;
}

// How far each list of steps sets its steps in from its edge, in pixels, leaving room for the numbers.
function stepIndents(): number[] {
	return Array.from(document.querySelectorAll('ol'), (list) => {
		const step = list.querySelector('li');
		return (step?.getBoundingClientRect().left ?? 0) - list.getBoundingClientRect().left;
	});
}

describe('RecipeIngredientsAndSteps', () => {
	it('renders each list under its heading and each section under its own, as written', async () => {
		await render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
			/>
		);

		expect(
			page
				.getByRole('heading')
				.elements()
				.map((heading) => heading.textContent)
		).toEqual(['Ingredients', 'For the glaze', 'Steps', 'For the glaze']);
		expect(listItems()).toEqual([
			'2 cups flour',
			'Salt to taste',
			'1 cup sugar',
			'Mix the flour and salt.',
			'Bake for 20 minutes.',
			'Whisk the sugar with lemon juice.',
		]);
		await expect.element(page.getByRole('checkbox')).not.toBeInTheDocument();
		await expect.element(page.getByRole('switch')).not.toBeInTheDocument();
		await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
		await expect.element(page.getByText(/^Amounts in the steps/)).not.toBeInTheDocument();
	});

	it('counts the steps straight through the sections, each section’s list starting where the last left off', async () => {
		await render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
			/>
		);

		const listOf = (step: string) => page.getByRole('list').filter({ has: page.getByText(step) });
		await expect.element(listOf('Mix the flour and salt.')).toHaveAttribute('start', '1');
		await expect.element(listOf('Whisk the sugar with lemon juice.')).toHaveAttribute('start', '3');
	});

	it('indents every section’s steps alike, wide enough for the recipe’s last number', async () => {
		const tenSteps: InstructionSection[] = [
			{ steps: Array.from({ length: 8 }, (_, index) => ({ text: `Step ${index + 1}.` })) },
			{ heading: 'For the glaze', steps: [{ text: 'Whisk.' }, { text: 'Pour.' }] },
		];
		const { rerender } = await render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
			/>
		);

		// "3. " is three of the marker's characters, each 0.525rem or 8.4 px; "10. " is four.
		expect(stepIndents()).toEqual([expect.closeTo(25.2, 1), expect.closeTo(25.2, 1)]);
		await rerender(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={tenSteps}
				headingLevel={1}
			/>
		);
		expect(stepIndents()).toEqual([expect.closeTo(33.6, 1), expect.closeTo(33.6, 1)]);
	});

	it('bullets each ingredient in the steps’ muted marker column, its text starting where a step’s does', async () => {
		await render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
			/>
		);

		const ingredient = page.getByRole('listitem').filter({ hasText: '1 cup sugar' });
		const step = page.getByRole('listitem').filter({ hasText: 'Mix the flour and salt.' });
		await expect.element(ingredient).toHaveStyle({ listStyleType: 'disc' });
		const markerColor = (item: Element) => getComputedStyle(item, '::marker').color;
		expect(markerColor(ingredient.element())).toBe(markerColor(step.element()));
		expect(markerColor(ingredient.element())).not.toBe(
			getComputedStyle(ingredient.element()).color
		);
		expect(textStart(ingredient.element())).toBeCloseTo(textStart(step.element()), 1);
	});

	it('shows nothing of a scale at the recipe’s own', async () => {
		await render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
				scale={{ recipeYield: serves6, factor: 1 }}
			/>
		);

		expect(listItems().slice(0, 3)).toEqual(['2 cups flour', 'Salt to taste', '1 cup sugar']);
		await expect.element(page.getByText(/^Amounts in the steps/)).not.toBeInTheDocument();
	});
});

describe('RecipeIngredientsAndSteps at a scale', () => {
	const markedSections: IngredientSection[] = [
		{
			lines: [
				'12 to fifteen apples',
				'Half and half',
				'1 can artichoke quarters',
				'1 egg plus 1 yolk',
				'Salt to taste',
			].map(parseIngredientLine),
		},
	];

	// The recipe at twice its 6 servings, as the cooking view prints it.
	const doubled = (
		<RecipeIngredientsAndSteps
			ingredientSections={markedSections}
			instructionSections={instructionSections}
			headingLevel={1}
			scale={{ recipeYield: serves6, factor: 2 }}
		/>
	);

	it('marks a line it left whole "Not scaled", shows a line it scaled in part as written, and marks no other', async () => {
		await render(doubled);

		expect(listItems().slice(0, 5)).toEqual([
			'12 to fifteen applesNot scaled',
			'Half and half',
			'2 cans artichoke quarters',
			'2 egg plus 1 yolkAs written: 1 egg plus 1 yolk',
			'Salt to taste',
		]);
	});

	it('notes under Steps that their amounts are the recipe’s own', async () => {
		await render(doubled);

		const note = page.getByText(/^Amounts in the steps/);
		await expect
			.element(note)
			.toHaveTextContent('Amounts in the steps are for the original 6 servings.');
		await expect.element(note.getByText('6 servings')).toHaveStyle({ fontWeight: '600' });
	});
});
