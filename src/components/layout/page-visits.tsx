'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';

// Next keeps recent pages, hidden, and shows one again as it was left. A visit by a link or a redirect
// gives the page a new bfcacheId; back and forward keep it, and so does a refresh.

// The visit whose page has shown for a task, so its page can since have been left. Strict Mode runs a
// new page's effects a second time in the task they first ran in, which is no return.
function useSettledVisit() {
	const { bfcacheId } = useRouter();
	const settledIn = React.useRef<string>(undefined);

	React.useEffect(() => {
		const settle = setTimeout(() => {
			settledIn.current = bfcacheId;
		});
		return () => clearTimeout(settle);
	}, [bfcacheId]);

	return { bfcacheId, settledIn };
}

// Renders its content afresh on each visit by a link or a redirect, and as it was left on back and
// forward.
function NewOnEachVisit({ children }: { children: React.ReactNode }) {
	const { bfcacheId } = useRouter();
	return <React.Fragment key={bfcacheId}>{children}</React.Fragment>;
}

// Reads the page again from the server as back or forward shows it, so what it lists is as it now
// is; a visit by a link or a redirect has read it already. A kept page's effects run again whenever
// it shows.
function RefreshOnReturn() {
	const router = useRouter();
	const { bfcacheId, settledIn } = useSettledVisit();
	const refresh = React.useEffectEvent(() => router.refresh());

	React.useEffect(() => {
		if (settledIn.current === bfcacheId) {
			refresh();
		}
	}, [bfcacheId, settledIn]);

	return null;
}

// Whether what a visit says is still to show: not once its page hides, so back and forward, which keep
// the visit, show the page without it, while the next visit by a link or a redirect shows it again.
// It hides with the page, so nothing flashes on return.
function useShownThisVisit(): boolean {
	const { bfcacheId, settledIn } = useSettledVisit();
	const [hiddenIn, setHiddenIn] = React.useState<string>();

	useOnKeptPageHide(() => {
		if (settledIn.current === bfcacheId) {
			setHiddenIn(bfcacheId);
		}
	});

	return hiddenIn !== bfcacheId;
}

export { NewOnEachVisit, RefreshOnReturn, useShownThisVisit };
