import Link from 'next/link';
import { privacyPath } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';

// After every page's content, so what the site stores, such as a signed-out reader's favorites
// cookie, is explained one link away. Left off the printout, as the header is.
function SiteFooter() {
	return (
		<footer className="border-t print:hidden">
			<PageContainer width="wide" className="py-6">
				<Link
					href={privacyPath}
					className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
				>
					Privacy
				</Link>
			</PageContainer>
		</footer>
	);
}

export { SiteFooter };
