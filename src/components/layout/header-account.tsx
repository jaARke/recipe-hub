import { cn } from 'cn';
import Link from 'next/link';
import * as React from 'react';
import { signInPath } from '@/components/auth/auth-paths';
import { AccountMenu } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { buttonVariants } from '@/components/ui/button';

type HeaderAccountProps = {
	member: Promise<HeaderMember | null>;
};

// Holds the width of the "Sign in" link without showing it.
function SignInSpace() {
	return (
		<span aria-hidden="true" className={cn(buttonVariants({ variant: 'ghost' }), 'invisible')}>
			Sign in
		</span>
	);
}

// "Sign in", or the account menu once the session is read.
async function HeaderAccount({ member }: HeaderAccountProps) {
	const signedIn = await member;
	return signedIn === null ? (
		<Link href={signInPath} className={buttonVariants({ variant: 'ghost' })}>
			Sign in
		</Link>
	) : (
		<AccountMenu member={signedIn} />
	);
}

// The theme menu and the account control, 8 px apart in a box as wide as they are with "Sign in", so
// nothing else in the header moves when the account streams in after the page. A member's narrower
// control leaves the spare width to the theme menu's left.
function HeaderAccountGroup({ member, className }: HeaderAccountProps & { className?: string }) {
	return (
		<div className={cn('grid justify-items-end *:col-start-1 *:row-start-1', className)}>
			<div aria-hidden="true" className="invisible flex gap-2">
				<span className={buttonVariants({ variant: 'ghost', size: 'icon' })} />
				<SignInSpace />
			</div>
			<div className="flex items-center gap-2">
				<ThemeToggle />
				<React.Suspense fallback={<SignInSpace />}>
					<HeaderAccount member={member} />
				</React.Suspense>
			</div>
		</div>
	);
}

export { HeaderAccountGroup };
