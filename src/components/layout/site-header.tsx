import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { MainNav, MainNavLinks } from '@/components/layout/main-nav';
import { PageContainer } from '@/components/layout/page-container';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { HeaderSearch } from '@/components/search/header-search';
import { HeaderSearchBar } from '@/components/search/header-search-bar';
import { siteName } from '@/lib/site';

type SiteHeaderProps = {
	// The session-dependent controls, which the layout streams in behind their own boundary.
	account: ReactNode;
};

// Below sm, the nav and the theme toggle move into the account slot's menu.
function SiteHeader({ account }: SiteHeaderProps) {
	return (
		<header className="sticky top-0 z-40 border-b bg-background print:hidden">
			<PageContainer width="wide" className="flex h-14 items-center gap-4">
				<Link href="/" className="rounded-md font-heading text-xl font-medium">
					{siteName}
				</Link>
				<div className="hidden sm:block">
					<Suspense fallback={<MainNavLinks />}>
						<MainNav />
					</Suspense>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Suspense fallback={<HeaderSearchBar />}>
						<HeaderSearch>
							<HeaderSearchBar />
						</HeaderSearch>
					</Suspense>
					<div className="hidden sm:block">
						<ThemeToggle />
					</div>
					{account}
				</div>
			</PageContainer>
		</header>
	);
}

export { SiteHeader };
