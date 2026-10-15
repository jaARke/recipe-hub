'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import type { HeaderMember } from '@/components/layout/header-member';
import {
	adminNavItem,
	navItemCurrent,
	navItems,
	type NavItem,
} from '@/components/layout/nav-items';
import { useRecipeOpenedFrom } from '@/components/recipe/use-recipe-opened-from';

type MainNavProps = {
	member: Promise<HeaderMember | null>;
};

// Where the header is, as navItemCurrent reads it.
type MainNavPlace = {
	pathname?: string;
	listPathname?: string;
};

// The current section's link is underlined as well as darker, so it is marked by more than color.
function MainNavLink({ item, pathname, listPathname }: MainNavPlace & { item: NavItem }) {
	return (
		<Link
			href={item.href}
			aria-current={navItemCurrent(item, pathname, listPathname)}
			className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground decoration-2 underline-offset-6 transition-colors hover:text-foreground aria-[current]:text-foreground aria-[current]:underline"
		>
			{item.label}
		</Link>
	);
}

function AdminNavItem({ member, ...place }: MainNavProps & MainNavPlace) {
	return React.use(member)?.role === 'admin' ? (
		<li>
			<MainNavLink item={adminNavItem} {...place} />
		</li>
	) : null;
}

// Without a pathname, as while MainNav waits for one, no link is marked as current. Admin streams in
// with the session, after the links that never wait for it.
function MainNavLinks({ member, ...place }: MainNavProps & MainNavPlace) {
	return (
		<nav aria-label="Main">
			<ul className="flex items-center gap-1">
				{navItems.map((item) => (
					<li key={item.href}>
						<MainNavLink item={item} {...place} />
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
function MainNav({ member }: MainNavProps) {
	const pathname = usePathname();
	const openedFrom = useRecipeOpenedFrom(pathname);
	return (
		<MainNavLinks member={member} pathname={pathname} listPathname={openedFrom?.list.pathname} />
	);
}

export { MainNav, MainNavLinks };
