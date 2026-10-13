import { cn } from 'cn';
import { ChevronDownIcon } from 'lucide-react';
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
import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import {
	appliedFilterCount,
	recipeSearchHref,
	recipeSearchParamNames,
	type RecipeSearchField,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/components/ui/field';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { tagKey } from '@/domain/recipe/tag-normalization';

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
	'tags',
	'source',
	'contributorId',
	'maxTotalMinutes',
	'addedWithin',
];

// The most common tags show; the rest fold away under "More tags".
const shownTagCount = 8;

type TagOption = RecipeFacetCount & {
	checked: boolean;
};

// A null value is the select's "any" choice, which submits an empty value.
type ChoiceItem = {
	value: string | null;
	label: string;
	count?: number;
};

type FilterHeadingTag = 'h2' | 'h4';

// A checked tag always shows, even with no results left to count it, so it can be cleared.
function tagOptions(state: RecipeSearchState, facetTags: readonly RecipeFacetCount[]) {
	const checkedKeys = new Set(state.tags.map(tagKey));
	const facetKeys = new Set(facetTags.map((tag) => tagKey(tag.label)));
	const options: TagOption[] = [
		...facetTags.map((tag) => ({ ...tag, checked: checkedKeys.has(tagKey(tag.label)) })),
		...state.tags
			.filter((tag) => !facetKeys.has(tagKey(tag)))
			.map((label) => ({ label, count: 0, checked: true })),
	];

	return {
		shown: options.filter((option, index) => index < shownTagCount || option.checked),
		folded: options.filter((option, index) => index >= shownTagCount && !option.checked),
	};
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

function ChoiceSelect({
	id,
	name,
	items,
	defaultValue,
	descriptionId,
}: {
	id: string;
	name: string;
	items: readonly ChoiceItem[];
	defaultValue: string | null;
	descriptionId?: string;
}) {
	return (
		<Select name={name} items={items} defaultValue={defaultValue}>
			<SelectTrigger id={id} className="w-full" aria-describedby={descriptionId}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value ?? ''} value={item.value}>
						{item.label}
						{item.count !== undefined && (
							<>
								{' '}
								<span className="text-muted-foreground">{item.count}</span>
							</>
						)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function TagCheckboxes({
	idPrefix,
	options,
	className,
}: {
	idPrefix: string;
	options: readonly TagOption[];
	className?: string;
}) {
	return (
		<FieldGroup data-slot="checkbox-group" className={className}>
			{options.map((option, index) => (
				<Field key={tagKey(option.label)} orientation="horizontal">
					<Checkbox
						id={`${idPrefix}-${index}`}
						name={recipeSearchParamNames.tags}
						value={option.label}
						defaultChecked={option.checked}
					/>
					<FieldLabel htmlFor={`${idPrefix}-${index}`}>
						{option.label} <span className="text-muted-foreground">{option.count}</span>
					</FieldLabel>
				</Field>
			))}
		</FieldGroup>
	);
}

// Applied with its button rather than on each change, so choosing several filters loads once.
function RecipeSearchFilters({
	idPrefix,
	state,
	facets,
}: {
	idPrefix: string;
	state: RecipeSearchState;
	facets: RecipeSearchFacets;
}) {
	const tags = tagOptions(state, facets.tags);
	const source = sourceChoice(state, facets.sources);

	return (
		<Form action={recipeSearchPath} className="flex flex-col gap-6">
			<HiddenSearchFields state={state} editedFields={filterFields} />
			{/* Remounted when the search changes, so the fields show it; the button keeps focus. */}
			<FieldGroup key={recipeSearchHref(state)} className="gap-6">
				{tags.shown.length > 0 && (
					<FieldSet aria-describedby={`${idPrefix}-tags-description`}>
						<FieldLegend variant="label">Tags</FieldLegend>
						<FieldDescription id={`${idPrefix}-tags-description`}>
							Recipes with every selected tag.
						</FieldDescription>
						<TagCheckboxes idPrefix={`${idPrefix}-tag`} options={tags.shown} />
						{tags.folded.length > 0 && (
							<details className="group/more-tags">
								<summary className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
									More tags ({tags.folded.length})
									<ChevronDownIcon
										data-icon="inline-end"
										aria-hidden="true"
										className="transition-transform group-open/more-tags:rotate-180"
									/>
								</summary>
								<TagCheckboxes
									idPrefix={`${idPrefix}-more-tag`}
									options={tags.folded}
									className="pt-3"
								/>
							</details>
						)}
					</FieldSet>
				)}
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

type RecipeSearchFiltersPanelProps = {
	idPrefix: string;
	state: RecipeSearchState;
	facets: RecipeSearchFacets;
	headingTag: FilterHeadingTag;
	className?: string;
};

function RecipeSearchFiltersSidebar({
	idPrefix,
	state,
	facets,
	headingTag: Heading,
	className,
}: RecipeSearchFiltersPanelProps) {
	return (
		<section
			aria-labelledby={`${idPrefix}-heading`}
			className={cn('flex flex-col gap-6', className)}
		>
			<Heading id={`${idPrefix}-heading`} className="font-heading text-xl font-medium">
				Filters
			</Heading>
			<RecipeSearchFilters idPrefix={idPrefix} state={state} facets={facets} />
		</section>
	);
}

// Narrow screens fold the filters into a disclosure above the results.
function RecipeSearchFiltersDisclosure({
	idPrefix,
	state,
	facets,
	headingTag: Heading,
	className,
}: RecipeSearchFiltersPanelProps) {
	const appliedCount = appliedFilterCount(state);

	return (
		<section aria-labelledby={`${idPrefix}-heading`} className={className}>
			<Heading id={`${idPrefix}-heading`} className="sr-only">
				Filters
			</Heading>
			<details className="group/filters">
				<summary className={buttonVariants({ variant: 'outline' })}>
					Filters
					{appliedCount > 0 && (
						<Badge variant="secondary">
							{appliedCount}
							<span className="sr-only"> applied</span>
						</Badge>
					)}
					<ChevronDownIcon
						data-icon="inline-end"
						aria-hidden="true"
						className="transition-transform group-open/filters:rotate-180"
					/>
				</summary>
				<div className="pt-6">
					<RecipeSearchFilters idPrefix={idPrefix} state={state} facets={facets} />
				</div>
			</details>
		</section>
	);
}

export {
	addedWithinLabels,
	chosenContributor,
	RecipeSearchFilters,
	RecipeSearchFiltersDisclosure,
	RecipeSearchFiltersSidebar,
	totalTimeLabels,
};
