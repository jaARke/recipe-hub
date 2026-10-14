import Link from 'next/link';
import { Mascot } from '@/components/brand/mascot';
import { Wordmark } from '@/components/brand/wordmark';

// The mascot and the wordmark, linking home. The wordmark names the link; the mascot is decoration.
// The share cards' lockup (src/app/_lib/open-graph-image.tsx) and public/email/lockup.png keep its
// proportions.
function Lockup() {
	return (
		<Link href="/" className="flex shrink-0 items-center gap-2 rounded-md">
			{/* Above the fold on every page, so it loads with the page rather than when scrolled to. */}
			<Mascot size="sm" loading="eager" />
			<Wordmark className="h-5 w-auto" />
		</Link>
	);
}

export { Lockup };
