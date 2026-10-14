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

type MainNavProps = {
	member: Promise<HeaderMember | null>;
};

// As tall as the header. The current section's link is darker and stands on a bar over the header's
// bottom rule, the bar of the line tabs, so it is marked by more than color. Its focus ring is drawn
// inside, since the link meets the top of the window.
function MainNavLink({ item, pathname }: { item: NavItem; pathname?: string }) {
	return (
		<Link
			href={item.href}
			aria-current={navItemCurrent(item, pathname)}
			className="relative flex h-full items-center px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity hover:text-foreground focus-visible:-outline-offset-1 focus-visible:ring-inset aria-[current]:text-foreground aria-[current]:after:opacity-100"
		>
			{item.label}
		</Link>
	);
}

function AdminNavItem({ member, pathname }: MainNavProps & { pathname?: string }) {
	return React.use(member)?.role === 'admin' ? (
		<li className="flex">
			<MainNavLink item={adminNavItem} pathname={pathname} />
		</li>
	) : null;
}

// Without a pathname, as while MainNav waits for one, no link is marked as current. Admin streams in
// with the session, after the links that never wait for it.
function MainNavLinks({ member, pathname }: MainNavProps & { pathname?: string }) {
	return (
		<nav aria-label="Main" className="flex">
			<ul className="flex gap-1">
				{navItems.map((item) => (
					<li key={item.href} className="flex">
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
