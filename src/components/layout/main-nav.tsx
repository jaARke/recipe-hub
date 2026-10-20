'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import type { HeaderMember } from '@/components/layout/header-member';
import { NavItemCount } from '@/components/layout/nav-item-count';
import {
	adminNavItem,
	navItemCurrent,
	navItems,
	type NavItem,
} from '@/components/layout/nav-items';
import { useRecipeOpenedFrom } from '@/components/recipe/use-recipe-opened-from';

type MainNavProps = {
	member: Promise<HeaderMember | null>;
	draftCount: Promise<number>;
};

// Where the header is, as navItemCurrent reads it.
type MainNavPlace = {
	pathname?: string;
	listPathname?: string;
};

// The current section's link is underlined as well as darker, so it is marked by more than color.
function MainNavLink({
	item,
	pathname,
	listPathname,
	children,
}: MainNavPlace & { item: NavItem; children?: React.ReactNode }) {
	return (
		<Link
			href={item.href}
			aria-current={navItemCurrent(item, pathname, listPathname)}
			className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground decoration-2 underline-offset-6 transition-colors hover:text-foreground aria-[current]:text-foreground aria-[current]:underline"
		>
			{item.label}
			{children}
		</Link>
	);
}

function AdminNavItem({ member, ...place }: Pick<MainNavProps, 'member'> & MainNavPlace) {
	return React.use(member)?.role === 'admin' ? (
		<li>
			<MainNavLink item={adminNavItem} {...place} />
		</li>
	) : null;
}

// Without a pathname, as while MainNav waits for one, no link is marked as current. Admin streams in
// with the session, and Add recipe's draft count with its own read, into links that never wait.
function MainNavLinks({ member, draftCount, ...place }: MainNavProps & MainNavPlace) {
	return (
		<nav aria-label="Main">
			<ul role="list" className="flex items-center gap-1">
				{navItems.map((item) => (
					<li key={item.href}>
						<MainNavLink item={item} {...place}>
							<NavItemCount item={item} draftCount={draftCount} />
						</MainNavLink>
					</li>
				))}
				<React.Suspense>
					<AdminNavItem member={member} {...place} />
				</React.Suspense>
			</ul>
		</nav>
	);
}

// Under Cache Components this suspends below unknown dynamic params, so it renders inside Suspense.
function MainNav({ member, draftCount }: MainNavProps) {
	const pathname = usePathname();
	const openedFrom = useRecipeOpenedFrom(pathname);
	return (
		<MainNavLinks
			member={member}
			draftCount={draftCount}
			pathname={pathname}
			listPathname={openedFrom?.listPathname}
		/>
	);
}

export { MainNav, MainNavLinks };
