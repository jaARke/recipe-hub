import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { OriginalRecipePane } from '@/components/recipe-form/original-recipe-pane';
import type { ShownImage } from '@/components/recipe/shown-recipe-image';
import { stubViewerLayout } from '@/components/recipe/testing/viewer-layout';

// A landscape card and a portrait page; the stubbed layout makes the frame, and each page whole in
// it, 400 by 300.
const pages: ShownImage[] = [
	{ pathname: 'scan/development/front.jpg', size: { width: 1600, height: 908 } },
	{ pathname: 'scan/development/back.jpg', size: { width: 2304, height: 3072 } },
];

let undoLayout = () => {};

afterEach(() => {
	undoLayout();
});

function renderPane(images: readonly ShownImage[] = pages) {
	undoLayout = stubViewerLayout();
	render(<OriginalRecipePane images={images} title="Original recipe" />);
	return screen.getByRole('complementary', { name: 'Original recipe' });
}

function pageTransform(pane: HTMLElement): string | undefined {
	return pane.querySelector<HTMLElement>('.react-transform-component')?.style.transform;
}

const whole = 'translate(0px, 0px) scale(1)';

// The keys and buttons animate the zoom, so a test waits for where it settles.
async function expectSettled(pane: HTMLElement, transform: string) {
	await waitFor(() => expect(pageTransform(pane)).toBe(transform));
}

describe('OriginalRecipePane', () => {
	it('shows a strip of the pages in their own shapes, the page shown marked', async () => {
		const user = userEvent.setup();
		const pane = renderPane();

		const thumbnails = within(pane).getAllByRole('button', { name: /^Show page/ });
		expect(
			thumbnails.map((thumbnail) => ({
				name: thumbnail.getAttribute('aria-label'),
				current: thumbnail.getAttribute('aria-current'),
				shape: thumbnail.style.getPropertyValue('--image-ratio'),
			}))
		).toEqual([
			{ name: 'Show page 1 of 2', current: 'true', shape: '1600 / 908' },
			{ name: 'Show page 2 of 2', current: null, shape: '2304 / 3072' },
		]);

		await user.click(within(pane).getByRole('button', { name: 'Show page 2 of 2' }));

		expect(within(pane).getByRole('status').textContent).toBe('Page 2 of 2');
		expect(within(pane).getByRole('group', { name: 'Page 2 of 2' })).toBeDefined();
		expect(
			within(pane).getByRole('button', { name: 'Show page 2 of 2' }).getAttribute('aria-current')
		).toBe('true');
	});

	it('shows a lone page under the original’s name, with no strip', () => {
		const pane = renderPane(pages.slice(0, 1));

		expect(within(pane).getByRole('group', { name: 'Original recipe' })).toBeDefined();
		expect(within(pane).queryByRole('button', { name: /^Show page/ })).toBeNull();
		expect(within(pane).queryByRole('status')).toBeNull();
	});

	it('zooms with its buttons and keys, pans while zoomed, and turns the page while it’s whole', async () => {
		const user = userEvent.setup();
		const pane = renderPane();

		// 150% about the frame's middle, (200, 150), puts the page's corner at 200 − 300 and 150 − 225.
		await user.click(within(pane).getByRole('button', { name: 'Zoom in' }));
		await expectSettled(pane, 'translate(-100px, -75px) scale(1.5)');
		await user.click(within(pane).getByRole('button', { name: 'Fit the whole image' }));
		await expectSettled(pane, whole);

		within(pane).getByRole('group', { name: 'Page 1 of 2' }).focus();
		await user.keyboard('+');
		await expectSettled(pane, 'translate(-100px, -75px) scale(1.5)');
		await user.keyboard('{ArrowLeft}');
		await expectSettled(pane, 'translate(-20px, -75px) scale(1.5)');
		expect(within(pane).getByRole('status').textContent).toBe('Page 1 of 2');

		await user.keyboard('0');
		await expectSettled(pane, whole);
		await user.keyboard('{ArrowRight}');
		expect(within(pane).getByRole('status').textContent).toBe('Page 2 of 2');
	});

	it('shows each page whole when it is turned to', async () => {
		const user = userEvent.setup();
		const pane = renderPane();
		within(pane).getByRole('group', { name: 'Page 1 of 2' }).focus();
		await user.keyboard('+');
		await expectSettled(pane, 'translate(-100px, -75px) scale(1.5)');

		await user.click(within(pane).getByRole('button', { name: 'Show page 2 of 2' }));

		await expectSettled(pane, whole);
		expect(within(pane).getByText('100%')).toBeDefined();
	});
});
