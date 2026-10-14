'use client';

import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { AccountMenuItems, AccountMenuItemsSkeleton } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';
import {
	addRecipeNavItem,
	adminNavItem,
	navItems,
	type NavItem,
} from '@/components/layout/nav-items';
import { ThemeRadioGroup } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SiteMenuProps = {
	member: Promise<HeaderMember | null>;
};

// The current page's item is underlined, so it is marked by more than color.
function SiteMenuNavItem({ item }: { item: NavItem }) {
	return (
		<DropdownMenuItem
			render={
				<Link
					href={item.href}
					aria-current={usePathname() === item.href ? 'page' : undefined}
					className="decoration-2 underline-offset-4 aria-[current=page]:underline"
				/>
			}
		>
			{item.label}
		</DropdownMenuItem>
	);
}

function SiteMenuAdminItem({ member }: SiteMenuProps) {
	return React.use(member)?.role === 'admin' ? <SiteMenuNavItem item={adminNavItem} /> : null;
}

function SiteMenuAccountItems({ member }: SiteMenuProps) {
	return <AccountMenuItems member={React.use(member)} />;
}

// Below lg the header has no room for the nav, Add recipe, the theme toggle, and the account
// control, so this one menu holds them. Its navigation never waits for the session; Admin and the
// account items stream in with it.
function SiteMenu({ member, className }: SiteMenuProps & { className?: string }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" className={className} aria-label="Menu" />}
			>
				<MenuIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				<DropdownMenuGroup aria-label="Navigation">
					{[...navItems, addRecipeNavItem].map((item) => (
						<SiteMenuNavItem key={item.href} item={item} />
					))}
					<React.Suspense>
						<SiteMenuAdminItem member={member} />
					</React.Suspense>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<React.Suspense fallback={<AccountMenuItemsSkeleton />}>
					<SiteMenuAccountItems member={member} />
				</React.Suspense>
				<DropdownMenuSeparator />
				<ThemeRadioGroup />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { SiteMenu };
