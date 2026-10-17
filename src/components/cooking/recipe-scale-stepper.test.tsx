import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent, type Locator } from 'vitest/browser';
import { RecipeScaleStepper } from '@/components/cooking/recipe-scale-stepper';
import { useRecipeScale } from '@/components/cooking/use-cooking-url';
import { hydrate, serverRender } from '@/components/forms/testing/hydrate';
import { formatScaledYield, type RecipeYield } from '@/domain/recipe/recipe-yield';

const cookingPathname = '/recipes/weeknight-chicken-soup/cook';

const serves6: RecipeYield = { kind: 'servings', amount: { min: 6 } };
const makes24Cookies: RecipeYield = { kind: 'makes', amount: { min: 24 }, unit: 'cookies' };
const serves4To6: RecipeYield = { kind: 'servings', amount: { min: 4, max: 6 } };

// The stepper beside the yield it scales the recipe to.
function ScaledRecipe({ recipeYield }: { recipeYield: RecipeYield | undefined }) {
	const scale = useRecipeScale(cookingPathname, recipeYield);
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

function stepper(name: string): Locator {
	return page.getByRole('textbox', { name });
}

function button(name: string): Locator {
	return page.getByRole('button', { name });
}

function scaledYield(): Locator {
	return page.getByTestId('yield');
}

function announced(): Locator {
	return page.getByRole('status');
}

beforeEach(() => {
	visit('');
});

afterEach(() => {
	visit('');
});

describe('RecipeScaleStepper', () => {
	it('renders the recipe at its own scale from the server, disabled, then the URL’s once hydrated', async () => {
		visit('?servings=12');
		const container = serverRender(<ScaledRecipe recipeYield={serves6} />);

		await expect.element(stepper('Servings')).toHaveValue('6');
		await expect.element(stepper('Servings')).toBeDisabled();
		await expect.element(scaledYield()).toHaveTextContent('Serves 6');

		await hydrate(container, <ScaledRecipe recipeYield={serves6} />);

		await expect.element(stepper('Servings')).toHaveValue('12');
		await expect.element(stepper('Servings')).toBeEnabled();
		await expect.element(scaledYield()).toHaveTextContent('Serves 12');
	});

	it('steps servings by one, writing the scale to the URL in place and announcing the yield', async () => {
		visit('?step=3');
		const length = history.length;
		await render(<ScaledRecipe recipeYield={serves6} />);

		await button('Increase').click();

		await expect.element(stepper('Servings')).toHaveValue('7');
		await expect.element(scaledYield()).toHaveTextContent('Serves 7');
		await expect.element(announced()).toHaveTextContent('Serves 7');
		expect(location.search).toBe('?step=3&servings=7');

		await button('Decrease').click();
		await button('Decrease').click();

		await expect.element(announced()).toHaveTextContent('Serves 5');
		expect(location.search).toBe('?step=3&servings=5');
		expect(history.length).toBe(length);
	});

	it('steps what a recipe makes by half its count, from half the recipe, under its own parameter', async () => {
		await render(<ScaledRecipe recipeYield={makes24Cookies} />);

		await button('Increase').click();

		await expect.element(stepper('Cookies')).toHaveValue('36');
		await expect.element(scaledYield()).toHaveTextContent('Makes 36 cookies');
		expect(location.search).toBe('?makes=36');

		await button('Decrease').click();
		await button('Decrease').click();

		await expect.element(stepper('Cookies')).toHaveValue('12');
		await expect.element(button('Decrease')).toBeDisabled();
	});

	it('steps a range yield in batches by half', async () => {
		await render(<ScaledRecipe recipeYield={serves4To6} />);

		await button('Increase').click();

		await expect.element(stepper('Batches')).toHaveValue('1.5');
		await expect.element(scaledYield()).toHaveTextContent('Serves 6 to 9');
		await expect.element(announced()).toHaveTextContent('Serves 6 to 9');
		expect(location.search).toBe('?batches=1.5');
	});

	it('steps a recipe with no yield in batches', async () => {
		await render(<ScaledRecipe recipeYield={undefined} />);

		await button('Decrease').click();

		await expect.element(stepper('Batches')).toHaveValue('0.5');
		await expect.element(announced()).toHaveTextContent('½ batch');
		expect(location.search).toBe('?batches=0.5');
	});

	it.each([
		[serves6, 'Servings', '7.4', '7', '?servings=7'],
		[serves6, 'Servings', '100', '48', '?servings=48'],
		[makes24Cookies, 'Cookies', '30', '36', '?makes=36'],
		[serves4To6, 'Batches', '1.3', '1.5', '?batches=1.5'],
	])(
		'holds %j typed as %s to the nearest step, %s, once the field is left',
		async (recipeYield, name, typed, held, search) => {
			await render(<ScaledRecipe recipeYield={recipeYield} />);

			await stepper(name).fill(typed);
			await userEvent.tab();

			await expect.element(stepper(name)).toHaveValue(held);
			expect(location.search).toBe(search);
		}
	);

	it('scales as a number is typed, and keeps the scale while the field is empty', async () => {
		visit('?servings=8');
		await render(<ScaledRecipe recipeYield={serves6} />);

		await stepper('Servings').clear();
		await expect.element(stepper('Servings')).toHaveValue('');
		expect(location.search).toBe('?servings=8');

		await stepper('Servings').fill('12');

		await expect.element(scaledYield()).toHaveTextContent('Serves 12');
		expect(location.search).toBe('?servings=12');
	});

	it('shows Reset while scaled, which restores the recipe’s scale and takes the parameter out', async () => {
		visit('?step=2&servings=8');
		await render(<ScaledRecipe recipeYield={serves6} />);

		await button('Reset').click();

		await expect.element(button('Reset')).not.toBeInTheDocument();
		await expect.element(stepper('Servings')).toHaveValue('6');
		await expect.element(stepper('Servings')).toHaveFocus();
		await expect.element(announced()).toHaveTextContent('Serves 6');
		expect(location.search).toBe('?step=2');
	});

	it('shows the recipe at its own scale, without Reset, for a scale it cannot read', async () => {
		visit('?servings=abc');
		await render(<ScaledRecipe recipeYield={serves6} />);

		await expect.element(stepper('Servings')).toHaveValue('6');
		await expect.element(scaledYield()).toHaveTextContent('Serves 6');
		await expect.element(button('Reset')).not.toBeInTheDocument();
	});
});
