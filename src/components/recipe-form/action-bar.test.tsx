import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { ActionBar } from '@/components/recipe-form/action-bar';

// A form whose fields run past the screen's bottom, with as much page again after it.
function recipeForm(status: React.ReactNode) {
	return (
		<>
			<form aria-label="Recipe">
				<div style={{ height: '150vh' }} />
				<ActionBar status={status}>
					<button type="submit">Save</button>
				</ActionBar>
			</form>
			<div style={{ height: '150vh' }} />
		</>
	);
}

function bar(): HTMLElement {
	const element = page
		.getByRole('button', { name: 'Save' })
		.element()
		.closest<HTMLElement>('[data-action-bar]');
	if (element === null) {
		throw new Error('Save is in no action bar.');
	}
	return element;
}

function form() {
	return page.getByRole('form', { name: 'Recipe' }).element();
}

// The form's end in the middle of the screen, the bar at its place there.
function scrollFormEndToMiddle() {
	window.scrollTo(
		0,
		window.scrollY + form().getBoundingClientRect().bottom - window.innerHeight / 2
	);
}

describe('ActionBar', () => {
	it('is held at the screen’s bottom while its place at the form’s end is below the screen', async () => {
		await render(recipeForm(<p>3 to check</p>));

		await expect.element(bar()).toHaveAttribute('data-held');
		expect(bar().getBoundingClientRect().bottom).toBe(window.innerHeight);

		scrollFormEndToMiddle();
		await expect.element(bar()).not.toHaveAttribute('data-held');
		expect(bar().getBoundingClientRect().bottom).toBe(form().getBoundingClientRect().bottom);

		window.scrollTo(0, 0);
		await expect.element(bar()).toHaveAttribute('data-held');

		// Scrolled past, the bar leaves the screen with its form.
		window.scrollTo(0, document.documentElement.scrollHeight);
		expect(bar().getBoundingClientRect().bottom).toBeLessThan(0);
	});

	it('is held again after a jump from past its place to above it, which crosses neither edge of the screen', async () => {
		// From the page's top, where an earlier test's scroll can outlast its page.
		window.scrollTo(0, 0);
		await render(recipeForm(<p>3 to check</p>));
		await expect.element(bar()).toHaveAttribute('data-held');

		// Read down to its place and past it. Once the observer reports the form's end leaving across
		// the screen's top, the bar is held, where its look shows nothing off the screen.
		scrollFormEndToMiddle();
		await expect.element(bar()).not.toHaveAttribute('data-held');
		window.scrollTo(0, document.documentElement.scrollHeight);
		await expect.element(bar()).toHaveAttribute('data-held');
		expect(bar().getBoundingClientRect().bottom).toBeLessThan(0);

		// Back to the top in one scroll, as Home or a restored scroll moves, with the form's end on the
		// screen at no point between.
		window.scrollTo(0, 0);
		await expect.element(bar()).toHaveAttribute('data-held');
		expect(bar().getBoundingClientRect().bottom).toBe(window.innerHeight);
	});

	it('keeps its height on its form while it is shown, as it changes', async () => {
		const { rerender, unmount } = await render(recipeForm(<p>3 to check</p>));
		const recipe = form();
		const heightOnForm = () => recipe.style.getPropertyValue('--action-bar-height');

		await expect.poll(heightOnForm).toBe(`${bar().getBoundingClientRect().height}px`);
		const oneRow = heightOnForm();

		// A status too long for the row beside Save wraps the bar onto a second.
		await rerender(recipeForm(<p>Wait for the photos to finish uploading before you save.</p>));
		await expect.poll(heightOnForm).not.toBe(oneRow);
		expect(heightOnForm()).toBe(`${bar().getBoundingClientRect().height}px`);

		await unmount();
		expect(heightOnForm()).toBe('');
	});
});
