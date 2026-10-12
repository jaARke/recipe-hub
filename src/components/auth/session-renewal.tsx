'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { authClient } from '@/components/auth/auth-client';

// Rendered for signed-in members. Server Components can't set cookies, so this reads the session
// through the auth endpoint on load and whenever the window regains focus, which renews the cookie
// at most once a day. Once the session has ended, the page renders again signed out.
function SessionRenewal() {
	const router = useRouter();
	const { data, error, isPending } = authClient.useSession();
	const sessionEnded = !isPending && data === null && (error === null || error.status === 401);

	React.useEffect(() => {
		if (sessionEnded) {
			router.refresh();
		}
	}, [sessionEnded, router]);

	return null;
}

export { SessionRenewal };
