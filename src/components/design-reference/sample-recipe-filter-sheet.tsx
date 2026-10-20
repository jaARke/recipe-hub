'use client';

import * as React from 'react';
import { standIn } from '@/components/design-reference/stand-in-actions';
import { RecipeFilterSheet } from '@/components/search/recipe-filter-sheet';
import type { RecipeCountsReader } from '@/components/search/use-recipe-counts';

type SampleRecipeFilterSheetProps = Omit<
	React.ComponentProps<typeof RecipeFilterSheet>,
	'readCounts'
>;

// The filter sheet with a stand-in for the counts route, which answers after a moment with the
// smallest of the view's total and the counts of the filters chosen, leaving each option's count as
// the view's.
function SampleRecipeFilterSheet(props: SampleRecipeFilterSheetProps) {
	const { groups, tally } = props;
	const readCounts = React.useCallback<RecipeCountsReader>(
		(query) => {
			const chosenCounts = [...new URLSearchParams(query)]
				.map(
					([name, value]) =>
						groups.filters
							.find((group) => group.field === name)
							?.options.find((option) => option.value === value)?.count
				)
				.filter((count) => count !== undefined);
			return standIn({ total: Math.min(tally.total, ...chosenCounts), counts: tally.counts });
		},
		[groups, tally]
	);

	return <RecipeFilterSheet {...props} readCounts={readCounts} />;
}

export { SampleRecipeFilterSheet };
