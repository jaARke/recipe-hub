import { cn } from 'cn';
import Link from 'next/link';
import * as React from 'react';
import { signInPath } from '@/components/auth/auth-paths';
import { AccountMenu } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';
import { buttonVariants } from '@/components/ui/button';

// In the wide header, the account control sits in a box as wide as the "Sign in" link in every
// state, so nothing in the bar moves when the account streams in after the page.
function AccountControlFrame({ children }: { children?: React.ReactNode }) {
	return (
		<div className="hidden justify-items-end *:col-start-1 *:row-start-1 lg:grid">
			<span aria-hidden="true" className={cn(buttonVariants({ variant: 'ghost' }), 'invisible')}>
				Sign in
			</span>
			{children}
		</div>
	);
}

// The wide header's account control: "Sign in", or the account menu once the session is read.
async function HeaderAccount({ member }: { member: Promise<HeaderMember | null> }) {
	const signedIn = await member;
	return (
		<AccountControlFrame>
			{signedIn === null ? (
				<Link href={signInPath} className={buttonVariants({ variant: 'ghost' })}>
					Sign in
				</Link>
			) : (
				<AccountMenu member={signedIn} />
			)}
		</AccountControlFrame>
	);
}

// Holds the account control's space while the session is read, showing neither state.
function HeaderAccountPlaceholder() {
	return <AccountControlFrame />;
}

export { HeaderAccount, HeaderAccountPlaceholder };
