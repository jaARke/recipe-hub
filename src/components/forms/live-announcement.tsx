'use client';

import * as React from 'react';
import { useTransientState } from '@/components/forms/use-transient-state';

// A message for screen readers, counted so a repeat of the one before is read again.
export type LiveAnnouncement = {
	message: string;
	count: number;
};

const noAnnouncement: LiveAnnouncement = { message: '', count: 0 };

// The last thing a form said, and how it says the next. It lasts only while its page is shown, so a
// page shown again has nothing to read.
export function useLiveAnnouncement(): [LiveAnnouncement, (message: string) => void] {
	const [announcement, setAnnouncement] = useTransientState<LiveAnnouncement>();
	const announce = React.useCallback(
		(message: string) => {
			setAnnouncement((last) => ({ message, count: (last?.count ?? 0) + 1 }));
		},
		[setAnnouncement]
	);
	return [announcement ?? noAnnouncement, announce];
}

// A polite live region out of the layout, which says what an edit did, such as a move. Each message
// arrives as a new node in place of the last, which screen readers read even when its words repeat.
function LiveAnnouncer({ announcement }: { announcement: LiveAnnouncement }) {
	return (
		<p role="status" aria-live="polite" className="sr-only">
			<span key={announcement.count}>{announcement.message}</span>
		</p>
	);
}

export { LiveAnnouncer };
