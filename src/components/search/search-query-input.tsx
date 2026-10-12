'use client';

import * as React from 'react';
import { InputGroupInput } from '@/components/ui/input-group';

type SearchQueryInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, 'defaultValue'> & {
	query: string;
};

// The field keeps what was typed, so a navigation such as Back puts the URL's query back in it.
// Remounting it instead would drop focus on every search.
function SearchQueryInput({ query, ...props }: SearchQueryInputProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	React.useEffect(() => {
		if (inputRef.current !== null && inputRef.current.value !== query) {
			inputRef.current.value = query;
		}
	}, [query]);

	return <InputGroupInput ref={inputRef} defaultValue={query} {...props} />;
}

export { SearchQueryInput };
