'use client';

import { SlidersHorizontalIcon } from 'lucide-react';
import * as React from 'react';
import { recipeCount } from '@/components/search/recipe-count';
import {
	withRecipeFilterCounts,
	type RecipeFilterGroups,
} from '@/components/search/recipe-filter-counts';
import {
	RecipeFilterFields,
	RecipeFilterForm,
	recipeFilterParams,
	recipeFilterQuery,
	recipeFilterTitle,
	sameRecipeFilterChoices,
	withoutRecipeFilterChoices,
	withRecipeFilterChoice,
} from '@/components/search/recipe-filter-form';
import type { RecipeSearchParam } from '@/components/search/search-params';
import {
	fetchRecipeCounts,
	useRecipeCounts,
	type RecipeCountsReader,
	type RecipeFilterTally,
} from '@/components/search/use-recipe-counts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';

const countFailedMessage = 'Couldn’t count the recipes';

// The counts route's query for the choices: the words, the chapter, and the filters, since neither
// the order nor the page changes a count.
function countsQuery(
	groups: RecipeFilterGroups,
	carriedParams: readonly RecipeSearchParam[]
): string {
	return recipeFilterQuery([...carriedParams, ...recipeFilterParams(groups)]);
}

type RecipeFilterSheetFormProps = {
	groups: RecipeFilterGroups;
	tally: RecipeFilterTally;
	carriedParams: readonly RecipeSearchParam[];
	readCounts: RecipeCountsReader;
	onApply: () => void;
};

// The sheet's form, mounted while the sheet is open, so each opening starts from the view's choices
// and closing drops what wasn't applied, with any count still on its way.
function RecipeFilterSheetForm({
	groups,
	tally,
	carriedParams,
	readCounts,
	onApply,
}: RecipeFilterSheetFormProps) {
	const [draft, setDraft] = React.useState(groups);
	const counts = useRecipeCounts(
		countsQuery(draft, carriedParams),
		{ query: countsQuery(groups, carriedParams), tally },
		readCounts
	);
	const total = counts.current.kind === 'counted' ? counts.current.tally.total : undefined;
	// Said once a change is counted, or couldn't be, and not for the view the sheet opened on.
	let status: string | undefined;
	if (draft !== groups && total !== undefined) {
		status = recipeCount(total);
	} else if (draft !== groups && counts.current.kind === 'failed') {
		status = countFailedMessage;
	}

	return (
		<RecipeFilterForm
			groups={draft}
			carriedParams={carriedParams}
			// The body scrolls between the header and the footer.
			className="flex min-h-0 flex-col"
			onSubmit={(event) => {
				// Choices the view already shows need no new page, nor a history entry.
				if (sameRecipeFilterChoices(draft, groups, carriedParams)) {
					event.preventDefault();
				}
				onApply();
			}}
		>
			<div className="overflow-y-auto px-4 py-6">
				<RecipeFilterFields
					groups={{
						...draft,
						filters: withRecipeFilterCounts(draft.filters, counts.latest.counts),
					}}
					columns={2}
					onChoose={(field, value, chosen) =>
						setDraft((current) => withRecipeFilterChoice(current, field, value, chosen))
					}
				/>
			</div>
			<p role="status" aria-live="polite" className="sr-only">
				{status}
			</p>
			<SheetFooter>
				<Button
					type="button"
					variant="ghost"
					size="lg"
					onClick={() => setDraft((current) => withoutRecipeFilterChoices(current))}
				>
					Clear all
				</Button>
				{/* Without a count for the choices, it still applies them. */}
				<Button type="submit" size="lg">
					{total === undefined ? 'Show recipes' : `Show ${recipeCount(total)}`}
				</Button>
			</SheetFooter>
		</RecipeFilterForm>
	);
}

type RecipeFilterSheetProps = {
	// As the view applies them.
	groups: RecipeFilterGroups;
	// The view's own total and counts, which the sheet shows until a change is counted.
	tally: RecipeFilterTally;
	carriedParams: readonly RecipeSearchParam[];
	// The filters the view applies, which the trigger counts.
	appliedCount: number;
	// The page's h1, focusable with tabIndex -1, which takes focus once Show applies.
	headingId: string;
	// The counts route, or the design reference's stand-in for it.
	readCounts?: RecipeCountsReader;
};

// Filter and sort below lg: a button, counting the filters applied, opens the form in a bottom sheet,
// its groups in two columns, every one open. Choices apply with "Show N recipes", whose count follows
// them as they change; Clear all clears the sheet's choices, not the view's. The page shows it below
// lg, where the sidebar's form is hidden.
function RecipeFilterSheet({
	appliedCount,
	headingId,
	readCounts = fetchRecipeCounts,
	...form
}: RecipeFilterSheetProps) {
	const [open, setOpen] = React.useState(false);
	// Next keeps this page as Back or Forward moves between its views, so a new view closes the sheet,
	// dropping choices made on the view it left, as a hidden page closes its popups.
	const [shownGroups, setShownGroups] = React.useState(form.groups);
	if (form.groups !== shownGroups) {
		setShownGroups(form.groups);
		setOpen(false);
	}
	// Set by Show, whose focus goes to the heading rather than back to the trigger. It lasts until the
	// sheet next opens, since the sheet decides where focus returns after it has closed.
	const applied = React.useRef(false);

	return (
		<Sheet
			open={open}
			onOpenChange={(isOpen) => {
				if (isOpen) {
					applied.current = false;
				}
				setOpen(isOpen);
			}}
			onOpenChangeComplete={(isOpen) => {
				if (!isOpen && applied.current) {
					document.getElementById(headingId)?.focus();
				}
			}}
		>
			<SheetTrigger render={<Button variant="outline" size="lg" />}>
				<SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />
				{recipeFilterTitle}
				{appliedCount > 0 && (
					<Badge variant="secondary">
						{appliedCount}
						<span className="sr-only"> applied</span>
					</Badge>
				)}
			</SheetTrigger>
			{/* Base UI would focus the heading's first tabbable element, the chapter picker's button below
			    lg, so Show returns no focus and the heading takes it once the sheet has closed. */}
			<SheetContent side="bottom" finalFocus={() => !applied.current}>
				<SheetHeader>
					<SheetTitle>{recipeFilterTitle}</SheetTitle>
				</SheetHeader>
				<RecipeFilterSheetForm
					{...form}
					readCounts={readCounts}
					onApply={() => {
						applied.current = true;
						setOpen(false);
					}}
				/>
			</SheetContent>
		</Sheet>
	);
}

export { RecipeFilterSheet };
