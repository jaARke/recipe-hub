'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

// Shared with the phone menu, which holds these links below sm.
const navItems: readonly NavItem[] = [{ href: '/', label: 'Recipes' }];

// Without a pathname, as while MainNav waits for one, no link is marked as the current page.
function MainNavLinks({ pathname }: { pathname?: string }) {
	return (
		<nav aria-label="Main">
			<ul className="flex items-center gap-1">
				{navItems.map((item) => (
					<li key={item.href}>
						<Link
							href={item.href}
							aria-current={pathname === item.href ? 'page' : undefined}
							className="inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-primary"
						>
							{item.label}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

// Under Cache Components this suspends below unknown dynamic params, so it renders inside Suspense.
function MainNav() {
	return <MainNavLinks pathname={usePathname()} />;
}

export { MainNav, MainNavLinks, navItems };
