import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import { recipeSearchParamNames, type RecipeSearchState } from '@/components/search/search-params';
import { SearchQueryInput } from '@/components/search/search-query-input';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';

const queryInputId = 'search-query';
const queryDescriptionId = 'search-query-description';

// A new query keeps the filters and the order.
function RecipeSearchForm({ state }: { state: RecipeSearchState }) {
	return (
		<search className="max-w-2xl">
			<Form action={recipeSearchPath}>
				<HiddenSearchFields state={state} editedFields={['text']} />
				<Field>
					<FieldLabel htmlFor={queryInputId} className="sr-only">
						Search recipes
					</FieldLabel>
					<div className="flex gap-2">
						<InputGroup>
							<SearchQueryInput
								id={queryInputId}
								type="search"
								name={recipeSearchParamNames.text}
								query={state.text ?? ''}
								enterKeyHint="search"
								placeholder="Search recipes"
								aria-describedby={queryDescriptionId}
							/>
							<InputGroupAddon>
								<SearchIcon aria-hidden="true" />
							</InputGroupAddon>
						</InputGroup>
						<Button type="submit">Search</Button>
					</div>
					<FieldDescription id={queryDescriptionId}>
						Try &quot;brown butter&quot; for an exact phrase, or -nuts to leave nuts out.
					</FieldDescription>
				</Field>
			</Form>
		</search>
	);
}

export { RecipeSearchForm };
