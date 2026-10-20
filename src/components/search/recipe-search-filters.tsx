import { cn } from 'cn';
import Form from 'next/form';
import {
	recipeAddedWithin,
	type RecipeAddedWithin,
	type RecipeContributorCount,
	type RecipeFacetCount,
	type RecipeSearchFacets,
} from '@/application/ports/recipe-search';
import {
	recipeTotalTimeChoices,
	type RecipeTotalTimeChoice,
} from '@/application/search/recipe-search-dtos';
import { ChoiceSelect } from '@/components/search/choice-select';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import {
	recipeSearchFiltersKey,
	recipeSearchModePath,
	recipeSearchParamNames,
	type RecipeSearchField,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/components/ui/field';
import { chapterLabels, chapters } from '@/domain/recipe/chapter';
import { dietLabels, diets } from '@/domain/recipe/diet';
import { holidayLabels, holidays } from '@/domain/recipe/holiday';

const totalTimeLabels: Record<RecipeTotalTimeChoice, string> = {
	15: '15 minutes or less',
	30: '30 minutes or less',
	60: '1 hour or less',
	120: '2 hours or less',
};

const addedWithinLabels: Record<RecipeAddedWithin, string> = {
	week: 'Past week',
	month: 'Past month',
	year: 'Past year',
};

const filterFields: readonly RecipeSearchField[] = [
	'chapter',
	'holidays',
	'diets',
	'source',
	'contributorId',
	'maxTotalMinutes',
	'addedWithin',
];

type VocabularyOption<Value extends string> = RecipeFacetCount & {
	value: Value;
	checked: boolean;
};

type FilterHeadingTag = 'h2' | 'h4';

// The members with recipes to count, in the vocabulary's order. A chosen one always shows, even at
// zero, so it can be cleared.
function vocabularyOptions<Value extends string>(
	vocabulary: readonly Value[],
	labels: Record<Value, string>,
	counts: Record<Value, number>,
	chosen: readonly Value[]
): VocabularyOption<Value>[] {
	return vocabulary
		.map((value) => ({
			value,
			label: labels[value],
			count: counts[value],
			checked: chosen.includes(value),
		}))
		.filter((option) => option.checked || option.count > 0);
}

// Sources compare ignoring case, so the chosen one takes the spelling recipes use.
function sourceChoice(state: RecipeSearchState, facetSources: readonly RecipeFacetCount[]) {
	const chosen = state.source;
	if (chosen === undefined) {
		return { items: facetSources, value: null };
	}

	const match = facetSources.find((source) => source.label.toLowerCase() === chosen.toLowerCase());
	return match === undefined
		? { items: [...facetSources, { label: chosen, count: 0 }], value: chosen }
		: { items: facetSources, value: match.label };
}

// A contributor's value is an id and its label a name, which only the facet knows. Unlike a
// source, a chosen member missing from the facet cannot be added here, so the facet always lists it.
function chosenContributor(
	state: RecipeSearchState,
	facetContributors: readonly RecipeContributorCount[]
): RecipeContributorCount | undefined {
	return facetContributors.find((contributor) => contributor.memberId === state.contributorId);
}

// A checkbox for each option, left out when there is none to offer.
function VocabularyFilter<Value extends string>({
	idPrefix,
	legend,
	description,
	name,
	options,
}: {
	idPrefix: string;
	legend: string;
	description: string;
	name: string;
	options: readonly VocabularyOption<Value>[];
}) {
	if (options.length === 0) {
		return null;
	}

	return (
		<FieldSet aria-describedby={`${idPrefix}-description`}>
			<FieldLegend variant="label">{legend}</FieldLegend>
			<FieldDescription id={`${idPrefix}-description`}>{description}</FieldDescription>
			<FieldGroup data-slot="checkbox-group">
				{options.map((option) => (
					<Field key={option.value} orientation="horizontal">
						<Checkbox
							id={`${idPrefix}-${option.value}`}
							name={name}
							value={option.value}
							defaultChecked={option.checked}
						/>
						<FieldLabel htmlFor={`${idPrefix}-${option.value}`}>
							{option.label} <span className="text-muted-foreground">{option.count}</span>
						</FieldLabel>
					</Field>
				))}
			</FieldGroup>
		</FieldSet>
	);
}

type RecipeSearchFiltersProps = {
	idPrefix: string;
	state: RecipeSearchState;
	facets: RecipeSearchFacets;
};

// Applied with its button rather than on each change, so choosing several filters loads once. It
// submits to the search's own mode, so Browse's filters stay on Browse and Search's keep the words.
function RecipeSearchFilters({ idPrefix, state, facets }: RecipeSearchFiltersProps) {
	const chapterOptions = vocabularyOptions(
		chapters,
		chapterLabels,
		facets.chapters,
		state.chapter === undefined ? [] : [state.chapter]
	);
	const source = sourceChoice(state, facets.sources);

	return (
		<Form action={recipeSearchModePath(state)} className="flex flex-col gap-6">
			<HiddenSearchFields state={state} editedFields={filterFields} />
			{/* Remounted when the words or the filters change, so the fields show them, while a new order
			    or page keeps choices not yet applied; the button keeps focus. */}
			<FieldGroup key={recipeSearchFiltersKey(state)} className="gap-6">
				<Field>
					<FieldLabel htmlFor={`${idPrefix}-chapter`}>Chapter</FieldLabel>
					<ChoiceSelect
						id={`${idPrefix}-chapter`}
						name={recipeSearchParamNames.chapter}
						items={[{ value: null, label: 'Any chapter' }, ...chapterOptions]}
						defaultValue={state.chapter ?? null}
					/>
				</Field>
				<VocabularyFilter
					idPrefix={`${idPrefix}-holiday`}
					legend="Holidays"
					description="Recipes for any selected holiday."
					name={recipeSearchParamNames.holidays}
					options={vocabularyOptions(holidays, holidayLabels, facets.holidays, state.holidays)}
				/>
				<VocabularyFilter
					idPrefix={`${idPrefix}-diet`}
					legend="Diet"
					description="Recipes that suit every selected diet."
					name={recipeSearchParamNames.diets}
					options={vocabularyOptions(diets, dietLabels, facets.diets, state.diets)}
				/>
				<Field>
					<FieldLabel htmlFor={`${idPrefix}-source`}>Source</FieldLabel>
					<ChoiceSelect
						id={`${idPrefix}-source`}
						name={recipeSearchParamNames.source}
						items={[
							{ value: null, label: 'Any source' },
							...source.items.map(({ label, count }) => ({ value: label, label, count })),
						]}
						defaultValue={source.value}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${idPrefix}-contributor`}>Added by</FieldLabel>
					<ChoiceSelect
						id={`${idPrefix}-contributor`}
						name={recipeSearchParamNames.contributorId}
						items={[
							{ value: null, label: 'Anyone' },
							...facets.contributors.map(({ memberId, displayName, count }) => ({
								value: memberId,
								label: displayName,
								count,
							})),
						]}
						defaultValue={chosenContributor(state, facets.contributors)?.memberId ?? null}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${idPrefix}-time`}>Total time</FieldLabel>
					<ChoiceSelect
						id={`${idPrefix}-time`}
						name={recipeSearchParamNames.maxTotalMinutes}
						items={[
							{ value: null, label: 'Any time' },
							...recipeTotalTimeChoices.map((minutes) => ({
								value: String(minutes),
								label: totalTimeLabels[minutes],
							})),
						]}
						defaultValue={
							state.maxTotalMinutes === undefined ? null : String(state.maxTotalMinutes)
						}
						descriptionId={`${idPrefix}-time-description`}
					/>
					<FieldDescription id={`${idPrefix}-time-description`}>
						Recipes without a time are left out.
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${idPrefix}-added`}>Date added</FieldLabel>
					<ChoiceSelect
						id={`${idPrefix}-added`}
						name={recipeSearchParamNames.addedWithin}
						items={[
							{ value: null, label: 'Any time' },
							...recipeAddedWithin.map((within) => ({
								value: within,
								label: addedWithinLabels[within],
							})),
						]}
						defaultValue={state.addedWithin ?? null}
					/>
				</Field>
			</FieldGroup>
			<Button type="submit" className="self-start">
				Apply filters
			</Button>
		</Form>
	);
}

type RecipeSearchFiltersSidebarProps = RecipeSearchFiltersProps & {
	headingTag: FilterHeadingTag;
	className?: string;
};

function RecipeSearchFiltersSidebar({
	headingTag: Heading,
	className,
	...filters
}: RecipeSearchFiltersSidebarProps) {
	return (
		<section
			aria-labelledby={`${filters.idPrefix}-heading`}
			className={cn('flex flex-col gap-6', className)}
		>
			<Heading id={`${filters.idPrefix}-heading`} className="font-heading text-xl font-semibold">
				Filters
			</Heading>
			<RecipeSearchFilters {...filters} />
		</section>
	);
}

export {
	addedWithinLabels,
	chosenContributor,
	RecipeSearchFilters,
	RecipeSearchFiltersSidebar,
	totalTimeLabels,
};
