import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CookingModeProvider } from '@/components/cooking/cooking-mode-provider';
import {
	cookingProgressEntry,
	cookingProgressKey,
	type CookingRecipe,
	type CookingRowKey,
} from '@/components/cooking/cooking-progress';
import { RecipeIngredientsAndSteps } from '@/components/recipe/recipe-ingredients-and-steps';
import { RecipeScaleProvider } from '@/components/recipe/recipe-scale-provider';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import type { InstructionSection } from '@/domain/recipe/instruction';

const recipe: CookingRecipe = {
	id: '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
	version: '2026-10-05T08:30:00.000Z',
};

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

const lists = (
	<RecipeIngredientsAndSteps
		ingredientSections={ingredientSections}
		instructionSections={instructionSections}
		headingLevel={1}
	/>
);

const recipePage = <CookingModeProvider recipe={recipe}>{lists}</CookingModeProvider>;

function cookingSwitch(): HTMLElement {
	return screen.getByRole('switch', { name: 'Cooking mode' });
}

// The text of each row with a checkbox, which labels it.
function checkboxNames(checked?: boolean): string[] {
	return screen
		.queryAllByRole('checkbox', checked === undefined ? {} : { checked })
		.map((box) => box.closest('label')?.textContent ?? '');
}

// The step marked as the one to do next.
function currentStep(): string | null | undefined {
	return document.querySelector('[aria-current="step"]')?.textContent;
}

function listsHtml(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll('ul, ol'), (list) => list.outerHTML);
}

// Stores progress for the recipe, as an earlier visit on this device would have.
function keep(on: boolean, checked: CookingRowKey[]) {
	localStorage.setItem(
		cookingProgressKey(recipe.id),
		cookingProgressEntry({ on, checked: new Set(checked) }, recipe, new Date()) ?? ''
	);
}

afterEach(() => {
	localStorage.clear();
	Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('RecipeIngredientsAndSteps', () => {
	it('renders plain lists from the server, then this device’s progress once hydrated', () => {
		keep(true, ['ingredient:1:0', 'step:0:0']);
		const container = document.body.appendChild(document.createElement('div'));
		container.innerHTML = renderToString(recipePage);

		expect(container.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
		expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');

		render(recipePage, { container, hydrate: true });

		expect(cookingSwitch().getAttribute('aria-checked')).toBe('true');
		expect(checkboxNames(true)).toEqual(['1 cup sugar', 'Mix the flour and salt.']);
		expect(currentStep()).toBe('Bake for 20 minutes.');
	});

	it('turns every row into a checkbox, follows the next step, and turns back into the same lists', async () => {
		const user = userEvent.setup();
		const { container } = render(recipePage);
		const plain = listsHtml(container);

		await user.click(cookingSwitch());

		expect(checkboxNames()).toEqual([
			'2 cups flour',
			'Salt to taste',
			'1 cup sugar',
			'Mix the flour and salt.',
			'Bake for 20 minutes.',
			'Whisk the sugar with lemon juice.',
		]);
		expect(screen.getByRole('checkbox', { name: '2 cups flour' })).toBeDefined();
		expect(currentStep()).toBe('Mix the flour and salt.');

		await user.click(screen.getByText('Mix the flour and salt.', { selector: 'label *' }));
		await user.click(screen.getByText('Bake for 20 minutes.', { selector: 'label *' }));

		expect(checkboxNames(true)).toEqual(['Mix the flour and salt.', 'Bake for 20 minutes.']);
		expect(currentStep()).toBe('Whisk the sugar with lemon juice.');

		await user.click(cookingSwitch());

		expect(checkboxNames()).toEqual([]);
		expect(listsHtml(container)).toEqual(plain);
	});

	it('clears the checks on Start over and stays in cooking mode', async () => {
		keep(true, ['ingredient:0:0', 'step:0:0']);
		const user = userEvent.setup();
		render(recipePage);

		await user.click(screen.getByRole('button', { name: 'Start over' }));

		expect(checkboxNames(true)).toEqual([]);
		expect(cookingSwitch().getAttribute('aria-checked')).toBe('true');
		expect(document.activeElement).toBe(cookingSwitch());
		expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
		expect(JSON.parse(localStorage.getItem(cookingProgressKey(recipe.id)) ?? '{}')).toMatchObject({
			on: true,
			checked: [],
		});
	});

	it('still checks rows where storage is blocked, keeping them only for the page', async () => {
		const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('The operation is insecure.', 'SecurityError');
			},
		});
		try {
			const user = userEvent.setup();
			render(recipePage);

			await user.click(cookingSwitch());
			await user.click(screen.getByText('Salt to taste', { selector: 'label *' }));

			expect(checkboxNames(true)).toEqual(['Salt to taste']);
		} finally {
			if (storage !== undefined) {
				Object.defineProperty(globalThis, 'localStorage', storage);
			}
		}
	});

	it('holds the screen awake while cooking mode is on', async () => {
		const release = vi.fn(async () => {});
		const request = vi.fn(async () => {
			const sentinel = Object.assign(new EventTarget(), {
				released: false,
				type: 'screen',
				onrelease: null as ((event: Event) => void) | null,
				release: async () => {
					await release();
					sentinel.onrelease?.(new Event('release'));
				},
			});
			return sentinel;
		});
		Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
		const user = userEvent.setup();
		const { unmount } = render(recipePage);

		await user.click(cookingSwitch());
		expect(request).toHaveBeenCalledTimes(1);

		await user.click(cookingSwitch());
		expect(release).toHaveBeenCalledTimes(1);

		await user.click(cookingSwitch());
		unmount();
		await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(2));
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('renders the plain lists without a switch outside a recipe page', () => {
		keep(true, ['step:0:0']);
		render(lists);

		expect(screen.queryByRole('switch')).toBeNull();
		expect(checkboxNames()).toEqual([]);
		expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
			'2 cups flour',
			'Salt to taste',
			'1 cup sugar',
			'Mix the flour and salt.',
			'Bake for 20 minutes.',
			'Whisk the sugar with lemon juice.',
		]);
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

	// The recipe page at twice its 6 servings.
	function doubled(sections: IngredientSection[]) {
		history.replaceState(null, '', '/recipes/apple-pie?servings=12');
		return (
			<CookingModeProvider recipe={recipe}>
				<RecipeScaleProvider recipeYield={{ kind: 'servings', amount: { min: 6 } }}>
					<RecipeIngredientsAndSteps
						ingredientSections={sections}
						instructionSections={instructionSections}
						headingLevel={1}
					/>
				</RecipeScaleProvider>
			</CookingModeProvider>
		);
	}

	afterEach(() => {
		history.replaceState(null, '', '/');
	});

	it('marks a line it left whole "Not scaled", shows a line it scaled in part as written, and marks no other', () => {
		render(doubled(markedSections));

		expect(
			screen
				.getAllByRole('listitem')
				.slice(0, 5)
				.map((item) => item.textContent)
		).toEqual([
			'12 to fifteen applesNot scaled',
			'Half and half',
			'2 cans artichoke quarters',
			'2 egg plus 1 yolkAs written: 1 egg plus 1 yolk',
			'Salt to taste',
		]);
	});

	it('notes under Steps that their amounts are the recipe’s own', () => {
		render(doubled(markedSections));

		expect(screen.getByText('Amounts in the steps are for the original 6 servings.')).toBeDefined();
	});

	it('prints the scaled lines from cooking mode’s plain copy', async () => {
		const user = userEvent.setup();
		const { container } = render(doubled(ingredientSections));

		await user.click(cookingSwitch());

		const printed = container.querySelector('.print\\:contents ul');
		expect(Array.from(printed?.children ?? [], (item) => item.textContent)).toEqual([
			'4 cups flour',
			'Salt to taste',
		]);
		expect(checkboxNames()).toContain('4 cups flour');
	});
});
