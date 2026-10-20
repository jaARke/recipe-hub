'use client';

import { cn } from 'cn';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useFocusOnReplace } from '@/components/forms/use-focus-on-replace';
import { formatCount, recipeCount } from '@/components/search/recipe-count';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { chapters } from '@/domain/recipe/chapter';

// All Recipes or a chapter, counted within the view's words and filters, and linking to it with them.
type RecipeChapterRow = {
	label: string;
	href: string;
	count: number;
	// Whether the view shown is this one.
	current: boolean;
};

const chaptersTitle = 'Chapters';

// All Recipes and each chapter.
const chapterRowCount = chapters.length + 1;

// The current row in semibold, and an empty one muted. An empty row stays a link, since its view says
// why nothing shows and offers ways out.
function rowEmphasis(row: RecipeChapterRow): string | undefined {
	if (row.current) {
		return 'font-semibold';
	}
	return row.count === 0 ? 'text-muted-foreground' : undefined;
}

// The sidebar's list from lg, its counts at the right and the current row ruled at its left.
function RecipeChaptersNav({
	rows,
	headingTag: Heading = 'h2',
}: {
	rows: readonly RecipeChapterRow[];
	// h4 nests the heading under the design reference's own headings.
	headingTag?: 'h2' | 'h4';
}) {
	const headingId = React.useId();

	return (
		<nav aria-labelledby={headingId} className="flex flex-col gap-3">
			<Heading id={headingId} className="font-heading text-xl font-semibold">
				{chaptersTitle}
			</Heading>
			<ol role="list" className="flex flex-col">
				{rows.map((row) => (
					<li key={row.href}>
						<Link
							href={row.href}
							aria-current={row.current ? 'page' : undefined}
							className={cn(
								'flex min-h-10 items-center gap-2 rounded-r-md border-l-2 py-1 pr-2 pl-3 text-sm hover:bg-state-layer',
								row.current ? 'border-primary' : 'border-transparent',
								rowEmphasis(row)
							)}
						>
							<span className="flex-1">{row.label}</span>
							<span className="font-normal text-muted-foreground tabular-nums">
								{formatCount(row.count)}
							</span>
						</Link>
					</li>
				))}
			</ol>
		</nav>
	);
}

// The sheet's list: each row with its count in recipes and a check on the current one, closing the
// sheet as it leads to its view.
function ChapterSheetRows({
	rows,
	onChoose,
}: {
	rows: Promise<readonly RecipeChapterRow[]>;
	onChoose: () => void;
}) {
	const shownRows = React.use(rows);

	return (
		<ol
			role="list"
			className="divide-y overflow-y-auto px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
			{shownRows.map((row) => (
				<li key={row.href}>
					<Link
						href={row.href}
						aria-current={row.current ? 'page' : undefined}
						onClick={onChoose}
						className={cn(
							'flex min-h-12 items-center gap-3 rounded-lg px-3 text-base hover:bg-state-layer',
							rowEmphasis(row)
						)}
					>
						<span className="flex-1">{row.label}</span>
						<span className="text-sm font-normal text-muted-foreground">
							{recipeCount(row.count)}
						</span>
						<CheckIcon aria-hidden="true" className={cn('size-4', !row.current && 'invisible')} />
					</Link>
				</li>
			))}
		</ol>
	);
}

// The sheet's rows while the view's counts are read.
function ChapterSheetRowsSkeleton() {
	return (
		<div role="status" className="flex flex-col gap-2 px-5 pt-2 pb-6">
			<span className="sr-only">Loading chapters</span>
			{Array.from({ length: chapterRowCount }, (_, index) => (
				<Skeleton key={index} aria-hidden="true" className="h-10 w-full" />
			))}
		</div>
	);
}

// The page's heading, naming the view. From lg it is plain text beside the sidebar's list; below lg it
// opens the list in a bottom sheet, a popup's trigger whose chevron stays still. A row closes the sheet
// as it leads to its view, and focus lands on the heading, which then names that view. Like the list's
// other headings, it takes the focus that fell with content it replaced.
function RecipeChapterPicker({
	id,
	heading,
	rows,
	headingTag: Heading = 'h1',
}: {
	// The heading's, which focus moves to as the list changes.
	id: string;
	heading: string;
	// Resolved once the view's counts are read, so the heading shows before them and only the open
	// sheet waits.
	rows: Promise<readonly RecipeChapterRow[]>;
	// h4 nests the heading under the design reference's own headings.
	headingTag?: 'h1' | 'h4';
}) {
	const headingRef = React.useRef<HTMLHeadingElement>(null);
	useFocusOnReplace(headingRef);
	const [open, setOpen] = React.useState(false);
	// Next keeps this page as Back or Forward moves between its views, so a new view's rows close the
	// sheet, as the filter sheet closes on a new view's choices.
	const [shownRows, setShownRows] = React.useState(rows);
	if (rows !== shownRows) {
		setShownRows(rows);
		setOpen(false);
	}
	// Set by a row, after which the heading itself takes focus once the sheet has closed: Base UI would
	// return it to the heading's first tabbable element, the trigger. It lasts until the sheet opens.
	const chose = React.useRef(false);
	const descriptionId = `${id}-description`;

	return (
		<Heading ref={headingRef} id={id} tabIndex={-1} className="font-heading text-4xl font-semibold">
			<span className="hidden lg:inline">{heading}</span>
			<Sheet
				open={open}
				onOpenChange={(isOpen) => {
					if (isOpen) {
						chose.current = false;
					}
					setOpen(isOpen);
				}}
				onOpenChangeComplete={(isOpen) => {
					if (!isOpen && chose.current) {
						headingRef.current?.focus();
					}
				}}
			>
				<SheetTrigger
					aria-describedby={descriptionId}
					render={
						<Button
							variant="ghost"
							className="-mx-2 h-auto gap-2 px-2 text-left text-4xl font-semibold whitespace-normal lg:hidden"
						/>
					}
				>
					{heading}
					<ChevronDownIcon aria-hidden="true" className="size-7" />
				</SheetTrigger>
				<SheetContent side="bottom" finalFocus={() => !chose.current}>
					<SheetHeader>
						<SheetTitle>{chaptersTitle}</SheetTitle>
					</SheetHeader>
					<React.Suspense fallback={<ChapterSheetRowsSkeleton />}>
						<ChapterSheetRows
							rows={rows}
							onChoose={() => {
								chose.current = true;
								setOpen(false);
							}}
						/>
					</React.Suspense>
				</SheetContent>
			</Sheet>
			{/* Outside the heading's name, which is the view's alone. */}
			<span id={descriptionId} hidden>
				Choose a chapter
			</span>
		</Heading>
	);
}

export { RecipeChapterPicker, RecipeChaptersNav, type RecipeChapterRow };
