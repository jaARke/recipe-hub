import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import type { ShownImage } from '@/components/recipe/shown-recipe-image';
import { stubbedFrame, stubViewerLayout } from '@/components/recipe/testing/viewer-layout';
import { settings } from '@/lib/settings';

// The stubbed layout makes every frame, and every image whole in it, 400 by 300.
const photos: ShownImage[] = [
	{ pathname: 'dish/seed/soup.jpg', alt: 'Soup in a bowl', size: { width: 1600, height: 1200 } },
	{ pathname: 'dish/seed/bread.jpg', alt: 'Bread on a board', size: { width: 1600, height: 1200 } },
	{ pathname: 'dish/seed/salad.jpg', alt: 'Salad', size: { width: 1600, height: 1200 } },
];

const bodyModulePath = '@/components/recipe/recipe-image-viewer-body';

let undoLayout = () => {};
let letBodyArrive = () => {};
// The fresh viewer's body as it loads, once a test has asked for it.
let bodyLoaded: Promise<unknown> = Promise.resolve();

afterEach(async () => {
	// Unmounts ahead of the setup file's cleanup, while the idle callback the viewer cancels is still
	// stubbed.
	cleanup();
	undoLayout();
	letBodyArrive();
	// A body still loading as its test ends finishes first, so it never lands among the modules the
	// next test loads afresh.
	await bodyLoaded;
	bodyLoaded = Promise.resolve();
	vi.doUnmock(bodyModulePath);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function renderPhotoViewer(
	Viewer: typeof RecipeImageViewer,
	Trigger: typeof RecipeImageViewerTrigger,
	images: readonly ShownImage[] = photos
) {
	undoLayout = stubViewerLayout();
	render(
		<Viewer role="dish" title="Weeknight chicken soup" images={images}>
			{images.map((photo, index) => (
				<Trigger key={photo.pathname} index={index} className="w-24">
					{photo.alt}
				</Trigger>
			))}
		</Viewer>
	);
}

async function openViewer(pressed = 'View photo 1 of 3: Soup in a bowl') {
	const user = userEvent.setup();
	renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
	await user.click(screen.getByRole('button', { name: pressed }));
	const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
	// The first viewer opened in this file waits for its body to load.
	await within(viewer).findByRole('region', { name: 'Photos' });
	return { user, viewer };
}

// Dispatches where the viewer may suspend, in an act that is awaited: user-event's own act is not, and
// React drops a render that suspends in one.
async function dispatchInAct(dispatch: () => void) {
	await act(async () => {
		dispatch();
	});
}

// Lets the body the fresh viewer asked for arrive, and waits for the viewer to take it.
async function bodyArrives() {
	await act(async () => {
		letBodyArrive();
		await import(bodyModulePath);
	});
}

// Keeps the viewer on screen as it closes, as its animation does, until the function returned ends it.
function holdClosingAnimation(viewer: HTMLElement): () => void {
	const closing = Promise.withResolvers<void>();
	const animation = {
		finished: closing.promise,
		effect: { getTiming: () => ({ duration: 100, iterations: 1 }) },
	};
	viewer.getAnimations = () => [animation] as unknown as Animation[];
	return () => closing.resolve();
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

// The viewer from modules loaded afresh, so its body has yet to be fetched, with a body that arrives
// only when the test lets it. Counts each fetch of the body; the idle browser never calls back.
async function freshViewer() {
	vi.resetModules();
	const arrival = Promise.withResolvers<void>();
	letBodyArrive = () => arrival.resolve();
	const fetchBody = vi.fn();
	vi.doMock(bodyModulePath, (importOriginal) => {
		fetchBody();
		bodyLoaded = arrival.promise.then(importOriginal);
		return bodyLoaded;
	});
	const idleCallbacks: (() => void)[] = [];
	vi.stubGlobal('requestIdleCallback', (callback: () => void) => idleCallbacks.push(callback));
	vi.stubGlobal('cancelIdleCallback', () => {});
	const viewer = await import('@/components/recipe/recipe-image-viewer');
	return { ...viewer, fetchBody, idleCallbacks };
}

// Lays text out a pixel tall for each of its characters, in boxes at most 200 pixels tall, so the
// caption's text runs past its box when it is longer than that. Frames keep the viewer's layout.
function stubTextHeights() {
	const textHeight = (element: HTMLElement) => element.textContent?.length ?? 0;
	vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		return textHeight(this);
	});
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		return this.classList.contains('react-transform-wrapper')
			? stubbedFrame.height
			: Math.min(textHeight(this), 200);
	});
}

// The image shown, which alone of the slides can be reached.
function shownSlide(viewer: HTMLElement): HTMLElement {
	const slide = viewer.querySelector<HTMLElement>('[data-slot="carousel-item"]:not([inert])');
	if (slide === null) {
		throw new Error('No slide is shown');
	}
	return slide;
}

// Where the image shown is and how large, as the zoom draws it.
function shownTransform(viewer: HTMLElement): string {
	return shownSlide(viewer).querySelector<HTMLElement>('.react-transform-component')?.style
		.transform as string;
}

function shownFrame(viewer: HTMLElement): HTMLElement {
	return within(shownSlide(viewer)).getByRole('group', { name: /^Photo/ });
}

// The title bar's; the same controls sit by the caption on phones, and CSS shows one set.
function zoomButton(viewer: HTMLElement, name: string): HTMLElement {
	const [button] = within(viewer).getAllByRole('button', { name });
	if (button === undefined) {
		throw new Error(`No ${name} button`);
	}
	return button;
}

// The caption announces the image's place and its description.
function caption(viewer: HTMLElement): string | null {
	return within(viewer).getByRole('status').textContent;
}

// One notch of a mouse's wheel toward the reader, over the frame's middle. happy-dom's wheel events
// are not mouse events, so the pointer and the key a browser's would carry are added.
function turnWheel(frame: HTMLElement, { ctrlKey }: { ctrlKey: boolean }) {
	const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		clientX: { value: 200 },
		clientY: { value: 150 },
		ctrlKey: { value: ctrlKey },
	});
	act(() => {
		frame.dispatchEvent(event);
	});
}

// A mouse drag across the image shown from right to left, as a swipe to the next image would go.
function dragLeft(viewer: HTMLElement) {
	const frame = shownFrame(viewer);
	fireEvent.mouseDown(frame, { button: 0, buttons: 1, clientX: 350, clientY: 150 });
	for (const clientX of [300, 250, 200, 150, 100, 50]) {
		fireEvent.mouseMove(frame, { buttons: 1, clientX, clientY: 150 });
	}
	fireEvent.mouseUp(frame, { clientX: 50, clientY: 150 });
}

const whole = 'translate(0px, 0px) scale(1)';

// The keys and buttons animate the zoom, so a test waits for where it settles.
async function expectSettled(viewer: HTMLElement, transform: string) {
	await waitFor(() => expect(shownTransform(viewer)).toBe(transform));
}

describe('RecipeImageViewer', () => {
	it('opens at the image pressed, on the button that moves on, and gives focus back on Escape', async () => {
		const { user, viewer } = await openViewer('View photo 2 of 3: Bread on a board');

		expect(caption(viewer)).toBe('Photo 2 of 3. Bread on a board');
		expect(document.activeElement).toBe(within(viewer).getByRole('button', { name: 'Next photo' }));

		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' })
		);
	});

	it('zooms with + and −, about the frame’s middle, and fits with 0', async () => {
		const { user, viewer } = await openViewer();
		const zoomOut = zoomButton(viewer, 'Zoom out');
		expect(shownTransform(viewer)).toBe(whole);
		expect(zoomOut.getAttribute('aria-disabled')).toBe('true');

		// 150% about the middle, (200, 150), puts the image's corner at 200 − 300 and 150 − 225.
		await user.keyboard('+');
		await expectSettled(viewer, 'translate(-100px, -75px) scale(1.5)');
		expect(zoomOut.getAttribute('aria-disabled')).toBe('false');

		await user.keyboard('-');
		await expectSettled(viewer, whole);

		await user.keyboard('+');
		await expectSettled(viewer, 'translate(-100px, -75px) scale(1.5)');
		await user.keyboard('+');
		await expectSettled(viewer, 'translate(-200px, -150px) scale(2)');

		await user.keyboard('0');
		await expectSettled(viewer, whole);
	});

	it('pans a zoomed image with the arrows, as far as its edges, and moves between images while it’s whole', async () => {
		const { user, viewer } = await openViewer();
		await user.keyboard('+');
		await expectSettled(viewer, 'translate(-100px, -75px) scale(1.5)');

		await user.keyboard('{ArrowRight}');
		await expectSettled(viewer, 'translate(-180px, -75px) scale(1.5)');
		// At 150% the image is 600 by 450, so its corner goes no further than 400 − 600 and 300 − 450.
		await user.keyboard('{ArrowRight}');
		await expectSettled(viewer, 'translate(-200px, -75px) scale(1.5)');
		await user.keyboard('{ArrowDown}');
		await expectSettled(viewer, 'translate(-200px, -150px) scale(1.5)');
		expect(caption(viewer)).toBe('Photo 1 of 3. Soup in a bowl');

		await user.keyboard('0');
		await expectSettled(viewer, whole);
		await user.keyboard('{ArrowRight}');
		expect(caption(viewer)).toBe('Photo 2 of 3. Bread on a board');
		await user.keyboard('{ArrowLeft}');
		expect(caption(viewer)).toBe('Photo 1 of 3. Soup in a bowl');
	});

	it('zooms to 250% at the point double clicked, and back', async () => {
		const { viewer } = await openViewer();

		// The point (100, 100) stays put: the corner moves to 100 − 250 on each side.
		fireEvent.dblClick(shownFrame(viewer), { clientX: 100, clientY: 100 });
		await expectSettled(viewer, 'translate(-150px, -150px) scale(2.5)');

		fireEvent.dblClick(shownFrame(viewer), { clientX: 100, clientY: 100 });
		await expectSettled(viewer, whole);
	});

	it('zooms with the wheel only while Ctrl or Cmd is held, as a trackpad’s pinch is', async () => {
		const { viewer } = await openViewer();

		turnWheel(shownFrame(viewer), { ctrlKey: false });
		expect(shownTransform(viewer)).toBe(whole);

		turnWheel(shownFrame(viewer), { ctrlKey: true });
		await waitFor(() =>
			expect(zoomButton(viewer, 'Zoom out').getAttribute('aria-disabled')).toBe('false')
		);
		expect(shownTransform(viewer)).toMatch(/ scale\(2\.5\)$/);
	});

	it('swipes to the next image only while the image is whole; zoomed, a drag pans it', async () => {
		const { user, viewer } = await openViewer();

		dragLeft(viewer);
		await waitFor(() => expect(caption(viewer)).toBe('Photo 2 of 3. Bread on a board'));

		await user.keyboard('+');
		await expectSettled(viewer, 'translate(-100px, -75px) scale(1.5)');
		dragLeft(viewer);

		// Dragged 300 pixels left, as far as the image's right edge allows.
		await expectSettled(viewer, 'translate(-200px, -75px) scale(1.5)');
		expect(caption(viewer)).toBe('Photo 2 of 3. Bread on a board');
	});

	it('centers the strip of thumbnails from sm only while the row fits, so an overflowing row starts at its first', async () => {
		const { viewer } = await openViewer();

		const strip = within(viewer).getByRole('list');
		expect(within(strip).getAllByRole('button')).toHaveLength(3);
		expect(strip.className.split(' ')).toContain('sm:justify-center-safe');
		expect(strip.className.split(' ')).not.toContain('sm:justify-center');
	});

	it('scrolls a description longer than its box inside the box, which then takes keyboard focus', async () => {
		// As long as a description may be.
		const longDescription = 'Slices of roast on a platter with carrots and onions, gravy beside. '
			.repeat(15)
			.slice(0, settings.recipeLimits.maxImageAltLength);
		const roast: ShownImage = {
			pathname: 'dish/seed/roast.jpg',
			alt: longDescription,
			size: { width: 1600, height: 1200 },
		};
		const user = userEvent.setup();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger, [roast, ...photos.slice(1)]);
		stubTextHeights();
		await user.click(screen.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' }));
		const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
		await within(viewer).findByRole('region', { name: 'Photos' });
		expect(within(viewer).queryByRole('group', { name: 'Photo description' })).toBeNull();

		await user.click(within(viewer).getByRole('button', { name: 'Show photo 1 of 3' }));

		const description = within(viewer).getByRole('group', { name: 'Photo description' });
		expect(caption(viewer)).toBe(`Photo 1 of 3. ${longDescription}`);
		expect(description.tabIndex).toBe(0);
		expect(description.className.split(' ')).toEqual(
			expect.arrayContaining(['overflow-y-auto', 'max-h-[25dvh]'])
		);

		await user.click(within(viewer).getByRole('button', { name: 'Show photo 3 of 3' }));
		expect(within(viewer).queryByRole('group', { name: 'Photo description' })).toBeNull();
	});

	it('shows each image whole when it is moved to, the one zoomed in on included', async () => {
		const { user, viewer } = await openViewer();
		await user.keyboard('+');
		await expectSettled(viewer, 'translate(-100px, -75px) scale(1.5)');
		// Moved from while the zoom is still under way.
		await user.keyboard('+');

		await user.click(within(viewer).getByRole('button', { name: 'Show photo 3 of 3' }));
		expect(caption(viewer)).toBe('Photo 3 of 3. Salad');
		await expectSettled(viewer, whole);

		await user.click(within(viewer).getByRole('button', { name: 'Show photo 1 of 3' }));
		await expectSettled(viewer, whole);
		expect(
			within(viewer).getByRole('button', { name: 'Show photo 1 of 3' }).getAttribute('aria-current')
		).toBe('true');
	});
});

describe('RecipeImageViewer’s body, which loads on demand', () => {
	it('shows a labelled spinner while the body loads, and moves focus to the button that moves on as it arrives', async () => {
		const { RecipeImageViewer, RecipeImageViewerTrigger } = await freshViewer();
		const user = userEvent.setup();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
		const trigger = screen.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' });

		await dispatchInAct(() => fireEvent.click(trigger));
		const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
		expect(within(viewer).getByRole('status', { name: 'Loading the photos' })).toBeDefined();
		expect(
			within(viewer)
				.getAllByRole('button')
				.map((button) => button.textContent)
		).toEqual(['Close']);
		await waitFor(() => expect(document.activeElement).toBe(viewer));

		await bodyArrives();

		const next = within(viewer).getByRole('button', { name: 'Next photo' });
		expect(document.activeElement).toBe(next);
		expect(within(viewer).queryByRole('status', { name: 'Loading the photos' })).toBeNull();
		expect(caption(viewer)).toBe('Photo 2 of 3. Bread on a board');
		expect(screen.getByRole('dialog', { name: 'Weeknight chicken soup' })).toBe(viewer);

		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(document.activeElement).toBe(trigger);
	});

	it('shows the title bar with Close while the body loads, which closes the viewer and gives focus back', async () => {
		const { RecipeImageViewer, RecipeImageViewerTrigger } = await freshViewer();
		const user = userEvent.setup();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
		const trigger = screen.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' });

		await dispatchInAct(() => fireEvent.click(trigger));
		const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
		expect(within(viewer).getByRole('heading').textContent).toBe('Weeknight chicken soup');
		expect(within(viewer).getByText('Photo 2 of 3')).toBeDefined();
		await user.click(within(viewer).getByRole('button', { name: 'Close' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(document.activeElement).toBe(trigger);
	});

	it('moves focus from Close to the button that moves on when the body arrives', async () => {
		const { RecipeImageViewer, RecipeImageViewerTrigger } = await freshViewer();
		const user = userEvent.setup();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);

		await dispatchInAct(() =>
			fireEvent.click(screen.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' }))
		);
		const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
		await waitFor(() => expect(document.activeElement).toBe(viewer));
		await user.tab();
		expect(document.activeElement).toBe(within(viewer).getByRole('button', { name: 'Close' }));

		await bodyArrives();

		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(viewer).getByRole('button', { name: 'Next photo' })
			)
		);
	});

	it('gives focus back on Escape while the body loads, and leaves it there when the body arrives as the viewer closes', async () => {
		const { RecipeImageViewer, RecipeImageViewerTrigger } = await freshViewer();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
		const trigger = screen.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' });

		await dispatchInAct(() => fireEvent.click(trigger));
		const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
		await waitFor(() => expect(document.activeElement).toBe(viewer));
		const closed = holdClosingAnimation(viewer);

		await dispatchInAct(() => fireEvent.keyDown(viewer, { key: 'Escape' }));
		expect(viewer.hasAttribute('data-closed')).toBe(true);
		await bodyArrives();

		expect(within(viewer).getByRole('button', { name: 'Next photo', hidden: true })).toBeDefined();
		expect(document.activeElement).toBe(viewer);
		closed();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(document.activeElement).toBe(trigger);
	});

	it('opens at once, with no loading state, when the body has arrived beforehand', async () => {
		const { RecipeImageViewer, RecipeImageViewerTrigger } = await freshViewer();
		const user = userEvent.setup();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
		const trigger = screen.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' });
		await user.hover(trigger);
		await bodyArrives();
		const spinners = watchForSpinners();

		await dispatchInAct(() => fireEvent.click(trigger));

		const viewer = screen.getByRole('dialog', { name: 'Weeknight chicken soup' });
		expect(spinners()).toBe(0);
		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(viewer).getByRole('button', { name: 'Next photo' })
			)
		);
	});

	it.each([
		['hovered', (user: UserEvent, trigger: HTMLElement) => user.hover(trigger)],
		['focused', (user: UserEvent) => user.tab()],
		[
			'touched',
			(user: UserEvent, trigger: HTMLElement) =>
				user.pointer({ keys: '[TouchA>]', target: trigger }),
		],
	])('fetches the body when a trigger is first %s, and not again', async (_approach, approach) => {
		const { RecipeImageViewer, RecipeImageViewerTrigger, fetchBody } = await freshViewer();
		const user = userEvent.setup();
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
		expect(fetchBody).not.toHaveBeenCalled();

		await approach(user, screen.getByRole('button', { name: 'View photo 1 of 3: Soup in a bowl' }));
		await waitFor(() => expect(fetchBody).toHaveBeenCalledTimes(1));

		await user.hover(screen.getByRole('button', { name: 'View photo 2 of 3: Bread on a board' }));
		await user.tab();
		expect(fetchBody).toHaveBeenCalledTimes(1);
	});

	it('fetches the body once the page has loaded and the browser is idle', async () => {
		const { RecipeImageViewer, RecipeImageViewerTrigger, fetchBody, idleCallbacks } =
			await freshViewer();
		vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
		renderPhotoViewer(RecipeImageViewer, RecipeImageViewerTrigger);
		expect(idleCallbacks).toHaveLength(0);

		window.dispatchEvent(new Event('load'));
		expect(idleCallbacks).toHaveLength(1);
		expect(fetchBody).not.toHaveBeenCalled();

		for (const callback of idleCallbacks) {
			callback();
		}
		await waitFor(() => expect(fetchBody).toHaveBeenCalledTimes(1));
	});
});
