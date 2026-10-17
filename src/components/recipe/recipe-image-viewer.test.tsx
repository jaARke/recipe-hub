import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page, server, userEvent, type Locator } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
	replaceRecipeImageViewerBodyImport,
} from '@/components/recipe/recipe-image-viewer';
import * as viewerBody from '@/components/recipe/recipe-image-viewer-body';
import type { ShownImage } from '@/components/recipe/shown-recipe-image';
import {
	centeredImageBox,
	expectImageIn,
	frameSize,
} from '@/components/recipe/testing/viewer-layout';
import { settings } from '@/lib/settings';

// Portrait, as a phone's frame is: each photo fills the frame's width, and zoomed in it overflows the
// frame both ways.
const photoSize = { width: 1200, height: 1600 };

const photos: ShownImage[] = [
	{ pathname: 'dish/seed/soup.jpg', alt: 'Soup in a bowl', size: photoSize },
	{ pathname: 'dish/seed/bread.jpg', alt: 'Bread on a board', size: photoSize },
	{ pathname: 'dish/seed/salad.jpg', alt: 'Salad', size: photoSize },
];

afterEach(() => {
	replaceRecipeImageViewerBodyImport();
	vi.restoreAllMocks();
});

function photoViewer(images: readonly ShownImage[] = photos) {
	return (
		<RecipeImageViewer role="dish" title="Weeknight chicken soup" images={images}>
			{images.map((photo, index) => (
				<RecipeImageViewerTrigger key={photo.pathname} index={index} className="w-24">
					{photo.alt}
				</RecipeImageViewerTrigger>
			))}
		</RecipeImageViewer>
	);
}

function viewer() {
	return page.getByRole('dialog', { name: 'Weeknight chicken soup' });
}

async function openViewer(pressed = 'View photo 1 of 3: Soup in a bowl', images = photos) {
	const screen = await render(photoViewer(images));
	await page.getByRole('button', { name: pressed }).click();
	// Once the body has arrived and focused the button that moves on, where the viewer's keys reach.
	await expect.element(viewer().getByRole('button', { name: 'Next photo' })).toHaveFocus();
	return screen;
}

// A screen of the size given for this test alone, as the tests after it lay out at the project's.
async function resizeScreen(width: number, height: number) {
	const { viewport } = server.config.browser;
	onTestFinished(() => page.viewport(viewport.width, viewport.height));
	await page.viewport(width, height);
}

// The caption announces the photo's place and its description.
function caption() {
	return viewer().getByRole('status');
}

// The frame the zoom draws a photo in, inside the slide that shares its name.
function photoFrame(place: string) {
	return viewer().getByRole('group', { name: place }).last();
}

// On a phone the zoom's buttons sit by the caption, and the title bar's are hidden.
function zoomButton(name: string) {
	return viewer().getByRole('button', { name });
}

// The body fetched afresh, arriving only when the test lets it, with each fetch counted.
function holdBody() {
	const arrival = Promise.withResolvers<void>();
	const delivered = arrival.promise.then(() => viewerBody);
	const fetches = vi.fn(() => delivered);
	replaceRecipeImageViewerBodyImport(fetches);
	return {
		fetches,
		// Lets the body arrive, and waits until the viewer, which asked for it first, has taken it.
		async arrive() {
			arrival.resolve();
			await delivered;
		},
	};
}

// The page as it loads, before its load event, so only a reader's approach fetches the body.
function pageStillLoading() {
	vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
}

// To the screen's far corner, clear of the triggers: a trigger that appears under the pointer, where
// an earlier test left it, is told the pointer entered.
async function movePointerAway() {
	await page
		.elementLocator(document.documentElement)
		.hover({ position: { x: window.innerWidth - 1, y: window.innerHeight - 1 } });
}

// The idle browser's callbacks, for the test to run: Chromium under test can go without idle time for
// seconds once it has taken input, and WebKit has no idle callbacks.
function holdIdleCallbacks(): (() => void)[] {
	const callbacks: (() => void)[] = [];
	vi.stubGlobal('requestIdleCallback', (callback: () => void) => callbacks.push(callback));
	vi.stubGlobal('cancelIdleCallback', () => {});
	// Unmounted first, so the viewer cancels its idle callback while the stub is in place.
	onTestFinished(async () => {
		await cleanup();
		vi.unstubAllGlobals();
	});
	return callbacks;
}

// Keeps the viewer on screen as it closes by pausing its closing animation, until the function
// returned plays it on.
function holdClosingAnimation(popup: HTMLElement | SVGElement): () => void {
	popup.style.animationPlayState = 'paused';
	return () => {
		popup.style.animationPlayState = '';
	};
}

// Counts the spinners added to the page from now on, until the function returned is called.
function watchForSpinners(): () => number {
	let added = 0;
	const countSpinners = (records: MutationRecord[]) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node instanceof Element && node.querySelector('[data-slot="spinner"]') !== null) {
					added += 1;
				}
			}
		}
	};
	const observer = new MutationObserver(countSpinners);
	observer.observe(document.body, { childList: true, subtree: true });
	return () => {
		countSpinners(observer.takeRecords());
		observer.disconnect();
		return added;
	};
}

// A drag across the frame from near its right edge to near its left, as a swipe to the next image
// would go.
async function dragLeft(frame: Locator) {
	const { width, height } = frameSize(frame);
	await frame.dropTo(frame, {
		sourcePosition: { x: width - 16, y: height / 2 },
		targetPosition: { x: 16, y: height / 2 },
		steps: 8,
	});
}

describe('RecipeImageViewer', () => {
	it('opens at the image pressed, on the button that moves on, and gives focus back on Escape', async () => {
		await openViewer('View photo 2 of 3: Bread on a board');

		await expect.element(caption()).toHaveTextContent('Photo 2 of 3. Bread on a board');
		await expect.element(viewer().getByRole('button', { name: 'Next photo' })).toHaveFocus();

		await userEvent.keyboard('{Escape}');

		await expect.element(viewer()).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' }))
			.toHaveFocus();
	});

	it('closes as its page hides, and opens again at the image pressed next', async () => {
		const keptPage = await renderKeptPage(photoViewer());
		const trigger = page.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' });

		await trigger.click();
		await expect.element(viewer().getByRole('region', { name: 'Photos' })).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect.element(viewer()).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'View photo 3 of 3: Salad' }).click();
		await expect.element(caption()).toHaveTextContent('Photo 3 of 3. Salad');
	});

	it('zooms with + and −, about the frame’s middle, and fits with 0', async () => {
		await openViewer();
		const frame = photoFrame('Photo 1 of 3');
		const whole = centeredImageBox(frame, photoSize);
		await expectImageIn(frame, whole);
		await expect.element(zoomButton('Zoom out')).toHaveAttribute('aria-disabled', 'true');

		await userEvent.keyboard('+');
		await expectImageIn(frame, centeredImageBox(frame, photoSize, 1.5));
		await expect.element(zoomButton('Zoom out')).toHaveAttribute('aria-disabled', 'false');

		await userEvent.keyboard('-');
		await expectImageIn(frame, whole);

		await userEvent.keyboard('+');
		await expectImageIn(frame, centeredImageBox(frame, photoSize, 1.5));
		await userEvent.keyboard('+');
		await expectImageIn(frame, centeredImageBox(frame, photoSize, 2));

		await userEvent.keyboard('0');
		await expectImageIn(frame, whole);
	});

	it('pans a zoomed image with the arrows, as far as its edges, and moves between images while it’s whole', async () => {
		await openViewer();
		const frame = photoFrame('Photo 1 of 3');
		const inside = frameSize(frame);
		const zoomed = centeredImageBox(frame, photoSize, 1.5);
		await userEvent.keyboard('+');
		await expectImageIn(frame, zoomed);

		// An arrow moves the view 80 pixels, so the image the other way, until its edge meets the frame's.
		await userEvent.keyboard('{ArrowRight}');
		await expectImageIn(frame, { ...zoomed, left: zoomed.left - 80 });
		await userEvent.keyboard('{ArrowRight}');
		const atRightEdge = { ...zoomed, left: inside.width - zoomed.width };
		await expectImageIn(frame, atRightEdge);
		await userEvent.keyboard('{ArrowDown}');
		await expectImageIn(frame, { ...atRightEdge, top: inside.height - zoomed.height });
		await expect.element(caption()).toHaveTextContent('Photo 1 of 3. Soup in a bowl');

		await userEvent.keyboard('0');
		await expectImageIn(frame, centeredImageBox(frame, photoSize));
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(caption()).toHaveTextContent('Photo 2 of 3. Bread on a board');
		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(caption()).toHaveTextContent('Photo 1 of 3. Soup in a bowl');
	});

	it('zooms to 250% at the point double clicked, and back', async () => {
		await openViewer();
		const frame = photoFrame('Photo 1 of 3');
		const whole = centeredImageBox(frame, photoSize);
		// About a quarter of the way across the image and down it, on the whole pixels a browser reports
		// a mouse at.
		const origin = frame.element().getBoundingClientRect();
		const point = {
			x: Math.round(origin.left + whole.left + whole.width / 4) - origin.left,
			y: Math.round(origin.top + whole.top + whole.height / 4) - origin.top,
		};

		await frame.dblClick({ position: point });
		// The point stays under the pointer.
		await expectImageIn(frame, {
			left: point.x - (point.x - whole.left) * 2.5,
			top: point.y - (point.y - whole.top) * 2.5,
			width: whole.width * 2.5,
			height: whole.height * 2.5,
		});

		await frame.dblClick({ position: point });
		await expectImageIn(frame, whole);
	});

	it('zooms with the wheel only while Ctrl or Cmd is held, as a trackpad’s pinch is', async () => {
		await openViewer();
		const frame = photoFrame('Photo 1 of 3');

		await frame.wheel({ delta: { y: -100 } });
		await expectImageIn(frame, centeredImageBox(frame, photoSize));

		await userEvent.keyboard('{Control>}');
		await frame.wheel({ delta: { y: -100 } });
		await userEvent.keyboard('{/Control}');

		await expect.element(zoomButton('Zoom out')).toHaveAttribute('aria-disabled', 'false');
	});

	it('swipes to the next image only while the image is whole; zoomed, a drag pans it', async () => {
		await openViewer();

		await dragLeft(photoFrame('Photo 1 of 3'));
		await expect.element(caption()).toHaveTextContent('Photo 2 of 3. Bread on a board');

		const frame = photoFrame('Photo 2 of 3');
		const zoomed = centeredImageBox(frame, photoSize, 1.5);
		await userEvent.keyboard('+');
		await expectImageIn(frame, zoomed);
		await dragLeft(frame);

		// As far as the image's right edge allows.
		await expectImageIn(frame, { ...zoomed, left: frameSize(frame).width - zoomed.width });
		await expect.element(caption()).toHaveTextContent('Photo 2 of 3. Bread on a board');
	});

	it('centers the strip of thumbnails from sm only while the row fits, so an overflowing row starts at its first', async () => {
		await resizeScreen(1024, 768);
		const { rerender } = await openViewer();
		const strip = viewer().getByRole('list');
		// The room before the first thumbnail and after the last, inside the row.
		const margins = () => {
			const row = strip.element().getBoundingClientRect();
			const thumbnails = strip.getByRole('button');
			return {
				start: thumbnails.first().element().getBoundingClientRect().left - row.left,
				end: row.right - thumbnails.last().element().getBoundingClientRect().right,
			};
		};
		expect(margins().start).toBeCloseTo(margins().end, 0);

		await rerender(
			photoViewer(
				Array.from({ length: 40 }, (_, index) => ({
					pathname: `dish/seed/dish-${index + 1}.jpg`,
					alt: `Dish ${index + 1}`,
					size: photoSize,
				}))
			)
		);

		await expect
			.element(strip.getByRole('button', { name: 'Show photo 40 of 40' }))
			.toBeInTheDocument();
		expect(margins().start).toBeGreaterThanOrEqual(0);
		expect(margins().end).toBeLessThan(0);
	});

	it('scrolls a description longer than its box inside the box, which then takes keyboard focus', async () => {
		// As long as a description may be.
		const longDescription = 'Slices of roast on a platter with carrots and onions, gravy beside. '
			.repeat(15)
			.slice(0, settings.recipeLimits.maxImageAltLength);
		const roast: ShownImage = {
			pathname: 'dish/seed/roast.jpg',
			alt: longDescription,
			size: photoSize,
		};
		await openViewer('View photo 2 of 3: Bread on a board', [roast, ...photos.slice(1)]);
		const description = viewer().getByRole('group', { name: 'Photo description' });
		await expect.element(description).not.toBeInTheDocument();

		await viewer().getByRole('button', { name: 'Show photo 1 of 3' }).click();

		await expect.element(caption()).toHaveTextContent(`Photo 1 of 3. ${longDescription}`);
		await expect.element(description).toHaveAttribute('tabindex', '0');
		// No taller than a quarter of the screen, with the text running on past it.
		const { clientHeight, scrollHeight } = description.element();
		expect(clientHeight).toBeLessThanOrEqual(window.innerHeight / 4);
		expect(scrollHeight).toBeGreaterThan(clientHeight);

		await viewer().getByRole('button', { name: 'Show photo 3 of 3' }).click();
		await expect.element(description).not.toBeInTheDocument();
	});

	it('shows each image whole when it is moved to, the one zoomed in on included', async () => {
		await openViewer();
		const first = photoFrame('Photo 1 of 3');
		await userEvent.keyboard('+');
		await expectImageIn(first, centeredImageBox(first, photoSize, 1.5));
		// Moved from while the zoom is still under way.
		await userEvent.keyboard('+');

		await viewer().getByRole('button', { name: 'Show photo 3 of 3' }).click();
		await expect.element(caption()).toHaveTextContent('Photo 3 of 3. Salad');
		const third = photoFrame('Photo 3 of 3');
		await expectImageIn(third, centeredImageBox(third, photoSize));

		await viewer().getByRole('button', { name: 'Show photo 1 of 3' }).click();
		await expectImageIn(first, centeredImageBox(first, photoSize));
		await expect
			.element(viewer().getByRole('button', { name: 'Show photo 1 of 3' }))
			.toHaveAttribute('aria-current', 'true');
	});
});

describe('RecipeImageViewer’s body, which loads on demand', () => {
	it('shows a labelled spinner while the body loads, and moves focus to the button that moves on as it arrives', async () => {
		const body = holdBody();
		await render(photoViewer());

		await page.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' }).click();

		await expect
			.element(viewer().getByRole('status', { name: 'Loading the photos' }))
			.toBeVisible();
		// Close alone: the arrows and the zoom come with the body.
		await expect.element(viewer().getByRole('button')).toHaveAccessibleName('Close');
		await expect.element(viewer()).toHaveFocus();
		// Focus the reader moves within the viewer goes to the button all the same.
		await userEvent.tab();
		await expect.element(viewer().getByRole('button', { name: 'Close' })).toHaveFocus();
		const popup = viewer().element();

		await body.arrive();

		await expect.element(viewer().getByRole('button', { name: 'Next photo' })).toHaveFocus();
		await expect
			.element(viewer().getByRole('status', { name: 'Loading the photos' }))
			.not.toBeInTheDocument();
		await expect.element(caption()).toHaveTextContent('Photo 2 of 3. Bread on a board');
		expect(viewer().element()).toBe(popup);
	});

	it('shows the title bar with Close while the body loads, which closes the viewer and gives focus back', async () => {
		holdBody();
		await render(photoViewer());
		const trigger = page.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' });

		await trigger.click();
		await expect.element(viewer().getByRole('heading')).toHaveTextContent('Weeknight chicken soup');
		await expect.element(viewer().getByText('Photo 2 of 3')).toBeVisible();
		await viewer().getByRole('button', { name: 'Close' }).click();

		await expect.element(viewer()).not.toBeInTheDocument();
		await expect.element(trigger).toHaveFocus();
	});

	it('gives focus back on Escape while the body loads, and leaves it there when the body arrives as the viewer closes', async () => {
		const body = holdBody();
		await render(photoViewer());
		const trigger = page.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' });
		await trigger.click();
		await expect.element(viewer()).toHaveFocus();
		const popup = viewer().element();
		const closed = holdClosingAnimation(popup);

		await userEvent.keyboard('{Escape}');
		await expect.element(popup).toHaveAttribute('data-closed');
		await body.arrive();

		await expect
			.element(
				page.elementLocator(popup).getByRole('button', { name: 'Next photo', includeHidden: true })
			)
			.toBeInTheDocument();
		expect(document.activeElement).toBe(popup);
		closed();
		await expect.element(viewer()).not.toBeInTheDocument();
		await expect.element(trigger).toHaveFocus();
	});

	it('opens at once, with no loading state, when the body has arrived beforehand', async () => {
		const body = holdBody();
		await render(photoViewer());
		const trigger = page.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' });
		await trigger.hover();
		await body.arrive();
		const spinners = watchForSpinners();

		await trigger.click();

		await expect.element(viewer().getByRole('button', { name: 'Next photo' })).toHaveFocus();
		expect(spinners()).toBe(0);
	});

	it.each([
		['hovered', (trigger: Locator) => trigger.hover()],
		['focused', () => userEvent.tab()],
	])('fetches the body when a trigger is first %s, and not again', async (_approach, approach) => {
		pageStillLoading();
		await movePointerAway();
		const body = holdBody();
		await render(photoViewer());
		expect(body.fetches).not.toHaveBeenCalled();

		await approach(page.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' }));
		await expect.poll(() => body.fetches).toHaveBeenCalledOnce();

		await page.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' }).hover();
		await userEvent.tab();
		expect(body.fetches).toHaveBeenCalledOnce();
	});

	it('fetches the body once the page has loaded and the browser is idle', async () => {
		pageStillLoading();
		const idleCallbacks = holdIdleCallbacks();
		await movePointerAway();
		const body = holdBody();
		await render(photoViewer());
		expect(idleCallbacks).toHaveLength(0);

		window.dispatchEvent(new Event('load'));
		expect(idleCallbacks).toHaveLength(1);
		expect(body.fetches).not.toHaveBeenCalled();

		for (const callback of idleCallbacks) {
			callback();
		}
		expect(body.fetches).toHaveBeenCalledOnce();
	});
});
