import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { hydrate, serverRender } from '@/components/forms/testing/hydrate';
import { RecipeActions } from '@/components/recipe/recipe-actions';

const actions = <RecipeActions slug="buttermilk-biscuits" title="Buttermilk biscuits" />;

// Gives the browser a share sheet, or hides its own: WebKit has one, and desktop Chromium and
// Firefox have none.
function setShareSheet(share: Navigator['share'] | undefined) {
	Object.defineProperty(navigator, 'share', { value: share, configurable: true });
}

function giveShareSheet() {
	const share = vi.fn<Navigator['share']>(async () => {});
	setShareSheet(share);
	return share;
}

async function openMoreActions() {
	await page.getByRole('button', { name: 'More actions' }).click();
	await expect.element(page.getByRole('menu')).toBeVisible();
}

function itemNames(): (string | null)[] {
	return page
		.getByRole('menu')
		.getByRole('menuitem')
		.elements()
		.map((item) => item.textContent);
}

afterEach(() => {
	Reflect.deleteProperty(navigator, 'share');
});

describe('RecipeActions', () => {
	it('leads with Start cooking, which opens the cooking view', async () => {
		await render(actions);

		const first = page.getByRole('group', { name: 'Recipe actions' }).getByRole('link').first();
		await expect.element(first).toHaveTextContent('Start cooking');
		await expect.element(first).toHaveAttribute('href', '/recipes/buttermilk-biscuits/cook');
	});

	it('holds Copy link and Print in its menu where the browser has no share sheet', async () => {
		setShareSheet(undefined);
		await render(actions);

		await openMoreActions();

		expect(itemNames()).toEqual(['Copy link', 'Print']);
	});

	it('adds Share where the browser has a share sheet, which shares the recipe’s link', async () => {
		const share = giveShareSheet();
		await render(actions);

		await openMoreActions();
		expect(itemNames()).toEqual(['Share', 'Copy link', 'Print']);
		await page.getByRole('menuitem', { name: 'Share' }).click();

		expect(share).toHaveBeenCalledExactlyOnceWith({
			title: 'Buttermilk biscuits',
			url: `${location.origin}/recipes/buttermilk-biscuits`,
		});
	});

	it('offers Share once hydrated from the server’s HTML in a browser with a share sheet', async () => {
		giveShareSheet();
		const container = serverRender(actions);
		await hydrate(container, actions);

		await openMoreActions();

		expect(itemNames()).toEqual(['Share', 'Copy link', 'Print']);
	});
});
