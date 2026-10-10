'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

const navItems: readonly NavItem[] = [{ href: '/', label: 'Recipes' }];

function MainNav() {
	// Under Cache Components this suspends below unknown dynamic params; wrap MainNav in Suspense once a route has one.
	const pathname = usePathname();

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

export { MainNav };
