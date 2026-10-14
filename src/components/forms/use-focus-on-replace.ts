'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, type RefObject } from 'react';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';
import { useHydrated } from '@/components/forms/use-hydrated';

// Moves focus to the element when it renders in place of content that held focus, as when an action's
// refresh swaps a page's content and focus falls to the page. An element the page arrives with
// hydrates from the server's HTML and leaves focus alone.
export function useFocusOnReplace(ref: RefObject<HTMLElement | null>) {
	// False while hydrating, true when the browser renders the element first.
	const renderedInBrowser = useHydrated();
	const replacedContent = useRef(renderedInBrowser);
	// Next keeps recent pages and shows one again on a push or replace with a new bfcacheId, so a kept
	// page shown that way replaces content too; back and forward keep the id and their scroll position.
	const { bfcacheId } = useRouter();
	const handledBfcacheId = useRef(bfcacheId);

	// Each replacement moves focus once: a kept page's effects run again whenever it is shown.
	useEffect(() => {
		const replaced = replacedContent.current || bfcacheId !== handledBfcacheId.current;
		replacedContent.current = false;
		handledBfcacheId.current = bfcacheId;
		if (replaced && focusFellToPage()) {
			ref.current?.focus();
		}
	}, [ref, bfcacheId]);
}
