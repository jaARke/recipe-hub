import {
	carriedSearchParams,
	type RecipeSearchField,
	type RecipeSearchState,
} from '@/components/search/search-params';

// A search form submits only its own fields, so these carry the rest of the search along. Given a
// form's id, they join that form from wherever they render, as the search page's join the header's.
function HiddenSearchFields({
	state,
	editedFields,
	form,
}: {
	state: RecipeSearchState;
	editedFields: readonly RecipeSearchField[];
	form?: string;
}) {
	return carriedSearchParams(state, editedFields).map((param) => (
		<input
			key={`${param.name}=${param.value}`}
			type="hidden"
			form={form}
			name={param.name}
			value={param.value}
		/>
	));
}

export { HiddenSearchFields };
