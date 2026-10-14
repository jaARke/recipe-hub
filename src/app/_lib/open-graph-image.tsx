import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import sharp from 'sharp';
import { wordmarkOutline } from '@/components/brand/wordmark-outline';
import { tokenColors } from '@/lib/token-colors';

export const openGraphImageSize = { width: 1200, height: 630 };

// ImageResponse writes lossless PNG, which a dish photo makes about 880 KB, more than some apps take
// for a link preview. As JPEG the same card is under a tenth of that.
export const openGraphImageContentType = 'image/jpeg';

export const openGraphFontFamilies = {
	heading: 'Fraunces',
	body: 'Hanken Grotesk',
};

// Mascot widths in the card's pixels; assets/brand/mascot-card.png is drawn at twice the largest.
const lockupSizes = {
	sm: 64,
	lg: 160,
} as const;

type LockupSize = keyof typeof lockupSizes;

// The header's Lockup (src/components/brand/lockup.tsx) in proportion to its 32 px mascot: a 20 px
// wordmark, 8 px away.
const lockupWordmarkHeight = 20 / 32;
const lockupGap = 8 / 32;

const jpegQuality = 80;

const fontsDirectory = join(process.cwd(), 'assets/fonts');
// Named whole, so the deployment's file tracing takes this file and not the brand masters beside it.
const mascotCardPath = join(process.cwd(), 'assets/brand/mascot-card.png');
const [frauncesSemibold, hankenGroteskRegular, mascotCard] = await Promise.all([
	readFile(join(fontsDirectory, 'fraunces-soft-semibold.ttf')),
	readFile(join(fontsDirectory, 'hanken-grotesk-regular.ttf')),
	readFile(mascotCardPath, 'base64'),
]);
const mascotCardSrc = `data:image/png;base64,${mascotCard}`;

// The mascot and the wordmark in the header's colors, as the header's Lockup composes them.
export function OpenGraphLockup({ size }: { size: LockupSize }) {
	const mascotSize = lockupSizes[size];
	const wordmarkHeight = mascotSize * lockupWordmarkHeight;

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: mascotSize * lockupGap }}>
			{/* Satori draws plain img elements. */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={mascotCardSrc} alt="" width={mascotSize} height={mascotSize} />
			<svg
				viewBox={`0 0 ${wordmarkOutline.width} ${wordmarkOutline.height}`}
				width={(wordmarkHeight * wordmarkOutline.width) / wordmarkOutline.height}
				height={wordmarkHeight}
				fill={tokenColors.light.foreground}
			>
				<path d={wordmarkOutline.d} />
			</svg>
		</div>
	);
}

// Satori draws the card as PNG, which sharp encodes again as JPEG.
export async function renderOpenGraphImage(card: ReactElement): Promise<Buffer<ArrayBuffer>> {
	const png = await new ImageResponse(card, {
		...openGraphImageSize,
		fonts: [
			{ name: openGraphFontFamilies.heading, data: frauncesSemibold, weight: 600, style: 'normal' },
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
