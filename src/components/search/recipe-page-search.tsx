import { cn } from 'cn';
import { SearchIcon, XIcon } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import {
	recipeSearchHref,
	recipeSearchParamNames,
	recipesViewName,
	withoutText,
	type RecipeSearchField,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { SearchQueryInput } from '@/components/search/search-query-input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';

// A new search orders by best match, so the form carries the chapter and the filters but not the
// order.
const searchEditedFields: readonly RecipeSearchField[] = ['text', 'sort'];

type RecipePageSearchProps = {
	// The field's, which its label's id extends.
	id: string;
	state: RecipeSearchState;
};

// The Recipes page's search, within the view it shows: its label names the chapter, or All Recipes,
// and a search keeps the chapter and the filters from the first page. The words stay in the field to
// be refined, with an × that clears them alone.
function RecipePageSearch({ id, state }: RecipePageSearchProps) {
	const labelId = `${id}-label`;
	const clearHref = state.text === undefined ? undefined : recipeSearchHref(withoutText(state));

	return (
		<search aria-labelledby={labelId}>
			<Form action={recipeListPath}>
				<Field>
					<FieldLabel id={labelId} htmlFor={id}>
						{`Search ${recipesViewName(state).heading}`}
					</FieldLabel>
					<div className="flex gap-2">
						<InputGroup className="h-11">
							<SearchQueryInput
								id={id}
								type="search"
								name={recipeSearchParamNames.text}
								query={state.text ?? ''}
								enterKeyHint="search"
								// The × keeps the chapter and the filters; the browser's own clear only empties the field.
								className={cn(
									'h-full',
									clearHref !== undefined && '[&::-webkit-search-cancel-button]:hidden'
								)}
							/>
							<InputGroupAddon>
								<SearchIcon aria-hidden="true" />
							</InputGroupAddon>
							{clearHref !== undefined && (
								// The addon focuses the field on a click outside a button, so focus stays there as the ×
								// leaves.
								<InputGroupAddon align="inline-end">
									<Link
										href={clearHref}
										aria-label="Clear search"
										className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
									>
										<XIcon aria-hidden="true" />
									</Link>
								</InputGroupAddon>
							)}
						</InputGroup>
						<Button type="submit" size="lg" className="h-11">
							Search
						</Button>
					</div>
				</Field>
				{/* After the field, so the URL leads with the words, as recipeSearchHref writes it. */}
				<HiddenSearchFields state={state} editedFields={searchEditedFields} />
			</Form>
		</search>
	);
}

export { RecipePageSearch };
