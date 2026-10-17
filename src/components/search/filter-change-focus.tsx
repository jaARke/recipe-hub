'use client';

import * as React from 'react';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';

type FilterChangeFocusProps = {
	// The words and the filters, as recipeSearchFiltersKey writes them.
	filtersKey: string;
	// The heading above the results, focusable with tabIndex -1.
	resultsHeadingId: string;
};

// Moves focus to the results' heading, as a page link does, when the filters change and focus fell
// with the link that changed them, such as a removed filter's chip or Clear filters. A change from a
// control that stays, such as Apply filters, leaves focus where it is.
function FilterChangeFocus({ filtersKey, resultsHeadingId }: FilterChangeFocusProps) {
	const previousKey = React.useRef(filtersKey);

	React.useEffect(() => {
		if (previousKey.current === filtersKey) {
			return;
		}
		previousKey.current = filtersKey;
		if (focusFellToPage()) {
			document.getElementById(resultsHeadingId)?.focus();
		}
	}, [filtersKey, resultsHeadingId]);

	return null;
}

export { FilterChangeFocus };
