'use client';

import { useTransition } from 'react';
import { authClient } from '@/components/auth/auth-client';
import { settleAuthCall } from '@/components/auth/auth-errors';
import { toast } from '@/components/ui/toast';

type SignOutOptions = {
	// The page to load once signed out.
	destination: string;
};

// The browser takes an address that differs from the page's own only in its fragment as a scroll
// within the page, not a page to load.
function scrollsWithinPage(destination: string): boolean {
	const target = new URL(destination, window.location.href);
	if (target.hash === '') {
		return false;
	}
	const page = new URL(window.location.href);
	target.hash = '';
	page.hash = '';
	return target.href === page.href;
}

// Loads the page afresh even when only its fragment changes.
function loadPage(destination: string) {
	if (scrollsWithinPage(destination)) {
		window.history.replaceState(null, '', destination);
		window.location.reload();
	} else {
		window.location.assign(destination);
	}
}

// Ends this device's session, then loads the destination as a new page, so pages Next kept from the
// session, which can hold the account's email, invite links, or drafts, don't outlive it. A failure
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

			loadPage(destination);
		});
	}

	return { signOut, pending };
}
