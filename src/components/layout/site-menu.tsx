'use client';

import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { AccountMenuItems } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';
import { navItems } from '@/components/layout/main-nav';
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

// Phones have no room for the nav, the theme toggle, and the account control, so this one menu
// holds them below sm.
function SiteMenu({ member, className }: { member: HeaderMember | null; className?: string }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" className={className} aria-label="Menu" />}
			>
				<MenuIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				<DropdownMenuGroup>
					{navItems.map((item) => (
						<DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
							{item.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<AccountMenuItems member={member} />
				<DropdownMenuSeparator />
				<ThemeRadioGroup />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { SiteMenu };
