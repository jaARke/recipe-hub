import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookingModeProvider } from '@/components/cooking/cooking-mode-provider';
import {
	cookingProgressEntry,
	cookingProgressKey,
	type CookingRecipe,
} from '@/components/cooking/cooking-progress';
import { RecipeIngredientsAndSteps } from '@/components/recipe/recipe-ingredients-and-steps';
import { RecipeScaleProvider } from '@/components/recipe/recipe-scale-provider';
import { RecipeScaledYield } from '@/components/recipe/recipe-scaled-yield';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import type { InstructionSection } from '@/domain/recipe/instruction';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

const recipePathname = '/recipes/weeknight-chicken-soup';

const recipe: CookingRecipe = {
	id: '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
	version: '2026-10-05T08:30:00.000Z',
};

const serves6: RecipeYield = { kind: 'servings', amount: { min: 6 } };
const makes24Cookies: RecipeYield = { kind: 'makes', amount: { min: 24 }, unit: 'cookies' };
const serves4To6: RecipeYield = { kind: 'servings', amount: { min: 4, max: 6 } };

const ingredientSections: IngredientSection[] = [
	{ lines: ['2 cups chicken broth', '1 onion, diced', 'Salt to taste'].map(parseIngredientLine) },
];

const instructionSections: InstructionSection[] = [
	{ steps: [{ text: 'Simmer the broth with the onion for 20 minutes.' }] },
];

// The recipe page's parts that follow the scale: the header's yield and the ingredients.
function recipePage(recipeYield: RecipeYield | undefined) {
	return (
		<CookingModeProvider recipe={recipe}>
			<RecipeScaleProvider recipeYield={recipeYield}>
				<p data-testid="yield">
					{recipeYield !== undefined && <RecipeScaledYield recipeYield={recipeYield} />}
				</p>
				<RecipeIngredientsAndSteps
					ingredientSections={ingredientSections}
					instructionSections={instructionSections}
					headingLevel={1}
				/>
			</RecipeScaleProvider>
		</CookingModeProvider>
	);
}

function visit(search: string) {
	history.replaceState(null, '', `${recipePathname}${search}`);
}

function stepper(name: string): HTMLInputElement {
	return screen.getByRole<HTMLInputElement>('textbox', { name });
}

function headerYield(): string | null {
	return screen.getByTestId('yield').textContent;
}

// The ingredients on screen, the first list.
function ingredients(): string[] {
	const [list] = screen.getAllByRole('list');
	return Array.from(list?.children ?? [], (item) => item.textContent ?? '');
}

function announced(): string | null | undefined {
	return screen.getAllByRole('status').at(-1)?.textContent;
}

beforeEach(() => {
	visit('');
});

afterEach(() => {
	localStorage.clear();
	visit('');
	// The server's HTML is written in by hand, so a test that fails before hydrating it leaves it.
	document.body.replaceChildren();
});

describe('The servings stepper', () => {
	it('renders the recipe at its own scale from the server, disabled, then the URL’s once hydrated', () => {
		visit('?servings=12');
		const container = document.body.appendChild(document.createElement('div'));
		container.innerHTML = renderToString(recipePage(serves6));

		const serverInput = container.querySelector('input[type="text"]');
		expect(serverInput?.getAttribute('value')).toBe('6');
		expect(serverInput?.hasAttribute('disabled')).toBe(true);
		expect(container.querySelector('[data-testid="yield"]')?.textContent).toBe('Serves 6');
		expect(container.querySelector('ul')?.textContent).toBe(
			'2 cups chicken broth1 onion, dicedSalt to taste'
		);

		render(recipePage(serves6), { container, hydrate: true });

		expect(stepper('Servings').value).toBe('12');
		expect(stepper('Servings').disabled).toBe(false);
		expect(headerYield()).toBe('Serves 12');
		expect(ingredients()).toEqual(['4 cups chicken broth', '2 onions, diced', 'Salt to taste']);
	});

	it('steps servings by one, writing the scale to the URL and announcing the yield', async () => {
		const user = userEvent.setup();
		render(recipePage(serves6));

		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(stepper('Servings').value).toBe('7');
		expect(location.search).toBe('?servings=7');
		expect(headerYield()).toBe('Serves 7');
		expect(announced()).toBe('Serves 7');

		await user.click(screen.getByRole('button', { name: 'Decrease' }));
		await user.click(screen.getByRole('button', { name: 'Decrease' }));

		expect(location.search).toBe('?servings=5');
		expect(announced()).toBe('Serves 5');
	});

	it('steps what a recipe makes by half its count, from half the recipe', async () => {
		const user = userEvent.setup();
		render(recipePage(makes24Cookies));

		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(stepper('Cookies').value).toBe('36');
		expect(location.search).toBe('?makes=36');
		expect(headerYield()).toBe('Makes 36 cookies');

		await user.click(screen.getByRole('button', { name: 'Decrease' }));
		await user.click(screen.getByRole('button', { name: 'Decrease' }));

		expect(stepper('Cookies').value).toBe('12');
		expect(screen.getByRole('button', { name: 'Decrease' }).hasAttribute('disabled')).toBe(true);
	});

	it('steps a range yield in batches by half', async () => {
		const user = userEvent.setup();
		render(recipePage(serves4To6));

		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(stepper('Batches').value).toBe('1.5');
		expect(location.search).toBe('?batches=1.5');
		expect(headerYield()).toBe('Serves 6 to 9');
		expect(announced()).toBe('Serves 6 to 9');
	});

	it('steps a recipe with no yield in batches, which the steps note counts', async () => {
		const user = userEvent.setup();
		render(recipePage(undefined));

		await user.click(screen.getByRole('button', { name: 'Decrease' }));

		expect(stepper('Batches').value).toBe('0.5');
		expect(location.search).toBe('?batches=0.5');
		expect(announced()).toBe('½ batch');
		expect(screen.getByText('Amounts in the steps are for the original batch.')).toBeDefined();
	});

	it.each([
		[serves6, 'Servings', '7.4', '7', '?servings=7'],
		[serves6, 'Servings', '100', '48', '?servings=48'],
		[makes24Cookies, 'Cookies', '30', '36', '?makes=36'],
		[serves4To6, 'Batches', '1.3', '1.5', '?batches=1.5'],
	])(
		'holds %j typed as %s to the nearest step, %s, once the field is left',
		async (recipeYield, name, typed, held, search) => {
			const user = userEvent.setup();
			render(recipePage(recipeYield));

			await user.clear(stepper(name));
			await user.type(stepper(name), typed);
			await user.tab();

			expect(stepper(name).value).toBe(held);
			expect(location.search).toBe(search);
		}
	);

	it('scales the ingredients as a number is typed, and keeps the scale while the field is empty', async () => {
		const user = userEvent.setup();
		render(recipePage(serves6));

		await user.clear(stepper('Servings'));
		expect(location.search).toBe('');

		await user.type(stepper('Servings'), '12');

		expect(location.search).toBe('?servings=12');
		expect(ingredients()).toEqual(['4 cups chicken broth', '2 onions, diced', 'Salt to taste']);
	});

	it('shows Reset while scaled, which restores the recipe’s scale and takes the parameter out', async () => {
		visit('?servings=8&ref=share');
		const user = userEvent.setup();
		render(recipePage(serves6));

		await user.click(screen.getByRole('button', { name: 'Reset' }));

		expect(location.search).toBe('?ref=share');
		expect(stepper('Servings').value).toBe('6');
		expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
		expect(document.activeElement).toBe(stepper('Servings'));
		expect(announced()).toBe('Serves 6');
		expect(screen.queryByText(/^Amounts in the steps/)).toBeNull();
	});

	it.each(['?servings=abc', '?servings=0', '?makes=12'])(
		'shows the recipe at its own scale for %s, without Reset',
		(search) => {
			visit(search);
			render(recipePage(serves6));

			expect(stepper('Servings').value).toBe('6');
			expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
			expect(ingredients()).toEqual(['2 cups chicken broth', '1 onion, diced', 'Salt to taste']);
		}
	);

	it('prints what a scaled recipe was scaled to in place of the stepper', () => {
		visit('?servings=8');
		render(recipePage(serves6));

		const line = screen.getByText('Scaled to 8 servings (recipe serves 6)');
		expect(line.className).toMatch(/(^| )hidden( |$)/);
		expect(line.className).toContain('print:block');
		expect(stepper('Servings').closest('.print\\:hidden')).not.toBeNull();
	});

	it('prints no scale for a recipe at its own scale', () => {
		render(recipePage(serves6));

		expect(screen.queryByText(/^Scaled to/)).toBeNull();
	});
});

describe('The servings stepper in cooking mode', () => {
	// Cooking mode, as this device kept it, with the first ingredient checked.
	function keepCooking() {
		localStorage.setItem(
			cookingProgressKey(recipe.id),
			cookingProgressEntry(
				{ on: true, checked: new Set(['ingredient:0:0']) },
				recipe,
				new Date()
			) ?? ''
		);
	}

	it('shows the scale as text, with Change bringing the stepper back until Done', async () => {
		keepCooking();
		visit('?servings=12');
		const user = userEvent.setup();
		render(recipePage(serves6));

		expect(
			screen.getByText('Scaled to 12 servings (recipe serves 6)', { selector: 'p:not(.hidden)' })
		).toBeDefined();
		expect(screen.queryByRole('textbox', { name: 'Servings' })).toBeNull();

		await user.click(screen.getByRole('button', { name: 'Change' }));

		expect(stepper('Servings').value).toBe('12');
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));

		await user.click(screen.getByRole('button', { name: 'Done' }));

		expect(screen.queryByRole('textbox', { name: 'Servings' })).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }));
	});

	it('keeps checked rows through a rescale', async () => {
		keepCooking();
		const user = userEvent.setup();
		render(recipePage(serves6));

		await user.click(screen.getByRole('button', { name: 'Change' }));
		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(
			screen
				.getAllByRole('checkbox', { checked: true })
				.map((box) => box.closest('label')?.textContent)
		).toEqual(['2⅓ cups chicken broth']);
	});
});
