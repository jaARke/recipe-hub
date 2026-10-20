'use client';

import { CircleCheckIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useShownThisVisit } from '@/components/layout/page-visits';
import { keptDraftParamName } from '@/components/recipe-import/recipe-entry-paths';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { hrefWithParams } from '@/lib/url-query';

type KeptDraftNoticeProps = {
	// The draft's name in the list, and where it opens.
	name: string;
	href: string;
};

// Says the draft just left is kept, on the start page its back link leads to, for that visit only.
// The URL that asked for it becomes the start page's own, so a reload says nothing.
function KeptDraftNotice({ name, href }: KeptDraftNoticeProps) {
	const shown = useShownThisVisit();

	React.useEffect(() => {
		const url = new URL(window.location.href);
		if (url.searchParams.has(keptDraftParamName)) {
			url.searchParams.delete(keptDraftParamName);
			window.history.replaceState(
				null,
				'',
				`${hrefWithParams(url.pathname, url.searchParams)}${url.hash}`
			);
		}
	}, []);

	if (!shown) {
		return null;
	}
	return (
		<Alert role="status" aria-live="polite">
			<CircleCheckIcon aria-hidden="true" />
			<AlertTitle>
				“{name}” is kept in your drafts, on any device. <Link href={href}>Open it</Link>
			</AlertTitle>
		</Alert>
	);
}

export { KeptDraftNotice };
