'use client';

import { useEffect, useRef } from 'react';

// Moves focus to the element with this id whenever the key changes, as when a form gives way to its
// next step. The first render leaves focus alone, so arriving on a page doesn't move it.
export function useFocusOnChange(key: string, targetId: string) {
	const previousKey = useRef(key);

	useEffect(() => {
		if (previousKey.current === key) {
			return;
		}
		previousKey.current = key;
		document.getElementById(targetId)?.focus();
	}, [key, targetId]);
}
