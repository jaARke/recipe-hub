import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import type { ShownImage } from '@/components/recipe/shown-recipe-image';
import { stubViewerLayout } from '@/components/recipe/testing/viewer-layout';

// The stubbed layout makes every frame, and every image whole in it, 400 by 300.
const photos: ShownImage[] = [
	{ pathname: 'dish/seed/soup.jpg', alt: 'Soup in a bowl', size: { width: 1600, height: 1200 } },
	{ pathname: 'dish/seed/bread.jpg', alt: 'Bread on a board', size: { width: 1600, height: 1200 } },
	{ pathname: 'dish/seed/salad.jpg', alt: 'Salad', size: { width: 1600, height: 1200 } },
];

let undoLayout = () => {};

afterEach(() => {
	undoLayout();
});

async function openViewer(pressed = 'View photo 1 of 3: Soup in a bowl') {
	undoLayout = stubViewerLayout();
	const user = userEvent.setup();
	render(
		<RecipeImageViewer role="dish" title="Weeknight chicken soup" images={photos}>
			{photos.map((photo, index) => (
				<RecipeImageViewerTrigger key={photo.pathname} index={index} className="w-24">
					{photo.alt}
				</RecipeImageViewerTrigger>
			))}
		</RecipeImageViewer>
	);
	await user.click(screen.getByRole('button', { name: pressed }));
	const viewer = await screen.findByRole('dialog', { name: 'Weeknight chicken soup' });
	return { user, viewer };
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
