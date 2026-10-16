import type { Metadata } from 'next';
import { PageNotFoundState, pageNotFoundTitle } from '@/components/layout/page-not-found-state';

export const metadata: Metadata = {
	title: pageNotFoundTitle,
};

// A notFound() in a site page renders this inside the (site) layout. Without it, Turbopack hands
// this group the root not-found page, which brings its own chrome, and the page shows two headers.
export default function SiteNotFound() {
	return <PageNotFoundState />;
}
