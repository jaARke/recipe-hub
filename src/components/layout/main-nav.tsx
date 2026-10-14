'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import type { HeaderMember } from '@/components/layout/header-member';
import { adminNavItem, navItems, type NavItem } from '@/components/layout/nav-items';

type MainNavProps = {
	member: Promise<HeaderMember | null>;
};

// The current page's link is underlined as well as darker, so it is marked by more than color.
function MainNavLink({ item, pathname }: { item: NavItem; pathname?: string }) {
	return (
		<Link
			href={item.href}
			aria-current={pathname === item.href ? 'page' : undefined}
			className="inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-muted-foreground decoration-2 underline-offset-6 transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline"
		>
			{item.label}
		</Link>
	);
}

function AdminNavItem({ member, pathname }: MainNavProps & { pathname?: string }) {
	return React.use(member)?.role === 'admin' ? (
		<li>
			<MainNavLink item={adminNavItem} pathname={pathname} />
		</li>
	) : null;
}

// Without a pathname, as while MainNav waits for one, no link is marked as the current page. Admin
// streams in with the session, after the links that never wait for it.
function MainNavLinks({ member, pathname }: MainNavProps & { pathname?: string }) {
	return (
		<nav aria-label="Main">
			<ul className="flex items-center gap-1">
				{navItems.map((item) => (
					<li key={item.href}>
						<MainNavLink item={item} pathname={pathname} />
					</li>
				))}
				<React.Suspense>
					<AdminNavItem member={member} pathname={pathname} />
				</React.Suspense>
			</ul>
		</nav>
	);
}

// Under Cache Components this suspends below unknown dynamic params, so it renders inside Suspense.
function MainNav({ member }: MainNavProps) {
	return <MainNavLinks member={member} pathname={usePathname()} />;
}

export { MainNav, MainNavLinks };
