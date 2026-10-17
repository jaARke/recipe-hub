import { expect } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { ImageSize } from '@/domain/recipe/recipe-image';

// Where an image sits in its zoom frame, from the top left corner inside the frame's border, and how
// large it is, in CSS pixels.
type ImageBox = { left: number; top: number; width: number; height: number };

// The inside of a zoom frame, which the zoom fits its image to and pans it within.
export function frameSize(frame: Locator): { width: number; height: number } {
	const { clientWidth: width, clientHeight: height } = frame.element();
	return { width, height };
}

// The image as large as the frame allows in its own shape, times the scale, about the frame's middle.
export function centeredImageBox(frame: Locator, size: ImageSize, scale = 1): ImageBox {
	const inside = frameSize(frame);
	const width = Math.min(inside.width, (inside.height * size.width) / size.height) * scale;
	const height = (width * size.height) / size.width;
	return { left: (inside.width - width) / 2, top: (inside.height - height) / 2, width, height };
}

// Waits for the image to settle in the box, as the zoom animates its moves. The zoom measures in
// whole pixels, so the image lands within half a pixel of it.
export async function expectImageIn(frame: Locator, box: ImageBox): Promise<void> {
	await expect
		.poll(() => imageBox(frame))
		.toEqual({
			left: expect.closeTo(box.left, 0),
			top: expect.closeTo(box.top, 0),
			width: expect.closeTo(box.width, 0),
			height: expect.closeTo(box.height, 0),
		});
}

// The image in the frame as the reader sees it now, zoomed and panned.
function imageBox(frame: Locator): ImageBox {
	const element = frame.element();
	const inside = element.getBoundingClientRect();
	const image = frame.getByRole('img').element().getBoundingClientRect();
	return {
		left: image.left - inside.left - element.clientLeft,
		top: image.top - inside.top - element.clientTop,
		width: image.width,
		height: image.height,
	};
}
