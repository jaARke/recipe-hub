import { cn } from 'cn';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Lockup } from '@/components/brand/lockup';
import { HeaderAccount, HeaderAccountPlaceholder } from '@/components/layout/header-account';
import type { HeaderMember } from '@/components/layout/header-member';
import { MainNav, MainNavLinks } from '@/components/layout/main-nav';
import { addRecipeNavItem } from '@/components/layout/nav-items';
import { PageContainer } from '@/components/layout/page-container';
import { SiteMenu } from '@/components/layout/site-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { HeaderSearch } from '@/components/search/header-search';
import { HeaderSearchBar } from '@/components/search/header-search-bar';
import { buttonVariants } from '@/components/ui/button';

type SiteHeaderProps = {
	// The signed-in member, or null. Each part that shows it waits for it behind its own boundary,
	// so the rest of the header never waits for the session.
	member: Promise<HeaderMember | null>;
};

// From lg, two clusters: the lockup and the nav, then search, Add recipe, the theme toggle, and the
// account control. Below lg, the lockup, a search link, and one menu that holds everything else.
function SiteHeader({ member }: SiteHeaderProps) {
	return (
		<header className="sticky top-0 z-40 border-b bg-background print:hidden">
			<PageContainer width="wide" className="flex h-14 items-center gap-4">
				<Lockup />
				<div className="hidden lg:block">
					<Suspense fallback={<MainNavLinks member={member} />}>
						<MainNav member={member} />
					</Suspense>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Suspense fallback={<HeaderSearchBar />}>
						<HeaderSearch>
							<HeaderSearchBar />
						</HeaderSearch>
					</Suspense>
					<Link
						href={addRecipeNavItem.href}
						className={cn(buttonVariants({ variant: 'outline' }), 'hidden lg:inline-flex')}
					>
						<PlusIcon data-icon="inline-start" aria-hidden="true" />
						{addRecipeNavItem.label}
					</Link>
					<div className="hidden lg:block">
						<ThemeToggle />
					</div>
					<SiteMenu member={member} className="lg:hidden" />
					<Suspense fallback={<HeaderAccountPlaceholder />}>
						<HeaderAccount member={member} />
					</Suspense>
				</div>
			</PageContainer>
		</header>
	);
}

export { SiteHeader };
