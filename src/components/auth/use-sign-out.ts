'use client';

import { useTransition } from 'react';
import { authClient } from '@/components/auth/auth-client';
import { settleAuthCall } from '@/components/auth/auth-errors';
import { loadPage } from '@/components/auth/load-page';
import { toast } from '@/components/ui/toast';
import { removeMemberBrowserStorage } from '@/lib/browser-storage';

type SignOutOptions = {
	// The page to load once signed out.
	destination: string;
};

// Ends this device's session, removes what this browser kept for the member, then loads the
// destination as a new page, so neither pages Next kept from the session, which can hold the
// account's email, invite links, or drafts, nor unsaved changes outlive it. A failure
// shows a toast, since the menus that offer sign-out close.
export function useSignOut() {
	const [pending, startTransition] = useTransition();

	function signOut({ destination }: SignOutOptions) {
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

			removeMemberBrowserStorage();
			loadPage(destination);
		});
	}

	return { signOut, pending };
}
