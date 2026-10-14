'use client';

import * as React from 'react';

// A message for screen readers, counted so a repeat of the one before is read again.
export type LiveAnnouncement = {
	message: string;
	count: number;
};

// The last thing a form said, and how it says the next.
export function useLiveAnnouncement(): [LiveAnnouncement, (message: string) => void] {
	const [announcement, setAnnouncement] = React.useState<LiveAnnouncement>({
		message: '',
		count: 0,
	});
	const announce = React.useCallback((message: string) => {
		setAnnouncement(({ count }) => ({ message, count: count + 1 }));
	}, []);
	return [announcement, announce];
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
