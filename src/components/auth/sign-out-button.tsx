'use client';

import { useSignOut } from '@/components/auth/use-sign-out';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type SignOutButtonProps = {
	// The page to load once signed out, or a function that names it on the click, for a page that
	// learns it after rendering.
	destination: string | (() => string);
};

function SignOutButton({ destination }: SignOutButtonProps) {
	const { signOut, pending } = useSignOut();

	return (
		<Button
			type="button"
			variant="outline"
			disabled={pending}
			focusableWhenDisabled
			onClick={() =>
				signOut({ destination: typeof destination === 'string' ? destination : destination() })
			}
		>
			{pending && <Spinner data-icon="inline-start" />}
			{pending ? 'Signing out' : 'Sign out'}
		</Button>
	);
}

export { SignOutButton };
