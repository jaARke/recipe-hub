'use client';

import { useSignOut } from '@/components/auth/use-sign-out';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type SignOutButtonProps = {
	// Where to go once signed out; without one, the current page renders again signed out.
	destination?: string;
	onSignedOut?: () => void;
};

function SignOutButton({ destination, onSignedOut }: SignOutButtonProps) {
	const { signOut, pending } = useSignOut();

	return (
		<Button
			type="button"
			variant="outline"
			disabled={pending}
			focusableWhenDisabled
			onClick={() => signOut({ destination, onSignedOut })}
		>
			{pending && <Spinner data-icon="inline-start" />}
			{pending ? 'Signing out' : 'Sign out'}
		</Button>
	);
}

export { SignOutButton };
