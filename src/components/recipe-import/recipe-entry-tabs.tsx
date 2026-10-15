import type * as React from 'react';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import { CountBadge } from '@/components/layout/count-badge';
import { readingPartWidthClassName } from '@/components/layout/page-container';
import { RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { DraftList } from '@/components/recipe-import/draft-list';
import type { RecipeEntryTab } from '@/components/recipe-import/recipe-entry-paths';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Provenance } from '@/domain/recipe/provenance';

type EntryMode = Provenance['entryMode'];

// Short enough that the four tabs fit a 320 px screen with a two-digit draft count.
const entryModeTabs = [
	{ mode: 'manual', label: 'Manual' },
	{ mode: 'url', label: 'Link' },
	{ mode: 'photo', label: 'Photos' },
] as const satisfies readonly { mode: EntryMode & RecipeEntryTab; label: string }[];

const draftsTab = 'drafts' satisfies RecipeEntryTab;

// From lg, the recipe form widens the page to hold the original recipe beside it, and every other
// panel keeps reading width.
const panelClassNames = {
	manual: undefined,
	url: readingPartWidthClassName,
	photo: readingPartWidthClassName,
} as const satisfies Record<EntryMode, string | undefined>;

type RecipeEntryTabsProps = {
	forms: Record<EntryMode, React.ReactNode>;
	// The tab it opens on, which the page's URL names.
	defaultTab: RecipeEntryTab;
	// The member's drafts, which the Drafts tab lists.
	drafts: readonly DraftSummaryDto[];
	// When the page rendered, which each draft's age counts back from.
	now: Date;
	// The member signed in, and how a draft in the list is deleted.
	memberId: string;
	deleteDraft: FormAction;
};

// The three ways to add a recipe, one tab each, then the member's drafts, whose tab always shows so
// the row never shifts. Hidden tabs stay mounted, so switching keeps what was typed and lets uploads
// finish. A panel that opens with a field or a link takes no tab stop of its own.
function RecipeEntryTabs({
	forms,
	defaultTab,
	drafts,
	now,
	memberId,
	deleteDraft,
}: RecipeEntryTabsProps) {
	const draftCount = drafts.length;

	return (
		<Tabs defaultValue={defaultTab} className="gap-8">
			<TabsList activateOnFocus className="w-full sm:w-fit">
				{entryModeTabs.map(({ mode, label }) => (
					<TabsTrigger key={mode} value={mode}>
						{label}
					</TabsTrigger>
				))}
				<TabsTrigger value={draftsTab}>
					Drafts
					<CountBadge count={draftCount} />
				</TabsTrigger>
			</TabsList>
			{entryModeTabs.map(({ mode }) => (
				<TabsContent
					key={mode}
					value={mode}
					keepMounted
					tabIndex={-1}
					className={panelClassNames[mode]}
				>
					{forms[mode]}
				</TabsContent>
			))}
			<TabsContent
				value={draftsTab}
				keepMounted
				tabIndex={draftCount > 0 ? -1 : undefined}
				className={readingPartWidthClassName}
			>
				<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={deleteDraft} />
			</TabsContent>
		</Tabs>
	);
}

// Mirrors the tabs over the first tab's recipe form.
function RecipeEntryTabsSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			<Skeleton className="h-9 w-full sm:w-72" />
			<RecipeFormSkeleton />
		</div>
	);
}

export { RecipeEntryTabs, RecipeEntryTabsSkeleton };
