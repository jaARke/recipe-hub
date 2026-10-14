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

// The account control's slot, as wide as "Sign in" in every state, which the account menu's trigger
// fills, so nothing beside it moves when the session arrives.
function AccountSlot({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid *:col-start-1 *:row-start-1">
			<SignInSpace />
			{children}
		</div>
	);
}

// The theme menu and the account control, 8 px apart.
function HeaderAccountGroup({ member, className }: HeaderAccountProps & { className?: string }) {
	return (
		<div className={cn('flex items-center gap-2', className)}>
			<ThemeToggle />
			<AccountSlot>
				<React.Suspense>
					<HeaderAccount member={member} />
				</React.Suspense>
			</AccountSlot>
		</div>
	);
}

export { HeaderAccountGroup };
