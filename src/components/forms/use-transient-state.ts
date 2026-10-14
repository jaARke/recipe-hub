'use client';

import { useLayoutEffect, useState } from 'react';

// State for what an attempt said, such as a confirmation or a refusal: undefined until set, and again
// once its page hides. Next keeps a page the member leaves and shows it again on return; the cleanup
// runs as the page hides and commits before it does, so nothing flashes on return.
export function useTransientState<T>() {
	const [value, setValue] = useState<T>();
	useLayoutEffect(() => () => setValue(undefined), []);
	return [value, setValue] as const;
}
