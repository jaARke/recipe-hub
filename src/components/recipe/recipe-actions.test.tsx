import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecipeActions } from '@/components/recipe/recipe-actions';

const actions = <RecipeActions slug="buttermilk-biscuits" title="Buttermilk biscuits" />;

function actionNames(): string[] {
	return screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? '');
}

// happy-dom's navigator has no share, as desktop Firefox's hasn't; a test that gives it one says so.
function giveShareSheet() {
	Object.defineProperty(navigator, 'share', { value: vi.fn(async () => {}), configurable: true });
}

// The server's HTML, hydrated as the page would be.
function hydrateFromServer() {
	const container = document.body.appendChild(document.createElement('div'));
	container.innerHTML = renderToString(actions);
	const serverNames = [...container.querySelectorAll('button')].map((button) =>
		button.getAttribute('aria-label')
	);
	render(actions, { container, hydrate: true });
	return serverNames;
}

afterEach(() => {
	Reflect.deleteProperty(navigator, 'share');
});

describe('RecipeActions', () => {
	it('renders Share from the server, then drops it where the browser has no share sheet', () => {
		expect(hydrateFromServer()).toEqual(['Share', 'Copy link', 'Print']);
		expect(actionNames()).toEqual(['Copy link', 'Print']);
	});

	it('keeps Share where the browser has a share sheet', () => {
		giveShareSheet();

		expect(hydrateFromServer()).toEqual(['Share', 'Copy link', 'Print']);
		expect(actionNames()).toEqual(['Share', 'Copy link', 'Print']);
	});

	it('leaves Share out when rendered in a browser without a share sheet', () => {
		render(actions);

		expect(actionNames()).toEqual(['Copy link', 'Print']);
	});
});
