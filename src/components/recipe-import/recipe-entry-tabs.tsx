import type * as React from 'react';
import type { UnsavedImportDto } from '@/application/ingestion/recipe-import-dtos';
import { CountBadge } from '@/components/layout/count-badge';
import { readingWidthClassName } from '@/components/layout/page-container';
import { RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { UnsavedImportList } from '@/components/recipe-import/unsaved-import-list';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Provenance } from '@/domain/recipe/provenance';

type EntryMode = Provenance['entryMode'];

// Short enough that the four tabs fit a 320 px screen with a two-digit draft count.
const entryModeTabs = [
	{ mode: 'manual', label: 'Manual' },
	{ mode: 'url', label: 'Link' },
	{ mode: 'photo', label: 'Photos' },
] as const satisfies readonly { mode: EntryMode; label: string }[];

const draftsTab = 'drafts';

// From lg, the recipe form widens the page to hold the original recipe beside it, and every other
// panel keeps reading width.
const panelClassNames = {
	manual: undefined,
	url: readingWidthClassName,
	photo: readingWidthClassName,
} as const satisfies Record<EntryMode, string | undefined>;

type RecipeEntryTabsProps = {
	forms: Record<EntryMode, React.ReactNode>;
	// The member's unsaved drafts, which the Drafts tab lists.
	unsavedImports: readonly UnsavedImportDto[];
	// When the page rendered, which each draft's age counts back from.
	now: Date;
};

// The three ways to add a recipe, one tab each, then the member's drafts, whose tab always shows so
// the row never shifts. Hidden tabs stay mounted, so switching keeps what was typed and lets uploads
// finish. A panel that opens with a field or a link takes no tab stop of its own.
function RecipeEntryTabs({ forms, unsavedImports, now }: RecipeEntryTabsProps) {
	const draftCount = unsavedImports.length;

	return (
		<Tabs defaultValue="manual" className="gap-8">
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
				className={readingWidthClassName}
			>
				<UnsavedImportList imports={unsavedImports} now={now} />
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
