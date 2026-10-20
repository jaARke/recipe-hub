'use client';

import { cn } from 'cn';
import { ChevronDownIcon } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { choiceListClassName, choiceRowClassName } from '@/components/forms/choice-list';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { formatCount } from '@/components/search/recipe-count';
import type {
	RecipeFilterGroup,
	RecipeFilterGroups,
	RecipeSortGroup,
} from '@/components/search/recipe-filter-counts';
import type { RecipeSearchParam } from '@/components/search/search-params';
import { buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Sort by or a filter: the radios or checkboxes of one URL parameter.
type RecipeChoiceGroup = RecipeSortGroup | RecipeFilterGroup;

type RecipeChoiceField = RecipeChoiceGroup['field'];

type ChooseOption = (field: RecipeChoiceField, value: string, chosen: boolean) => void;

// The sidebar's heading and the sheet's title.
const recipeFilterTitle = 'Filter and sort';

function isChosen(group: RecipeChoiceGroup, value: string): boolean {
	return group.selection === 'single' ? group.chosen === value : group.chosen.includes(value);
}

// A radio replaces its group's choice; a checkbox joins or leaves its group's, in the options' order.
function withChoice(group: RecipeFilterGroup, value: string, chosen: boolean): RecipeFilterGroup {
	if (group.selection === 'single') {
		return { ...group, chosen: value };
	}

	return {
		...group,
		chosen: group.options
			.map((option) => option.value)
			.filter((each) => (each === value ? chosen : group.chosen.includes(each))),
	};
}

// The groups with one option chosen or let go, as a change of a radio or checkbox makes them.
function withRecipeFilterChoice(
	groups: RecipeFilterGroups,
	field: RecipeChoiceField,
	value: string,
	chosen: boolean
): RecipeFilterGroups {
	if (field === groups.sort.field) {
		return { ...groups, sort: { ...groups.sort, chosen: value } };
	}

	return {
		...groups,
		filters: groups.filters.map((group) =>
			group.field === field ? withChoice(group, value, chosen) : group
		),
	};
}

// Clear all's choices: each filter at its any choice, the order kept.
function withoutRecipeFilterChoices(groups: RecipeFilterGroups): RecipeFilterGroups {
	return {
		...groups,
		filters: groups.filters.map((group) =>
			group.selection === 'single'
				? { ...group, chosen: group.defaultValue }
				: { ...group, chosen: [] }
		),
	};
}

// A group's choice as the URL holds it: each checkbox ticked, and a radio apart from the any choice or
// the view's own order, which leave the URL.
function choiceParams(group: RecipeChoiceGroup): RecipeSearchParam[] {
	if (group.selection === 'multiple') {
		return group.chosen.map((value) => ({ name: group.field, value }));
	}

	return group.chosen === group.defaultValue ? [] : [{ name: group.field, value: group.chosen }];
}

// The filters chosen, as the counts route and the page read them.
function recipeFilterParams(groups: RecipeFilterGroups): RecipeSearchParam[] {
	return groups.filters.flatMap(choiceParams);
}

// What the form submits: the words and the chapter it carries, the filters, then the order, which is
// last in every URL the page builds. Any change starts again from the first page.
function recipeFilterFormParams(
	groups: RecipeFilterGroups,
	carriedParams: readonly RecipeSearchParam[]
): RecipeSearchParam[] {
	return [...carriedParams, ...recipeFilterParams(groups), ...choiceParams(groups.sort)];
}

// The query string the params make, which the counts route reads and which tells choices apart.
function recipeFilterQuery(params: readonly RecipeSearchParam[]): string {
	return new URLSearchParams(params.map(({ name, value }) => [name, value])).toString();
}

// Whether the form's choices submit what the view already shows.
function sameRecipeFilterChoices(
	groups: RecipeFilterGroups,
	otherGroups: RecipeFilterGroups,
	carriedParams: readonly RecipeSearchParam[]
): boolean {
	return (
		recipeFilterQuery(recipeFilterFormParams(groups, carriedParams)) ===
		recipeFilterQuery(recipeFilterFormParams(otherGroups, carriedParams))
	);
}

type RecipeFilterFormProps = {
	// As chosen, which the form submits in hidden fields; the radios and checkboxes carry no names.
	groups: RecipeFilterGroups;
	// The words and the chapter, which name the view.
	carriedParams: readonly RecipeSearchParam[];
	ref?: React.Ref<HTMLFormElement>;
	onSubmit?: React.FormEventHandler<HTMLFormElement>;
	className?: string;
	children: React.ReactNode;
};

// Filter and sort's form, a GET to the Recipes page that pushes history, so Back undoes one change.
// It keeps the scroll position, so the results stay in view beside the sidebar; the sheet moves focus,
// and the page with it, to the heading.
function RecipeFilterForm({
	groups,
	carriedParams,
	ref,
	onSubmit,
	className,
	children,
}: RecipeFilterFormProps) {
	return (
		<Form
			ref={ref}
			action={recipeListPath}
			scroll={false}
			onSubmit={onSubmit}
			className={className}
		>
			{recipeFilterFormParams(groups, carriedParams).map(({ name, value }) => (
				<input key={`${name}=${value}`} type="hidden" name={name} value={value} />
			))}
			{children}
		</Form>
	);
}

// "More names (N)", which holds a group's options past its first few in place, so a choice never
// moves between parents and loses focus. It opens on its own when an option inside is chosen, and
// closes again only when the reader closes it.
function ChoiceFold({
	count,
	chosenInside,
	columns,
	children,
}: {
	count: number;
	chosenInside: boolean;
	columns: 1 | 2;
	children: React.ReactNode;
}) {
	const [open, setOpen] = React.useState(chosenInside);
	const [wasChosenInside, setWasChosenInside] = React.useState(chosenInside);
	if (chosenInside !== wasChosenInside) {
		setWasChosenInside(chosenInside);
		if (chosenInside) {
			setOpen(true);
		}
	}

	return (
		<details
			open={open}
			onToggle={(event) => setOpen(event.currentTarget.open)}
			className="group/fold col-span-full"
		>
			<summary
				className={buttonVariants({
					variant: 'ghost',
					size: 'sm',
					className: 'my-1 list-none [&::-webkit-details-marker]:hidden',
				})}
			>
				More names ({formatCount(count)})
				<ChevronDownIcon
					data-icon="inline-end"
					aria-hidden="true"
					className="transition-transform group-open/fold:rotate-180"
				/>
			</summary>
			<div className={cn(choiceListClassName, columns === 2 && 'grid-cols-2')}>{children}</div>
		</details>
	);
}

// One group under its legend, each option with what choosing it would show, dimmed and disabled at
// zero unless chosen. A disabled radio or checkbox keeps focus, since Base UI marks it aria-disabled
// and leaves it focusable, so unticking a box whose count is zero leaves focus on it.
function ChoiceGroup({
	group,
	columns,
	onChoose,
}: {
	group: RecipeChoiceGroup;
	columns: 1 | 2;
	onChoose: ChooseOption;
}) {
	const id = React.useId();
	const legendId = `${id}-legend`;
	const rows = group.options.map((option, index) => {
		const optionId = `${id}-${index}`;
		return {
			option,
			row: (
				<Field
					key={option.value}
					orientation="horizontal"
					data-disabled={option.disabled || undefined}
					className={choiceRowClassName}
				>
					{group.selection === 'single' ? (
						<RadioGroupItem id={optionId} value={option.value} disabled={option.disabled} />
					) : (
						<Checkbox
							id={optionId}
							checked={isChosen(group, option.value)}
							disabled={option.disabled}
							onCheckedChange={(checked) => onChoose(group.field, option.value, checked)}
						/>
					)}
					<FieldLabel htmlFor={optionId} className="font-normal">
						{option.label}{' '}
						{option.count !== undefined && (
							<span className="text-muted-foreground tabular-nums">
								({formatCount(option.count)})
							</span>
						)}
					</FieldLabel>
				</Field>
			),
		};
	});
	const folded = rows.filter(({ option }) => option.folded);
	const list = (
		<>
			{rows.filter(({ option }) => !option.folded).map(({ row }) => row)}
			{folded.length > 0 && (
				<ChoiceFold
					count={folded.length}
					chosenInside={folded.some(({ option }) => isChosen(group, option.value))}
					columns={columns}
				>
					{folded.map(({ row }) => row)}
				</ChoiceFold>
			)}
		</>
	);
	const listClassName = cn(choiceListClassName, columns === 2 && 'grid-cols-2');

	return (
		<FieldSet>
			<FieldLegend id={legendId} variant="label">
				{group.legend}
			</FieldLegend>
			{group.selection === 'single' ? (
				<RadioGroup
					// The legend names the field set, not the radio group inside it.
					aria-labelledby={legendId}
					value={group.chosen}
					onValueChange={(value: string) => onChoose(group.field, value, true)}
					className={listClassName}
				>
					{list}
				</RadioGroup>
			) : (
				<FieldGroup data-slot="checkbox-group" className={listClassName}>
					{list}
				</FieldGroup>
			)}
		</FieldSet>
	);
}

type RecipeFilterFieldsProps = {
	groups: RecipeFilterGroups;
	// One in the sidebar's narrow column; two in the sheet, as a phone's width allows.
	columns: 1 | 2;
	onChoose: ChooseOption;
};

// Sort by, then each filter, every group open.
function RecipeFilterFields({ groups, columns, onChoose }: RecipeFilterFieldsProps) {
	return (
		<FieldGroup>
			{[groups.sort, ...groups.filters].map((group) => (
				<ChoiceGroup key={group.field} group={group} columns={columns} onChoose={onChoose} />
			))}
		</FieldGroup>
	);
}

type RecipeFilterSidebarProps = {
	// As the view applies them.
	groups: RecipeFilterGroups;
	carriedParams: readonly RecipeSearchParam[];
	// The view without its filters, while it has any.
	clearAllHref: string | undefined;
	// h4 nests the heading under the design reference's own headings.
	headingTag?: 'h2' | 'h4';
};

// The sidebar's Filter and sort from lg, beside the results, applying each choice at once. Its fields
// show the view's choices as each page arrives, never remounted, so focus stays on the control chosen.
function RecipeFilterSidebar({
	groups,
	carriedParams,
	clearAllHref,
	headingTag: Heading = 'h2',
}: RecipeFilterSidebarProps) {
	const headingId = React.useId();
	const formRef = React.useRef<HTMLFormElement>(null);
	// Shows a choice while its page loads, until the page's own groups arrive.
	const [draft, setDraft] = React.useState(groups);
	const [shownGroups, setShownGroups] = React.useState(groups);
	if (groups !== shownGroups) {
		setShownGroups(groups);
		setDraft(groups);
	}

	function choose(field: RecipeChoiceField, value: string, chosen: boolean) {
		// The form's hidden fields must hold the choice before it submits.
		flushSync(() => setDraft((current) => withRecipeFilterChoice(current, field, value, chosen)));
		formRef.current?.requestSubmit();
	}

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-5">
			<div className="flex items-center justify-between gap-2">
				<Heading id={headingId} className="font-heading text-xl font-semibold">
					{recipeFilterTitle}
				</Heading>
				{clearAllHref !== undefined && (
					<Link
						href={clearAllHref}
						scroll={false}
						className={buttonVariants({ variant: 'ghost', size: 'sm' })}
					>
						Clear all
					</Link>
				)}
			</div>
			<RecipeFilterForm ref={formRef} groups={draft} carriedParams={carriedParams}>
				<RecipeFilterFields groups={draft} columns={1} onChoose={choose} />
			</RecipeFilterForm>
		</section>
	);
}

export {
	RecipeFilterFields,
	RecipeFilterForm,
	RecipeFilterSidebar,
	recipeFilterParams,
	recipeFilterQuery,
	recipeFilterTitle,
	sameRecipeFilterChoices,
	withRecipeFilterChoice,
	withoutRecipeFilterChoices,
};
