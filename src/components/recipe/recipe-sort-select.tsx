'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import type { RecipeSearchSort } from '@/application/ports/recipe-search';
import { recipeListParamNames } from '@/components/recipe/recipe-paths';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

const sortLabels: Record<RecipeSearchSort, string> = {
	relevance: 'Best match',
	newest: 'Newest',
	title: 'A to Z',
};

type RecipeSortSelectProps = {
	id: string;
	sorts: readonly RecipeSearchSort[];
	value: RecipeSearchSort;
};

// Submits its form on selection, so the new order applies at once.
function RecipeSortSelect({ id, sorts, value }: RecipeSortSelectProps) {
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const [sort, setSort] = React.useState(value);
	const [currentValue, setCurrentValue] = React.useState(value);
	// The order can change without this select, as when Back returns to an earlier page.
	if (value !== currentValue) {
		setCurrentValue(value);
		setSort(value);
	}
	const items = sorts.map((option) => ({ value: option, label: sortLabels[option] }));

	function submitSort(next: RecipeSearchSort | null) {
		if (next === null) {
			return;
		}

		// The select's hidden input must hold the new order before the form reads it.
		flushSync(() => setSort(next));
		triggerRef.current?.form?.requestSubmit();
	}

	return (
		<Select name={recipeListParamNames.sort} items={items} value={sort} onValueChange={submitSort}>
			<SelectTrigger ref={triggerRef} id={id} className="w-36">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export { RecipeSortSelect };
