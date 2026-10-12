import Form from 'next/form';
import * as React from 'react';
import type { RecipeSearchSort } from '@/application/ports/recipe-search';
import { RecipeSortSelect } from '@/components/recipe/recipe-sort-select';
import { Field, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';

type RecipeSortFormProps = {
	id: string;
	action: string;
	sorts: readonly RecipeSearchSort[];
	value: RecipeSearchSort;
	// Hidden inputs carrying the rest of the page's state.
	children?: React.ReactNode;
};

// Keeps the scroll position, so the results stay in view when the order changes.
function RecipeSortForm({ id, action, sorts, value, children }: RecipeSortFormProps) {
	return (
		<Form action={action} scroll={false}>
			{children}
			<Field orientation="horizontal" className="w-auto">
				<FieldLabel htmlFor={id} className="whitespace-nowrap">
					Sort by
				</FieldLabel>
				<RecipeSortSelect id={id} sorts={sorts} value={value} />
			</Field>
		</Form>
	);
}

function RecipeSortFormSkeleton() {
	// Purely visual: the loading region that renders skeletons announces the loading state.
	return <Skeleton aria-hidden="true" className="h-9 w-52" />;
}

export { RecipeSortForm, RecipeSortFormSkeleton };
