import { cn } from 'cn';
import Link from 'next/link';
import * as React from 'react';
import { signInPath } from '@/components/auth/auth-paths';
import { AccountMenu } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';
import { SiteMenu } from '@/components/layout/site-menu';
import { buttonVariants } from '@/components/ui/button';

// From sm, the account control sits in a box as wide as the "Sign in" link in every state, so
// nothing in the bar moves when the account streams in after the page.
function AccountControlFrame({ children }: { children?: React.ReactNode }) {
	return (
		<div className="hidden justify-items-end *:col-start-1 *:row-start-1 sm:grid">
			<span aria-hidden="true" className={cn(buttonVariants({ variant: 'ghost' }), 'invisible')}>
				Sign in
			</span>
			{children}
		</div>
	);
}

// The header's session-dependent part: the phone menu below sm, then "Sign in" or the account menu.
function HeaderAccount({ member }: { member: HeaderMember | null }) {
	return (
		<>
			<SiteMenu member={member} className="sm:hidden" />
			<AccountControlFrame>
				{member === null ? (
					<Link href={signInPath} className={buttonVariants({ variant: 'ghost' })}>
						Sign in
					</Link>
				) : (
					<AccountMenu member={member} />
				)}
			</AccountControlFrame>
		</>
	);
}

// Holds the header's space while the session is read, showing neither state.
function HeaderAccountPlaceholder() {
	return (
		<>
			<span aria-hidden="true" className="size-9 sm:hidden" />
			<AccountControlFrame />
		</>
	);
}

export { HeaderAccount, HeaderAccountPlaceholder };
