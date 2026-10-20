import { Suspense } from 'react';
import { Lockup } from '@/components/brand/lockup';
import { HeaderAccountGroup } from '@/components/layout/header-account';
import type { HeaderMember } from '@/components/layout/header-member';
import { MainNav, MainNavLinks } from '@/components/layout/main-nav';
import { PageContainer } from '@/components/layout/page-container';
import { SiteMenu } from '@/components/layout/site-menu';
import { HeaderSearchBar } from '@/components/search/header-search-bar';

type SiteHeaderProps = {
	// The signed-in member, or null. Each part that shows it waits for it behind its own boundary,
	// so the rest of the header never waits for the session.
	member: Promise<HeaderMember | null>;
	// The member's draft count, and none signed out, which Add recipe waits for in the same way.
	draftCount: Promise<number>;
};

// One row: the lockup, the section links, a search field filling the rest, then the theme menu and
// the account control. From md to lg the search is an icon; below md the lockup, the search icon,
// and one menu holding everything else. Below lg an open search takes the whole row.
function SiteHeader({ member, draftCount }: SiteHeaderProps) {
	return (
		<header className="sticky top-0 z-40 border-b bg-background print:hidden">
			<PageContainer
				width="wide"
				className="flex h-14 items-center gap-2 max-lg:has-data-search-open:*:not-data-search-open:hidden"
			>
				<Lockup />
				<div className="hidden md:block">
					<Suspense fallback={<MainNavLinks member={member} draftCount={draftCount} />}>
						<MainNav member={member} draftCount={draftCount} />
					</Suspense>
				</div>
				<HeaderSearchBar idPrefix="header-search" />
				<HeaderAccountGroup member={member} className="hidden md:flex" />
				<SiteMenu member={member} draftCount={draftCount} className="md:hidden" />
			</PageContainer>
		</header>
	);
}

export { SiteHeader };
