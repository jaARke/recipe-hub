import {
	carriedSearchParams,
	type RecipeSearchField,
	type RecipeSearchState,
} from '@/components/search/search-params';

// A search form submits only its own fields, so these carry the rest of the search along.
function HiddenSearchFields({
	state,
	editedFields,
}: {
	state: RecipeSearchState;
	editedFields: readonly RecipeSearchField[];
}) {
	return carriedSearchParams(state, editedFields).map((param) => (
		<input
			key={`${param.name}=${param.value}`}
			type="hidden"
			name={param.name}
			value={param.value}
		/>
	));
}

export { HiddenSearchFields };
