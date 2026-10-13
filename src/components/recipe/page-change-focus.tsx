'use client';

import * as React from 'react';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';

type PageChangeFocusProps = {
	page: number;
	// The heading above the results, which takes focus when a link here changes the page.
	resultsHeadingId: string;
	children: React.ReactNode;
};

// Holds the pagination. A link here changes the page and scrolls to the top while keeping focus at
// the bottom, so the results' heading takes it. A page change from elsewhere, such as a new order,
// leaves focus where it is.
function PageChangeFocus({ page, resultsHeadingId, children }: PageChangeFocusProps) {
	const frameRef = React.useRef<HTMLDivElement>(null);
	const previousPage = React.useRef(page);

	React.useEffect(() => {
		if (previousPage.current === page) {
			return;
		}
		previousPage.current = page;
		if (focusFellToPage() || frameRef.current?.contains(document.activeElement)) {
			document.getElementById(resultsHeadingId)?.focus();
		}
	}, [page, resultsHeadingId]);

	return (
		<div ref={frameRef} className="flex flex-col items-center gap-3">
			{children}
		</div>
	);
}

export { PageChangeFocus };
