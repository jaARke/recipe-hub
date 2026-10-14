'use client';

import { useSyncExternalStore } from 'react';

function subscribeToNothing() {
	return () => {};
}

// False in the server's render and while hydrating, then true. Read in a component's first render,
// it tells one created in the browser (true) from one hydrated from the server's HTML (false).
export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribeToNothing,
		() => true,
		() => false
	);
}
