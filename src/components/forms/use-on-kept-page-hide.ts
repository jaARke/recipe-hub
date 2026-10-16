'use client';

import { useEffectEvent, useLayoutEffect } from 'react';

// Runs as its page hides, or as it unmounts, with what its last render saw. Next keeps a page the
// member leaves and shows it again on return; state set here commits before the page shows again,
// so nothing flashes on return.
export function useOnKeptPageHide(onHide: () => void) {
	const hide = useEffectEvent(onHide);
	useLayoutEffect(() => () => hide(), []);
}
