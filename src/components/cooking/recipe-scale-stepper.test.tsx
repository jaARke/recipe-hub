import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecipeScaleStepper } from '@/components/cooking/recipe-scale-stepper';
import { useRecipeScale } from '@/components/cooking/use-cooking-url';
import { formatScaledYield, type RecipeYield } from '@/domain/recipe/recipe-yield';

const cookingPathname = '/recipes/weeknight-chicken-soup/cook';

const serves6: RecipeYield = { kind: 'servings', amount: { min: 6 } };
const makes24Cookies: RecipeYield = { kind: 'makes', amount: { min: 24 }, unit: 'cookies' };
const serves4To6: RecipeYield = { kind: 'servings', amount: { min: 4, max: 6 } };

// The stepper beside the yield it scales the recipe to.
function ScaledRecipe({ recipeYield }: { recipeYield: RecipeYield | undefined }) {
	const scale = useRecipeScale(recipeYield);
	return (
		<>
			<p data-testid="yield">{formatScaledYield(recipeYield, scale.factor)}</p>
			<RecipeScaleStepper scale={scale} />
		</>
	);
}

function visit(search: string) {
	history.replaceState(null, '', `${cookingPathname}${search}`);
}

function stepper(name: string): HTMLInputElement {
	return screen.getByRole<HTMLInputElement>('textbox', { name });
}

function scaledYield(): string | null {
	return screen.getByTestId('yield').textContent;
}

function announced(): string | null | undefined {
	return screen.getAllByRole('status').at(-1)?.textContent;
}

beforeEach(() => {
	visit('');
});

afterEach(() => {
	visit('');
	// The server's HTML is written in by hand, so a test that fails before hydrating it leaves it.
	document.body.replaceChildren();
});

describe('RecipeScaleStepper', () => {
	it('renders the recipe at its own scale from the server, disabled, then the URL’s once hydrated', () => {
		visit('?servings=12');
		const container = document.body.appendChild(document.createElement('div'));
		container.innerHTML = renderToString(<ScaledRecipe recipeYield={serves6} />);

		const serverInput = container.querySelector('input[type="text"]');
		expect(serverInput?.getAttribute('value')).toBe('6');
		expect(serverInput?.hasAttribute('disabled')).toBe(true);
		expect(container.querySelector('[data-testid="yield"]')?.textContent).toBe('Serves 6');

		render(<ScaledRecipe recipeYield={serves6} />, { container, hydrate: true });

		expect(stepper('Servings').value).toBe('12');
		expect(stepper('Servings').disabled).toBe(false);
		expect(scaledYield()).toBe('Serves 12');
	});

	it('steps servings by one, writing the scale to the URL in place and announcing the yield', async () => {
		visit('?step=3');
		const length = history.length;
		const user = userEvent.setup();
		render(<ScaledRecipe recipeYield={serves6} />);

		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(stepper('Servings').value).toBe('7');
		expect(location.search).toBe('?step=3&servings=7');
		expect(scaledYield()).toBe('Serves 7');
		expect(announced()).toBe('Serves 7');

		await user.click(screen.getByRole('button', { name: 'Decrease' }));
		await user.click(screen.getByRole('button', { name: 'Decrease' }));

		expect(location.search).toBe('?step=3&servings=5');
		expect(announced()).toBe('Serves 5');
		expect(history.length).toBe(length);
	});

	it('steps what a recipe makes by half its count, from half the recipe, under its own parameter', async () => {
		const user = userEvent.setup();
		render(<ScaledRecipe recipeYield={makes24Cookies} />);

		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(stepper('Cookies').value).toBe('36');
		expect(location.search).toBe('?makes=36');
		expect(scaledYield()).toBe('Makes 36 cookies');

		await user.click(screen.getByRole('button', { name: 'Decrease' }));
		await user.click(screen.getByRole('button', { name: 'Decrease' }));

		expect(stepper('Cookies').value).toBe('12');
		expect(screen.getByRole('button', { name: 'Decrease' }).hasAttribute('disabled')).toBe(true);
	});

	it('steps a range yield in batches by half', async () => {
		const user = userEvent.setup();
		render(<ScaledRecipe recipeYield={serves4To6} />);

		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(stepper('Batches').value).toBe('1.5');
		expect(location.search).toBe('?batches=1.5');
		expect(scaledYield()).toBe('Serves 6 to 9');
		expect(announced()).toBe('Serves 6 to 9');
	});

	it('steps a recipe with no yield in batches', async () => {
		const user = userEvent.setup();
		render(<ScaledRecipe recipeYield={undefined} />);

		await user.click(screen.getByRole('button', { name: 'Decrease' }));

		expect(stepper('Batches').value).toBe('0.5');
		expect(location.search).toBe('?batches=0.5');
		expect(announced()).toBe('½ batch');
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
			render(<ScaledRecipe recipeYield={recipeYield} />);

			await user.clear(stepper(name));
			await user.type(stepper(name), typed);
			await user.tab();

			expect(stepper(name).value).toBe(held);
			expect(location.search).toBe(search);
		}
	);

	it('scales as a number is typed, and keeps the scale while the field is empty', async () => {
		const user = userEvent.setup();
		render(<ScaledRecipe recipeYield={serves6} />);

		await user.clear(stepper('Servings'));
		expect(location.search).toBe('');

		await user.type(stepper('Servings'), '12');

		expect(location.search).toBe('?servings=12');
		expect(scaledYield()).toBe('Serves 12');
	});

	it('shows Reset while scaled, which restores the recipe’s scale and takes the parameter out', async () => {
		visit('?step=2&servings=8');
		const user = userEvent.setup();
		render(<ScaledRecipe recipeYield={serves6} />);

		await user.click(screen.getByRole('button', { name: 'Reset' }));

		expect(location.search).toBe('?step=2');
		expect(stepper('Servings').value).toBe('6');
		expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
		expect(document.activeElement).toBe(stepper('Servings'));
		expect(announced()).toBe('Serves 6');
	});

	it.each(['?servings=abc', '?servings=0', '?makes=12'])(
		'shows the recipe at its own scale for %s, without Reset',
		(search) => {
			visit(search);
			render(<ScaledRecipe recipeYield={serves6} />);

			expect(stepper('Servings').value).toBe('6');
			expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
			expect(scaledYield()).toBe('Serves 6');
		}
	);
});
