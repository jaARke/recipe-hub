import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent, type Locator } from 'vitest/browser';
import { cookingChecksKey } from '@/components/cooking/cooking-checks';
import type { CookingRecipe } from '@/components/cooking/cooking-screens';
import { CookingView } from '@/components/cooking/cooking-view';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { recipeIdSchema } from '@/domain/recipe/recipe';

const cookPathname = '/recipes/sunday-pot-roast/cook';

// Two sections of ingredients and of steps, a yield, and notes.
const potRoast: CookingRecipe = {
	id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e'),
	slug: 'sunday-pot-roast',
	title: 'Sunday pot roast',
	yield: { kind: 'servings', amount: { min: 6 } },
	notes: 'Ray seared it longer than anyone thought he should.\n\nSave the gravy.',
	ingredientSections: [
		{
			heading: 'For the roast',
			lines: ['3 pounds beef chuck roast', 'Salt to taste'].map(parseIngredientLine),
		},
		{ heading: 'For the gravy', lines: ['1 tablespoon flour'].map(parseIngredientLine) },
	],
	instructionSections: [
		{
			heading: 'For the roast',
			steps: [
				{ text: 'Heat the oven to 300°F.' },
				{ text: 'Sear the roast.\nTurn it every few minutes.' },
			],
		},
		{ heading: 'For the gravy', steps: [{ text: 'Whisk in the flour.' }] },
	],
	version: '2026-10-05T08:30:00.000Z',
};

// No sections, no yield, and no notes, with a single step.
const salad: CookingRecipe = {
	id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6f'),
	slug: 'garden-salad',
	title: 'Garden salad',
	yield: undefined,
	notes: undefined,
	ingredientSections: [{ lines: ['2 tomatoes', 'Salt to taste'].map(parseIngredientLine) }],
	instructionSections: [{ steps: [{ text: 'Toss everything together.' }] }],
	version: '2026-10-05T08:30:00.000Z',
};

function visit(search: string) {
	history.replaceState(null, '', `${cookPathname}${search}`);
}

// Goes back or forward through the tab's history, once the browser has announced the entry.
async function traverse(delta: -1 | 1) {
	const arrived = new Promise((resolve) => {
		window.addEventListener('popstate', resolve, { once: true });
	});
	history.go(delta);
	await arrived;
}

// The screen shown, apart from the printout and any open dialog.
function shown(): Locator {
	return page.getByRole('main');
}

function screenHeading(): Locator {
	return shown().getByRole('heading', { level: 1 });
}

function button(name: string): Locator {
	return page.getByRole('button', { name });
}

function checkboxNames(checked?: boolean): string[] {
	return shown()
		.getByRole('checkbox', { checked })
		.elements()
		.map((box) => box.closest('label')?.textContent ?? '');
}

// The whole row that checks the ingredient off.
function ingredientRow(name: string, scope = shown()): Locator {
	return scope.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name }) });
}

// The whole recipe the printout holds, which the screen never shows.
function printout(): Locator {
	return page.getByRole('article', { includeHidden: true });
}

beforeEach(() => {
	visit('');
});

afterEach(() => {
	sessionStorage.clear();
	visit('');
	vi.restoreAllMocks();
});

describe('CookingView', () => {
	it('renders the skeleton from the server, so the cached page holds no cook’s place', () => {
		visit('?step=2');

		const html = renderToString(<CookingView recipe={potRoast} />);

		expect(html).toContain('Loading recipe');
		expect(html).not.toContain('Gather your ingredients');
	});

	it('opens on Gather with the stepper, the checklist by section, the count, and the notes', async () => {
		await render(<CookingView recipe={potRoast} />);

		await expect
			.element(screenHeading())
			.toHaveAccessibleName('Gather your ingredients, step 0 of 3');
		await expect.element(shown().getByText('0 of 3 gathered')).toBeVisible();
		await expect.element(page.getByRole('textbox', { name: 'Servings' })).toBeVisible();
		await expect
			.element(shown().getByRole('heading', { level: 2, name: 'For the gravy' }))
			.toBeVisible();
		expect(checkboxNames()).toEqual([
			'3 pounds beef chuck roast',
			'Salt to taste',
			'1 tablespoon flour',
		]);
		await expect.element(shown().getByRole('heading', { level: 2, name: 'Notes' })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Close cooking view' }))
			.toHaveAttribute('href', '/recipes/sunday-pot-roast');
		await expect.element(button('Back')).not.toBeInTheDocument();
		await expect.element(page.getByText(/^Picked up/)).not.toBeInTheDocument();
	});

	it('scales the checklist, keeping its checks, and writes the scale to the URL in place', async () => {
		const length = history.length;
		await render(<CookingView recipe={potRoast} />);

		await ingredientRow('3 pounds beef chuck roast').click();
		await button('Increase').click();

		await expect
			.element(shown().getByRole('checkbox', { name: '3½ pounds beef chuck roast' }))
			.toBeChecked();
		expect(checkboxNames(true)).toEqual(['3½ pounds beef chuck roast']);
		expect(location.search).toBe('?servings=7');
		expect(history.length).toBe(length);
	});

	it('walks every step across sections to the finish, focusing each screen’s heading', async () => {
		await render(<CookingView recipe={potRoast} />);

		await button('Start cooking').click();

		await expect.element(screenHeading()).toHaveAccessibleName('For the roast, step 1 of 3');
		await expect.element(screenHeading()).toHaveFocus();
		expect(location.search).toBe('?step=1');
		await expect.element(shown().getByText('Heat the oven to 300°F.')).toBeVisible();

		await button('Next step').click();

		await expect.element(screenHeading()).toHaveAccessibleName('For the roast, step 2 of 3');
		// The step shows its line breaks.
		expect(
			shown()
				.getByText(/^Sear the roast/)
				.element()
		).toHaveProperty('innerText', 'Sear the roast.\nTurn it every few minutes.');

		await button('Next step').click();

		await expect.element(screenHeading()).toHaveAccessibleName('For the gravy, step 3 of 3');

		await button('Finish').click();

		await expect.element(screenHeading()).toHaveTextContent('Enjoy your Sunday pot roast');
		await expect.element(screenHeading()).toHaveFocus();
		expect(location.search).toBe('?step=4');
		await expect
			.element(page.getByRole('link', { name: 'Back to the recipe' }))
			.toHaveAttribute('href', '/recipes/sunday-pot-roast');

		// The finish offers neither Ingredients nor Steps, and Back returns to the last step.
		await expect.element(button('Ingredients')).not.toBeInTheDocument();
		await expect.element(button('Steps')).not.toBeInTheDocument();
		await button('Back').click();
		await expect.element(screenHeading()).toHaveAccessibleName('For the gravy, step 3 of 3');
	});

	it('goes back a screen with Back, and to Gather from the first step', async () => {
		visit('?step=2');
		await render(<CookingView recipe={potRoast} />);

		await button('Back').click();
		await expect.element(screenHeading()).toHaveAccessibleName('For the roast, step 1 of 3');

		await button('Back').click();
		await expect
			.element(screenHeading())
			.toHaveAccessibleName('Gather your ingredients, step 0 of 3');
		expect(location.search).toBe('');
	});

	it('notes on a step that gives an amount that its amounts are the recipe’s own while scaled', async () => {
		visit('?servings=12&step=1');
		await render(<CookingView recipe={potRoast} />);

		const note = shown().getByText(/^Amounts in the steps are for the original/);
		await expect
			.element(note)
			.toHaveTextContent('Amounts in the steps are for the original 6 servings.');
		expect(note.getByText('6 servings').element().tagName).toBe('STRONG');
	});

	it('offers the Ingredients dialog on a step but not on Gather, whose checklist it would repeat', async () => {
		await render(<CookingView recipe={potRoast} />);

		await expect.element(button('Ingredients')).not.toBeInTheDocument();
		await button('Start cooking').click();
		await expect.element(button('Ingredients')).toBeVisible();
		// A phone's step has no room for them beside it.
		await expect
			.element(page.getByRole('complementary', { name: 'Ingredients' }))
			.not.toBeInTheDocument();
	});

	it('shows a step’s ingredients beside it from lg, in place of the Ingredients dialog', async () => {
		visit('?servings=12&step=1');
		await page.viewport(1280, 800);
		await render(<CookingView recipe={potRoast} />);

		const column = page.getByRole('complementary', { name: 'Ingredients' });
		await expect.element(column).toBeVisible();
		await expect.element(column.getByText('Serves 12')).toBeVisible();
		await expect
			.element(column.getByRole('checkbox', { name: '6 pounds beef chuck roast' }))
			.toBeVisible();
		await expect.element(button('Ingredients')).not.toBeInTheDocument();
		await expect.element(screenHeading()).toHaveAccessibleName('For the roast, step 1 of 3');
	});

	it('notes nothing on a step that gives no amount', async () => {
		visit('?servings=12&step=3');
		await render(<CookingView recipe={potRoast} />);

		await expect.element(screenHeading()).toHaveAccessibleName('For the gravy, step 3 of 3');
		await expect.element(shown().getByText(/^Amounts in the steps/)).not.toBeInTheDocument();
	});

	it('moves with the arrow keys, but not from a control or while a dialog is open', async () => {
		await render(<CookingView recipe={potRoast} />);

		await userEvent.keyboard('{ArrowRight}');
		await expect.element(screenHeading()).toHaveAccessibleName('For the roast, step 1 of 3');
		await expect.element(screenHeading()).toHaveFocus();
		expect(location.search).toBe('?step=1');

		await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
		expect(location.search).toBe('?step=1');

		await userEvent.keyboard(' ');
		expect(location.search).toBe('?step=1');

		button('Next step').element().focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(location.search).toBe('?step=1');

		await button('Steps').click();
		await expect.element(page.getByRole('dialog', { name: 'Steps' })).toBeVisible();
		await userEvent.keyboard('{ArrowRight}');
		expect(location.search).toBe('?step=1');
	});

	it('leaves the arrow keys to the stepper’s field', async () => {
		await render(<CookingView recipe={potRoast} />);

		await page.getByRole('textbox', { name: 'Servings' }).click();
		await userEvent.keyboard('{ArrowRight}');

		expect(location.search).toBe('');
	});

	it('jumps to any step from Steps, focusing that screen’s heading as the dialog closes', async () => {
		await render(<CookingView recipe={potRoast} />);

		await button('Steps').click();
		const dialog = page.getByRole('dialog', { name: 'Steps' });
		await expect.element(dialog.getByRole('heading', { name: 'For the gravy' })).toBeVisible();
		await expect
			.element(dialog.getByRole('button', { name: /Gather your ingredients/ }))
			.toHaveAttribute('aria-current', 'step');

		await dialog.getByRole('button', { name: /Whisk in the flour/ }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screenHeading()).toHaveFocus();
		await expect.element(screenHeading()).toHaveAccessibleName('For the gravy, step 3 of 3');
		expect(location.search).toBe('?step=3');
	});

	it('names its checklist and Steps’ list lists, which Safari takes for groups without markers', async () => {
		await render(<CookingView recipe={potRoast} />);

		await expect
			.element(
				shown()
					.getByRole('list')
					.filter({ has: page.getByRole('checkbox', { name: '1 tablespoon flour' }) })
			)
			.toHaveAttribute('role', 'list');
		await button('Steps').click();
		await expect
			.element(page.getByRole('dialog', { name: 'Steps' }).getByRole('list'))
			.toHaveAttribute('role', 'list');
	});

	it('keeps the checks in the tab for this version of the recipe, through the finish', async () => {
		const { unmount } = await render(<CookingView recipe={potRoast} />);

		await ingredientRow('3 pounds beef chuck roast').click();
		await ingredientRow('1 tablespoon flour').click();

		await expect.element(shown().getByText('2 of 3 gathered')).toBeVisible();
		expect(sessionStorage.getItem(cookingChecksKey(potRoast))).toBe('["0:0","1:0"]');

		await button('Start cooking').click();
		await button('Next step').click();
		await button('Next step').click();
		await button('Finish').click();
		await expect.element(screenHeading()).toHaveTextContent('Enjoy your Sunday pot roast');
		// A reload on Gather, as a new visit from the recipe page.
		await unmount();
		visit('');
		await render(<CookingView recipe={potRoast} />);

		await expect.element(shown().getByText('2 of 3 gathered')).toBeVisible();
		expect(checkboxNames(true)).toEqual(['3 pounds beef chuck roast', '1 tablespoon flour']);
	});

	it('starts an edited recipe’s checks over, and a new tab’s', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:0"]');
		await render(<CookingView recipe={{ ...potRoast, version: '2026-10-06T09:00:00.000Z' }} />);

		await expect.element(shown().getByText('0 of 3 gathered')).toBeVisible();
		expect(checkboxNames(true)).toEqual([]);
	});

	it('picks up past the first screen with a notice, which goes once the cook moves', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:1"]');
		visit('?step=2');
		await render(<CookingView recipe={potRoast} />);

		await expect.element(page.getByText('Picked up at step 2, where you left off.')).toBeVisible();
		expect(document.activeElement).toBe(document.body);

		await button('Next step').click();

		await expect.element(page.getByText(/^Picked up/)).not.toBeInTheDocument();
	});

	it('starts over from the notice: no checks, back on Gather, its heading focused', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:1"]');
		visit('?step=2&servings=12');
		await render(<CookingView recipe={potRoast} />);

		await button('Start over').click();

		await expect
			.element(screenHeading())
			.toHaveAccessibleName('Gather your ingredients, step 0 of 3');
		await expect.element(screenHeading()).toHaveFocus();
		expect(location.search).toBe('?servings=12');
		expect(checkboxNames(true)).toEqual([]);
		expect(sessionStorage.getItem(cookingChecksKey(potRoast))).toBeNull();
		await expect.element(page.getByText(/^Picked up/)).not.toBeInTheDocument();
	});

	it('closes Steps as its page hides, so a return through history finds it closed', async () => {
		const keptPage = await renderKeptPage(<CookingView recipe={potRoast} />);

		await button('Steps').click();
		await expect.element(page.getByRole('dialog', { name: 'Steps' })).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(button('Steps')).toHaveAttribute('aria-expanded', 'false');
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('keeps its step while hidden behind a page at another address, and shows it on return', async () => {
		history.replaceState(null, '', '/recipes/sunday-pot-roast');
		history.pushState(null, '', `${cookPathname}?step=1`);
		const keptPage = await renderKeptPage(<CookingView recipe={potRoast} />);
		const ingredients = button('Ingredients').element();
		await button('Ingredients').click();
		await expect.element(page.getByRole('dialog', { name: 'Ingredients' })).toBeVisible();

		// Back to the recipe's page, whose address the browser shows, and announces, before the view
		// hides.
		await traverse(-1);
		await keptPage.hide();
		await expect
			.element(
				page
					.getByRole('main', { includeHidden: true })
					.getByRole('heading', { level: 1, includeHidden: true })
			)
			.toHaveAttribute('aria-label', 'For the roast, step 1 of 3');
		await traverse(1);
		await keptPage.show();

		await expect.element(screenHeading()).toHaveAccessibleName('For the roast, step 1 of 3');
		expect(ingredients.isConnected).toBe(true);
	});

	it('starts over from Steps, focusing Gather’s heading as the dialog closes', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:1"]');
		visit('?step=3');
		await render(<CookingView recipe={potRoast} />);

		await button('Steps').click();
		await page
			.getByRole('dialog', { name: 'Steps' })
			.getByRole('button', { name: 'Start over' })
			.click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screenHeading()).toHaveFocus();
		await expect
			.element(screenHeading())
			.toHaveAccessibleName('Gather your ingredients, step 0 of 3');
		expect(location.search).toBe('');
		expect(checkboxNames(true)).toEqual([]);
	});

	it('opens the ingredients at the servings Gather set, with the notes, in a dialog from a step', async () => {
		visit('?servings=12&step=1');
		await render(<CookingView recipe={potRoast} />);

		await button('Ingredients').click();
		const dialog = page.getByRole('dialog', { name: 'Ingredients' });

		await ingredientRow('2 tablespoons flour', dialog).click();

		await expect
			.element(dialog.getByRole('checkbox', { name: '2 tablespoons flour' }))
			.toBeChecked();
		await expect.element(dialog.getByText('Serves 12')).toBeVisible();
		await expect.element(dialog.getByRole('textbox', { name: 'Servings' })).not.toBeInTheDocument();
		await expect.element(dialog.getByRole('heading', { level: 3, name: 'Notes' })).toBeVisible();
		expect(sessionStorage.getItem(cookingChecksKey(potRoast))).toBe('["1:0"]');
	});

	it('cooks a recipe without sections, yield, or notes, in batches, through its one step', async () => {
		history.replaceState(null, '', '/recipes/garden-salad/cook');
		await render(<CookingView recipe={salad} />);

		await expect.element(shown().getByText('0 of 2 gathered')).toBeVisible();
		await expect.element(shown().getByRole('heading', { level: 2 })).not.toBeInTheDocument();

		await button('Increase').click();
		await expect.element(page.getByRole('textbox', { name: 'Batches' })).toHaveValue('1.5');
		expect(location.search).toBe('?batches=1.5');

		await button('Start cooking').click();
		await expect.element(screenHeading()).toHaveAccessibleName('Step 1 of 1');

		await button('Finish').click();
		await expect.element(screenHeading()).toHaveTextContent('Enjoy your Garden salad');
	});

	it('prints the whole recipe at its scale, with what it was scaled to', async () => {
		visit('?servings=12&step=2');
		await render(<CookingView recipe={potRoast} />);

		await expect.element(printout()).not.toBeVisible();
		await expect
			.element(printout().getByRole('heading', { level: 1, includeHidden: true }))
			.toHaveTextContent('Sunday pot roast');
		await expect
			.element(printout().getByText('Scaled to 12 servings (recipe serves 6)'))
			.toBeInTheDocument();
		expect(
			printout()
				.getByRole('listitem', { includeHidden: true })
				.elements()
				.map((item) => item.textContent)
		).toEqual([
			'6 pounds beef chuck roast',
			'Salt to taste',
			'2 tablespoons flour',
			'Heat the oven to 300°F.',
			'Sear the roast.\nTurn it every few minutes.',
			'Whisk in the flour.',
		]);
		await expect
			.element(printout().getByText(/^Amounts in the steps/))
			.toHaveTextContent('Amounts in the steps are for the original 6 servings.');
		await expect.element(printout().getByText('Save the gravy.')).toBeInTheDocument();
		await expect.element(printout()).toHaveClass('print:flex');
		expect(document.querySelector('.fixed.print\\:hidden')).not.toBeNull();
	});

	it('prints no scale for a recipe at its own', async () => {
		await render(<CookingView recipe={potRoast} />);

		await expect.element(printout().getByText('Save the gravy.')).toBeInTheDocument();
		await expect.element(printout().getByText(/^Scaled to/)).not.toBeInTheDocument();
	});

	it('keeps the screen awake while it shows', async () => {
		const request = vi.spyOn(navigator.wakeLock, 'request');

		await render(<CookingView recipe={potRoast} />);

		expect(request).toHaveBeenCalledWith('screen');
	});
});
