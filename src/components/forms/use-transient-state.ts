'use client';

import { useState } from 'react';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';

// State for what an attempt said, such as a confirmation or a refusal: undefined until set, and again
// once its page hides.
export function useTransientState<T>() {
	const [value, setValue] = useState<T>();
	useOnKeptPageHide(() => setValue(undefined));
	return [value, setValue] as const;
}
