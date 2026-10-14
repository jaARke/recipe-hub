'use client';

import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type RecipeSearchToolbarProps = {
	appliedFilterCount: number;
	// The heading above the results, focusable with tabIndex -1, which takes focus when the filters
	// apply.
	resultsHeadingId: string;
	// The results' count, announced as it changes.
	count: React.ReactNode;
	// The order, when there are results to order, compact so the row fits at 320 px.
	sort?: React.ReactNode;
	// The filters form, applied with its own button.
	filters: React.ReactNode;
};

// Below lg, Filters and the order share a row above the count, and the filters open between them,
// in the page's flow. Applying them closes them and moves focus to the results. From lg the filters
// sit in the sidebar, so the row holds the count and the order.
function RecipeSearchToolbar({
	appliedFilterCount,
	resultsHeadingId,
	count,
	sort,
	filters,
}: RecipeSearchToolbarProps) {
	const [open, setOpen] = React.useState(false);

	// The form navigates by itself; the panel only closes behind it.
	function closeOnApply() {
		document.getElementById(resultsHeadingId)?.focus();
		setOpen(false);
	}

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="flex flex-wrap items-center justify-between gap-4"
		>
			<CollapsibleTrigger render={<Button variant="outline" className="lg:hidden" />}>
				Filters
				{appliedFilterCount > 0 && (
					<Badge variant="secondary">
						{appliedFilterCount}
						<span className="sr-only"> applied</span>
					</Badge>
				)}
				<ChevronDownIcon
					data-icon="inline-end"
					aria-hidden="true"
					className="transition-transform group-data-panel-open/button:rotate-180"
				/>
			</CollapsibleTrigger>
			{/* Below the open filters below lg, and before the order from lg. */}
			<div className="max-lg:order-last max-lg:basis-full">{count}</div>
			{sort}
			<CollapsibleContent className="basis-full lg:hidden" onSubmit={closeOnApply}>
				{filters}
			</CollapsibleContent>
		</Collapsible>
	);
}

export { RecipeSearchToolbar };
