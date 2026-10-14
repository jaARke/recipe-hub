import { wordmarkOutline } from '@/components/brand/wordmark-outline';
import { siteName } from '@/lib/site';

// Filled with the text color, so it follows the theme. The width and height give its aspect ratio;
// a class sets the rendered height.
function Wordmark({ className }: { className?: string }) {
	return (
		<svg
			viewBox={`0 0 ${wordmarkOutline.width} ${wordmarkOutline.height}`}
			width={wordmarkOutline.width}
			height={wordmarkOutline.height}
			role="img"
			aria-label={siteName}
			fill="currentColor"
			className={className}
		>
			<path d={wordmarkOutline.d} />
		</svg>
	);
}

export { Wordmark };
