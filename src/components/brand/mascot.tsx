import Image, { type ImageProps } from 'next/image';
import mascotDieCut from '@/components/brand/mascot-die-cut.png';
import mascotSleepingDieCut from '@/components/brand/mascot-sleeping-die-cut.png';
import mascotWorriedDieCut from '@/components/brand/mascot-worried-die-cut.png';

// Each pose's die-cut, all made from their masters by one recipe (assets/brand/SOURCES.md).
const mascotPoses = {
	grin: mascotDieCut,
	worried: mascotWorriedDieCut,
	sleeping: mascotSleepingDieCut,
} as const;

export type MascotPose = keyof typeof mascotPoses;

// Rendered widths in CSS pixels; the optimizer serves each at 1x and 2x from the 512 px master.
const mascotSizes = {
	sm: 32,
	lg: 96,
	xl: 128,
} as const;

export type MascotSize = keyof typeof mascotSizes;

// Loading is eager where the mascot can be a page's largest image, as in an empty state, since a lazy
// one holds back that page's Largest Contentful Paint.
type MascotProps = Pick<ImageProps, 'loading'> & {
	pose?: MascotPose;
	size: MascotSize;
	// Empty by default: the mascot sits beside text that already says what the screen is.
	alt?: string;
};

// The die-cut's cream edge keeps the ink outline visible on the dark theme; on the light theme it
// matches the background.
function Mascot({ pose = 'grin', size, alt = '', loading }: MascotProps) {
	return (
		<Image
			src={mascotPoses[pose]}
			alt={alt}
			width={mascotSizes[size]}
			height={mascotSizes[size]}
			loading={loading}
			className="shrink-0"
		/>
	);
}

export { Mascot, mascotSizes };
