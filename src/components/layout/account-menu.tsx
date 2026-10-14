'use client';

import { ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';
import { accountPath, requestAccessPath, signInPath } from '@/components/auth/auth-paths';
import { useSignOut } from '@/components/auth/use-sign-out';
import type { HeaderMember } from '@/components/layout/header-member';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

// The account part of a menu, shared by the phone menu and the account menu. It holds only the
// account: the site's pages are in the navigation.
function AccountMenuItems({ member }: { member: HeaderMember | null }) {
	const { signOut } = useSignOut();

	if (member === null) {
		return (
			<DropdownMenuGroup aria-label="Account">
				<DropdownMenuItem render={<Link href={signInPath} />}>Sign in</DropdownMenuItem>
				<DropdownMenuItem render={<Link href={requestAccessPath} />}>
					Request access
				</DropdownMenuItem>
			</DropdownMenuGroup>
		);
	}

	return (
		<DropdownMenuGroup>
			<DropdownMenuLabel>Signed in as {member.displayName}</DropdownMenuLabel>
			<DropdownMenuItem render={<Link href={accountPath} />}>Account</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem onClick={() => signOut({ destination: recipeListPath })}>
				Sign out
			</DropdownMenuItem>
		</DropdownMenuGroup>
	);
}

// Holds the account items' place while the session is read.
function AccountMenuItemsSkeleton() {
	return (
		<div aria-hidden="true" className="flex flex-col gap-3 px-2 py-2.5">
			<Skeleton className="h-3 w-28" />
			<Skeleton className="h-3 w-20" />
		</div>
	);
}

// Whole characters as a reader sees them, so an accented letter or an emoji is never split.
const graphemes = new Intl.Segmenter('en-US', { granularity: 'grapheme' });

// The member's first letter, so the button stays as small as the bar's other controls.
function memberInitial(displayName: string): string {
	const [first] = graphemes.segment(displayName);
	return (first?.segment ?? '').toLocaleUpperCase();
}

function AccountMenu({ member }: { member: HeaderMember }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					// Tighter than a text button's padding, so it fits the width "Sign in" holds.
					<Button
						variant="ghost"
						aria-label={`Account menu for ${member.displayName}`}
						className="gap-1 px-1 has-data-[icon=inline-end]:pr-1"
					/>
				}
			>
				<Avatar>
					<AvatarFallback>{memberInitial(member.displayName)}</AvatarFallback>
				</Avatar>
				<ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				<AccountMenuItems member={member} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { AccountMenu, AccountMenuItems, AccountMenuItemsSkeleton };
