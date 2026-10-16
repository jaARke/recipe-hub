import type { Metadata } from 'next';
import { SiteChrome } from '@/app/_lib/site-chrome';
import { PageNotFoundState, pageNotFoundTitle } from '@/components/layout/page-not-found-state';

export const metadata: Metadata = {
	title: pageNotFoundTitle,
};

// An unmatched URL renders this in the root layout alone, so it brings the chrome itself.
export default function NotFound() {
	return (
		<SiteChrome>
			<PageNotFoundState />
		</SiteChrome>
	);
}
