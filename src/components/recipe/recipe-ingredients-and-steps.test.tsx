import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
	return screen.getAllByRole('listitem').map((item) => item.textContent);
}

describe('RecipeIngredientsAndSteps', () => {
	it('renders each list under its heading and each section under its own, as written', () => {
		render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
			/>
		);

		expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
			'Ingredients',
			'For the glaze',
			'Steps',
			'For the glaze',
		]);
		expect(listItems()).toEqual([
			'2 cups flour',
			'Salt to taste',
			'1 cup sugar',
			'Mix the flour and salt.',
			'Bake for 20 minutes.',
			'Whisk the sugar with lemon juice.',
		]);
		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByRole('switch')).toBeNull();
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.queryByText(/^Amounts in the steps/)).toBeNull();
	});

	it('shows nothing of a scale at the recipe’s own', () => {
		render(
			<RecipeIngredientsAndSteps
				ingredientSections={ingredientSections}
				instructionSections={instructionSections}
				headingLevel={1}
				scale={{ recipeYield: serves6, factor: 1 }}
			/>
		);

		expect(listItems().slice(0, 3)).toEqual(['2 cups flour', 'Salt to taste', '1 cup sugar']);
		expect(screen.queryByText(/^Amounts in the steps/)).toBeNull();
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

	it('marks a line it left whole "Not scaled", shows a line it scaled in part as written, and marks no other', () => {
		render(doubled);

		expect(listItems().slice(0, 5)).toEqual([
			'12 to fifteen applesNot scaled',
			'Half and half',
			'2 cans artichoke quarters',
			'2 egg plus 1 yolkAs written: 1 egg plus 1 yolk',
			'Salt to taste',
		]);
	});

	it('notes under Steps that their amounts are the recipe’s own', () => {
		render(doubled);

		const note = screen.getByText(/^Amounts in the steps/);
		expect(note.textContent).toBe('Amounts in the steps are for the original 6 servings.');
		expect(within(note).getByText('6 servings').tagName).toBe('STRONG');
	});
});
