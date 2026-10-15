import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookingChecksKey } from '@/components/cooking/cooking-checks';
import type { CookingRecipe } from '@/components/cooking/cooking-screens';
import { CookingView } from '@/components/cooking/cooking-view';
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

// The screen shown, apart from the printout and any open dialog.
function shown() {
	return within(screen.getByRole('main'));
}

function screenHeading(): HTMLElement {
	return shown().getByRole('heading', { level: 1 });
}

function checkboxNames(checked?: boolean): string[] {
	return shown()
		.queryAllByRole('checkbox', checked === undefined ? {} : { checked })
		.map((box) => box.closest('label')?.textContent ?? '');
}

// The whole row that checks the ingredient off.
function ingredientRow(name: string, scope = shown()): HTMLElement {
	const row = scope.getByRole('checkbox', { name }).closest('label');
	if (row === null) {
		throw new Error(`No row for ${name}`);
	}
	return row;
}

// The whole recipe the printout holds, which the screen never shows.
function printout(): HTMLElement {
	const article = document.querySelector<HTMLElement>('article.print\\:flex');
	if (article === null) {
		throw new Error('No printout');
	}
	return article;
}

beforeEach(() => {
	visit('');
});

afterEach(() => {
	sessionStorage.clear();
	visit('');
	Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('CookingView', () => {
	it('renders the skeleton from the server, so the cached page holds no cook’s place', () => {
		visit('?step=2');

		const html = renderToString(<CookingView recipe={potRoast} />);

		expect(html).toContain('Loading recipe');
		expect(html).not.toContain('Gather your ingredients');
	});

	it('opens on Gather with the stepper, the checklist by section, the count, and the notes', () => {
		render(<CookingView recipe={potRoast} />);

		expect(screenHeading().textContent).toBe('Gather your ingredients');
		expect(shown().getByText('0 of 3 gathered')).toBeDefined();
		expect(screen.getByRole('textbox', { name: 'Servings' })).toBeDefined();
		expect(shown().getByRole('heading', { level: 2, name: 'For the gravy' })).toBeDefined();
		expect(checkboxNames()).toEqual([
			'3 pounds beef chuck roast',
			'Salt to taste',
			'1 tablespoon flour',
		]);
		expect(shown().getByRole('heading', { level: 2, name: 'Notes' })).toBeDefined();
		expect(screen.getByRole('link', { name: 'Close cooking view' }).getAttribute('href')).toBe(
			'/recipes/sunday-pot-roast'
		);
		expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
		expect(screen.queryByText(/^Picked up/)).toBeNull();
	});

	it('scales the checklist, keeping its checks, and writes the scale to the URL in place', async () => {
		const length = history.length;
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(ingredientRow('3 pounds beef chuck roast'));
		await user.click(screen.getByRole('button', { name: 'Increase' }));

		expect(location.search).toBe('?servings=7');
		expect(checkboxNames(true)).toEqual(['3½ pounds beef chuck roast']);
		expect(history.length).toBe(length);
	});

	it('walks every step across sections to the finish, focusing each screen’s heading', async () => {
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('button', { name: 'Start cooking' }));

		expect(location.search).toBe('?step=1');
		expect(document.activeElement).toBe(screenHeading());
		expect(screenHeading().getAttribute('aria-label')).toBe('For the roast, step 1 of 3');
		expect(shown().getByText('Heat the oven to 300°F.')).toBeDefined();

		await user.click(screen.getByRole('button', { name: 'Next step' }));

		expect(screenHeading().getAttribute('aria-label')).toBe('For the roast, step 2 of 3');
		// The step keeps its line breaks.
		expect(shown().getByText(/^Sear the roast/).textContent).toBe(
			'Sear the roast.\nTurn it every few minutes.'
		);

		await user.click(screen.getByRole('button', { name: 'Next step' }));

		expect(screenHeading().getAttribute('aria-label')).toBe('For the gravy, step 3 of 3');

		await user.click(screen.getByRole('button', { name: 'Finish' }));

		expect(location.search).toBe('?step=4');
		expect(screenHeading().textContent).toBe('Enjoy your Sunday pot roast');
		expect(document.activeElement).toBe(screenHeading());
		expect(screen.getByRole('link', { name: 'Back to the recipe' }).getAttribute('href')).toBe(
			'/recipes/sunday-pot-roast'
		);
		expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
	});

	it('goes back a screen with Back, and to Gather from the first step', async () => {
		visit('?step=2');
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('button', { name: 'Back' }));
		expect(screenHeading().getAttribute('aria-label')).toBe('For the roast, step 1 of 3');

		await user.click(screen.getByRole('button', { name: 'Back' }));
		expect(location.search).toBe('');
		expect(screenHeading().textContent).toBe('Gather your ingredients');
	});

	it('notes on a step that gives an amount that its amounts are the recipe’s own while scaled', () => {
		visit('?servings=12&step=1');
		render(<CookingView recipe={potRoast} />);

		const note = shown().getByText(/^Amounts in the steps are for the original/);
		expect(note.textContent).toBe('Amounts in the steps are for the original 6 servings.');
		expect(within(note).getByText('6 servings').tagName).toBe('STRONG');
	});

	it('notes nothing on a step that gives no amount', () => {
		visit('?servings=12&step=3');
		render(<CookingView recipe={potRoast} />);

		expect(shown().getByRole('heading', { level: 1, name: /step 3 of 3/i })).toBeDefined();
		expect(shown().queryByText(/^Amounts in the steps/)).toBeNull();
	});

	it('moves with the arrow keys, but not from a control or while a dialog is open', async () => {
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.keyboard('{ArrowRight}');
		expect(location.search).toBe('?step=1');
		expect(document.activeElement).toBe(screenHeading());

		await user.keyboard('{ArrowRight}{ArrowLeft}');
		expect(location.search).toBe('?step=1');

		await user.keyboard(' ');
		expect(location.search).toBe('?step=1');

		screen.getByRole('button', { name: 'Next step' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(location.search).toBe('?step=1');

		await user.click(screen.getByRole('button', { name: 'Steps' }));
		await user.keyboard('{ArrowRight}');
		expect(location.search).toBe('?step=1');
	});

	it('leaves the arrow keys to the stepper’s field', async () => {
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('textbox', { name: 'Servings' }));
		await user.keyboard('{ArrowRight}');

		expect(location.search).toBe('');
	});

	it('jumps to any step from Steps, focusing that screen’s heading as the dialog closes', async () => {
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('button', { name: 'Steps' }));
		const dialog = await screen.findByRole('dialog', { name: 'Steps' });
		expect(within(dialog).getByRole('heading', { name: 'For the gravy' })).toBeDefined();
		expect(
			within(dialog)
				.getByRole('button', { name: /Gather your ingredients/ })
				.getAttribute('aria-current')
		).toBe('step');

		await user.click(within(dialog).getByRole('button', { name: /Whisk in the flour/ }));

		expect(location.search).toBe('?step=3');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(document.activeElement).toBe(screenHeading());
		expect(screenHeading().getAttribute('aria-label')).toBe('For the gravy, step 3 of 3');
	});

	it('keeps the checks in the tab for this version of the recipe, through the finish', async () => {
		const user = userEvent.setup();
		const { unmount } = render(<CookingView recipe={potRoast} />);

		await user.click(ingredientRow('3 pounds beef chuck roast'));
		await user.click(ingredientRow('1 tablespoon flour'));

		expect(sessionStorage.getItem(cookingChecksKey(potRoast))).toBe('["0:0","1:0"]');

		await user.click(screen.getByRole('button', { name: 'Start cooking' }));
		await user.click(screen.getByRole('button', { name: 'Next step' }));
		await user.click(screen.getByRole('button', { name: 'Next step' }));
		await user.click(screen.getByRole('button', { name: 'Finish' }));
		// A reload on Gather, as a new visit from the recipe page.
		unmount();
		visit('');
		render(<CookingView recipe={potRoast} />);

		expect(checkboxNames(true)).toEqual(['3 pounds beef chuck roast', '1 tablespoon flour']);
		expect(shown().getByText('2 of 3 gathered')).toBeDefined();
	});

	it('starts an edited recipe’s checks over, and a new tab’s', () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:0"]');
		render(<CookingView recipe={{ ...potRoast, version: '2026-10-06T09:00:00.000Z' }} />);

		expect(checkboxNames(true)).toEqual([]);
	});

	it('picks up past the first screen with a notice, which goes once the cook moves', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:1"]');
		visit('?step=2');
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		expect(screen.getByText('Picked up at step 2, where you left off.')).toBeDefined();
		expect(document.activeElement).toBe(document.body);

		await user.click(screen.getByRole('button', { name: 'Next step' }));

		expect(screen.queryByText(/^Picked up/)).toBeNull();
	});

	it('says it picked up at the end on the finish', () => {
		visit('?step=4');
		render(<CookingView recipe={potRoast} />);

		expect(screen.getByText('Picked up at the end, where you left off.')).toBeDefined();
	});

	it('starts over from the notice: no checks, back on Gather, its heading focused', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:1"]');
		visit('?step=2&servings=12');
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('button', { name: 'Start over' }));

		expect(location.search).toBe('?servings=12');
		expect(screenHeading().textContent).toBe('Gather your ingredients');
		expect(document.activeElement).toBe(screenHeading());
		expect(checkboxNames(true)).toEqual([]);
		expect(sessionStorage.getItem(cookingChecksKey(potRoast))).toBeNull();
		expect(screen.queryByText(/^Picked up/)).toBeNull();
	});

	it('starts over from Steps, focusing Gather’s heading as the dialog closes', async () => {
		sessionStorage.setItem(cookingChecksKey(potRoast), '["0:1"]');
		visit('?step=3');
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('button', { name: 'Steps' }));
		const dialog = await screen.findByRole('dialog', { name: 'Steps' });
		await user.click(within(dialog).getByRole('button', { name: 'Start over' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(location.search).toBe('');
		expect(document.activeElement).toBe(screenHeading());
		expect(checkboxNames(true)).toEqual([]);
	});

	it('opens the ingredients with the stepper and the notes in a dialog from a step', async () => {
		visit('?step=1');
		const user = userEvent.setup();
		render(<CookingView recipe={potRoast} />);

		await user.click(screen.getByRole('button', { name: 'Ingredients' }));
		const dialog = await screen.findByRole('dialog', { name: 'Ingredients' });

		await user.click(ingredientRow('1 tablespoon flour', within(dialog)));

		expect(within(dialog).getByRole('textbox', { name: 'Servings' })).toBeDefined();
		expect(within(dialog).getByRole('heading', { level: 3, name: 'Notes' })).toBeDefined();
		expect(sessionStorage.getItem(cookingChecksKey(potRoast))).toBe('["1:0"]');
	});

	it('cooks a recipe without sections, yield, or notes, in batches, through its one step', async () => {
		const user = userEvent.setup();
		render(<CookingView recipe={salad} />);

		expect(shown().queryByRole('heading', { level: 2 })).toBeNull();
		expect(shown().getByText('0 of 2 gathered')).toBeDefined();

		await user.click(screen.getByRole('button', { name: 'Increase' }));
		expect(location.search).toBe('?batches=1.5');

		await user.click(screen.getByRole('button', { name: 'Start cooking' }));
		expect(screenHeading().getAttribute('aria-label')).toBe('Step 1 of 1');

		await user.click(screen.getByRole('button', { name: 'Finish' }));
		expect(screenHeading().textContent).toBe('Enjoy your Garden salad');
	});

	it('scales a recipe that makes something under its own parameter', async () => {
		visit('?makes=36');
		render(
			<CookingView
				recipe={{ ...salad, yield: { kind: 'makes', amount: { min: 24 }, unit: 'biscuits' } }}
			/>
		);

		expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Biscuits' }).value).toBe('36');
	});

	it('prints the whole recipe at its scale, with what it was scaled to', () => {
		visit('?servings=12&step=2');
		render(<CookingView recipe={potRoast} />);

		const printed = within(printout());
		expect(printed.getByRole('heading', { level: 1, hidden: true }).textContent).toBe(
			'Sunday pot roast'
		);
		expect(printed.getByText('Scaled to 12 servings (recipe serves 6)')).toBeDefined();
		expect(
			printed.getAllByRole('listitem', { hidden: true }).map((item) => item.textContent)
		).toEqual([
			'6 pounds beef chuck roast',
			'Salt to taste',
			'2 tablespoons flour',
			'Heat the oven to 300°F.',
			'Sear the roast.\nTurn it every few minutes.',
			'Whisk in the flour.',
		]);
		expect(printed.getByText(/^Amounts in the steps/).textContent).toBe(
			'Amounts in the steps are for the original 6 servings.'
		);
		expect(printed.getByText('Save the gravy.')).toBeDefined();
		expect(printout().className).toMatch(/(^| )hidden( |$)/);
		expect(document.querySelector('.fixed.print\\:hidden')).not.toBeNull();
	});

	it('prints no scale for a recipe at its own', () => {
		render(<CookingView recipe={potRoast} />);

		expect(within(printout()).queryByText(/^Scaled to/)).toBeNull();
	});

	it('keeps the screen awake while it shows', () => {
		const request = vi.fn(async () => ({ released: false, release: async () => {} }));
		Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });

		render(<CookingView recipe={potRoast} />);

		expect(request).toHaveBeenCalledWith('screen');
	});
});
