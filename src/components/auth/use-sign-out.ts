'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { authClient } from '@/components/auth/auth-client';
import { settleAuthCall } from '@/components/auth/auth-errors';
import { toast } from '@/components/ui/toast';

type SignOutOptions = {
	// Where to go once signed out; without one, the current page renders again signed out.
	destination?: string;
	onSignedOut?: () => void;
};

// Ends this device's session. A failure shows a toast, since the menus that offer sign-out close.
export function useSignOut() {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function signOut({ destination, onSignedOut }: SignOutOptions = {}) {
		startTransition(async () => {
			const { error } = await settleAuthCall(authClient.signOut());
			if (error !== null) {
				toast.add({
					type: 'error',
					title: 'We couldn’t sign you out',
					description: 'Check your connection and try again.',
				});
				return;
			}

			if (destination !== undefined) {
				router.push(destination);
			}
			router.refresh();
			onSignedOut?.();
		});
	}

	return { signOut, pending };
}
