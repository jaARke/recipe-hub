import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import sharp from 'sharp';

export const openGraphImageSize = { width: 1200, height: 630 };

// ImageResponse writes lossless PNG, which a dish photo makes about 880 KB, more than some apps take
// for a link preview. As JPEG the same card is under a tenth of that.
export const openGraphImageContentType = 'image/jpeg';

export const openGraphFontFamilies = {
	heading: 'Fraunces',
	body: 'Hanken Grotesk',
};

const jpegQuality = 80;

const fontsDirectory = join(process.cwd(), 'assets/fonts');
const [frauncesMedium, hankenGroteskRegular] = await Promise.all([
	readFile(join(fontsDirectory, 'fraunces-soft-medium.ttf')),
	readFile(join(fontsDirectory, 'hanken-grotesk-regular.ttf')),
]);

// Satori draws the card as PNG, which sharp encodes again as JPEG.
export async function renderOpenGraphImage(card: ReactElement): Promise<Buffer<ArrayBuffer>> {
	const png = await new ImageResponse(card, {
		...openGraphImageSize,
		fonts: [
			{ name: openGraphFontFamilies.heading, data: frauncesMedium, weight: 500, style: 'normal' },
			{
				name: openGraphFontFamilies.body,
				data: hankenGroteskRegular,
				weight: 400,
				style: 'normal',
			},
		],
	}).arrayBuffer();
	return sharp(png).jpeg({ quality: jpegQuality }).toBuffer();
}
