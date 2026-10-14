import Image, { type ImageProps } from 'next/image';
import mascotDieCut from '@/components/brand/mascot-die-cut.png';

// Rendered widths in CSS pixels; the optimizer serves each at 1x and 2x from the 512 px master.
const mascotSizes = {
	sm: 32,
	md: 64,
	lg: 96,
	xl: 128,
} as const;

export type MascotSize = keyof typeof mascotSizes;

type MascotProps = Pick<ImageProps, 'loading'> & {
	size: MascotSize;
	// Empty by default: the mascot sits beside text that already says what the screen is.
	alt?: string;
};

// The die-cut's cream edge keeps the ink outline visible on the dark theme; on the light theme it
// matches the background.
function Mascot({ size, alt = '', loading }: MascotProps) {
	return (
		<Image
			src={mascotDieCut}
			alt={alt}
			width={mascotSizes[size]}
			height={mascotSizes[size]}
			loading={loading}
			className="shrink-0"
		/>
	);
}

export { Mascot, mascotSizes };
