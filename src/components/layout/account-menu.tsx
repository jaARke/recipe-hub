'use client';

import Link from 'next/link';
import {
	accountPath,
	adminPath,
	requestAccessPath,
	signInPath,
} from '@/components/auth/auth-paths';
import { useSignOut } from '@/components/auth/use-sign-out';
import type { HeaderMember } from '@/components/layout/header-member';
import { contributePath, recipeListPath } from '@/components/recipe/recipe-paths';
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

// The account part of a menu, shared by the phone menu and the account menu.
function AccountMenuItems({ member }: { member: HeaderMember | null }) {
	const { signOut } = useSignOut();

	if (member === null) {
		return (
			<DropdownMenuGroup>
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
			<DropdownMenuItem render={<Link href={contributePath} />}>Add recipe</DropdownMenuItem>
			<DropdownMenuItem render={<Link href={accountPath} />}>Account</DropdownMenuItem>
			{member.role === 'admin' && (
				<DropdownMenuItem render={<Link href={adminPath} />}>Admin</DropdownMenuItem>
			)}
			<DropdownMenuSeparator />
			<DropdownMenuItem onClick={() => signOut({ destination: recipeListPath })}>
				Sign out
			</DropdownMenuItem>
		</DropdownMenuGroup>
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
					<Button
						variant="secondary"
						size="icon"
						aria-label={`Account menu for ${member.displayName}`}
					/>
				}
			>
				{memberInitial(member.displayName)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				<AccountMenuItems member={member} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { AccountMenu, AccountMenuItems };
