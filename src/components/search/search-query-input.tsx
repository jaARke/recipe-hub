'use client';

import * as React from 'react';
import { InputGroupInput } from '@/components/ui/input-group';

type SearchQueryInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, 'defaultValue'> & {
	query: string;
};

// The field keeps what was typed, so a navigation such as Back puts the URL's query back in it.
// Remounting it instead would drop focus on every search. Only a change of query after mount writes
// it, so text typed before the page hydrated stays.
function SearchQueryInput({ query, ...props }: SearchQueryInputProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	const writtenQuery = React.useRef(query);
	React.useEffect(() => {
		if (writtenQuery.current === query) {
			return;
		}
		writtenQuery.current = query;
		if (inputRef.current !== null && inputRef.current.value !== query) {
			inputRef.current.value = query;
		}
	}, [query]);

	return <InputGroupInput ref={inputRef} defaultValue={query} {...props} />;
}

export { SearchQueryInput };
