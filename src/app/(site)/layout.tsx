import { SiteChrome } from '@/app/_lib/site-chrome';

// The site's pages share the header and footer; a route outside this group renders in the root
// layout alone.
export default function SiteLayout({ children }: LayoutProps<'/'>) {
	return <SiteChrome>{children}</SiteChrome>;
}
