import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { OriginalRecipePane } from '@/components/recipe-form/original-recipe-pane';
import type { ShownImage } from '@/components/recipe/shown-recipe-image';
import { preferLessMotion } from '@/components/recipe/testing/less-motion';
import { centeredImageBox, expectImageIn } from '@/components/recipe/testing/viewer-layout';

// The reader's own setting unless a test asks for less motion.
vi.mock('@/lib/reduced-motion', { spy: true });

// A landscape card and a portrait page.
const frontSize = { width: 1600, height: 908 };
const backSize = { width: 2304, height: 3072 };
const pages: ShownImage[] = [
	{ pathname: 'scan/development/front.jpg', size: frontSize },
	{ pathname: 'scan/development/back.jpg', size: backSize },
];

async function renderPane(images: readonly ShownImage[] = pages) {
	await render(<OriginalRecipePane images={images} title="Original recipe" />);
	return page.getByRole('complementary', { name: 'Original recipe' });
}

describe('OriginalRecipePane', () => {
	it('shows a strip of the pages in their own shapes, the page shown marked', async () => {
		const pane = await renderPane();

		const thumbnails = pane.getByRole('button', { name: /^Show page/ }).elements();
		expect(
			thumbnails.map((thumbnail) => {
				const { width, height } = thumbnail.getBoundingClientRect();
				return {
					name: thumbnail.getAttribute('aria-label'),
					current: thumbnail.getAttribute('aria-current'),
					shape: width / height,
				};
			})
		).toEqual([
			{
				name: 'Show page 1 of 2',
				current: 'true',
				shape: expect.closeTo(frontSize.width / frontSize.height),
			},
			{
				name: 'Show page 2 of 2',
				current: null,
				shape: expect.closeTo(backSize.width / backSize.height),
			},
		]);

		await pane.getByRole('button', { name: 'Show page 2 of 2' }).click();

		await expect.element(pane.getByRole('status')).toHaveTextContent('Page 2 of 2');
		await expect.element(pane.getByRole('group', { name: 'Page 2 of 2' })).toBeVisible();
		await expect
			.element(pane.getByRole('button', { name: 'Show page 2 of 2' }))
			.toHaveAttribute('aria-current', 'true');
	});

	it('shows a lone page under the original’s name, with no strip', async () => {
		const pane = await renderPane(pages.slice(0, 1));

		await expect.element(pane.getByRole('group', { name: 'Original recipe' })).toBeVisible();
		await expect.element(pane.getByRole('button', { name: /^Show page/ })).not.toBeInTheDocument();
		await expect.element(pane.getByRole('status')).not.toBeInTheDocument();
	});

	it('zooms with its buttons and keys, pans while zoomed, and turns the page while it’s whole', async () => {
		preferLessMotion();
		const pane = await renderPane();
		const frame = pane.getByRole('group', { name: 'Page 1 of 2' });
		const whole = centeredImageBox(frame, frontSize);
		const zoomed = centeredImageBox(frame, frontSize, 1.5);

		await pane.getByRole('button', { name: 'Zoom in' }).click();
		await expectImageIn(frame, zoomed);
		await pane.getByRole('button', { name: 'Fit the whole image' }).click();
		await expectImageIn(frame, whole);

		await frame.click();
		await userEvent.keyboard('+');
		await expectImageIn(frame, zoomed);
		// An arrow moves the view 80 pixels, so the page the other way.
		await userEvent.keyboard('{ArrowLeft}');
		await expectImageIn(frame, { ...zoomed, left: zoomed.left + 80 });
		await expect.element(pane.getByRole('status')).toHaveTextContent('Page 1 of 2');

		await userEvent.keyboard('0');
		await expectImageIn(frame, whole);
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(pane.getByRole('status')).toHaveTextContent('Page 2 of 2');
	});

	it('shows each page whole when it is turned to', async () => {
		preferLessMotion();
		const pane = await renderPane();
		const front = pane.getByRole('group', { name: 'Page 1 of 2' });
		await front.click();
		await userEvent.keyboard('+');
		await expectImageIn(front, centeredImageBox(front, frontSize, 1.5));

		await pane.getByRole('button', { name: 'Show page 2 of 2' }).click();

		const back = pane.getByRole('group', { name: 'Page 2 of 2' });
		await expectImageIn(back, centeredImageBox(back, backSize));
		await expect.element(pane.getByText('100%')).toBeVisible();
	});
});
