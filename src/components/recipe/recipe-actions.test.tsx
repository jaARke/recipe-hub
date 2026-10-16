import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecipeActions } from '@/components/recipe/recipe-actions';

const actions = <RecipeActions slug="buttermilk-biscuits" title="Buttermilk biscuits" />;

// happy-dom's navigator has no share, as desktop Firefox's hasn't; a test that gives it one says so.
function giveShareSheet() {
	const share = vi.fn(async () => {});
	Object.defineProperty(navigator, 'share', { value: share, configurable: true });
	return share;
}

async function openMoreActions(): Promise<HTMLElement> {
	await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
	return screen.findByRole('menu');
}

function itemNames(menu: HTMLElement): string[] {
	return within(menu)
		.getAllByRole('menuitem')
		.map((item) => item.textContent);
}

afterEach(() => {
	Reflect.deleteProperty(navigator, 'share');
});

describe('RecipeActions', () => {
	it('leads with Start cooking, which opens the cooking view', () => {
		render(actions);

		const group = screen.getByRole('group', { name: 'Recipe actions' });
		const [first] = within(group).getAllByRole('link');
		expect(first?.textContent).toBe('Start cooking');
		expect(first?.getAttribute('href')).toBe('/recipes/buttermilk-biscuits/cook');
	});

	it('holds Copy link and Print in its menu where the browser has no share sheet', async () => {
		render(actions);

		expect(itemNames(await openMoreActions())).toEqual(['Copy link', 'Print']);
	});

	it('adds Share where the browser has a share sheet, which shares the recipe’s link', async () => {
		const share = giveShareSheet();
		render(actions);

		const menu = await openMoreActions();
		expect(itemNames(menu)).toEqual(['Share', 'Copy link', 'Print']);

		await userEvent.click(within(menu).getByRole('menuitem', { name: 'Share' }));

		expect(share).toHaveBeenCalledWith({
			title: 'Buttermilk biscuits',
			url: `${location.origin}/recipes/buttermilk-biscuits`,
		});
	});

	it('offers Share once hydrated from the server’s HTML in a browser with a share sheet', async () => {
		giveShareSheet();
		const container = document.body.appendChild(document.createElement('div'));
		container.innerHTML = renderToString(actions);
		render(actions, { container, hydrate: true });

		expect(itemNames(await openMoreActions())).toEqual(['Share', 'Copy link', 'Print']);
	});
});
