import * as React from 'react';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import { DraftList, DraftListSkeleton } from '@/components/recipe-import/draft-list';
import { KeptDraftNotice } from '@/components/recipe-import/kept-draft-notice';
import { draftName } from '@/components/recipe-import/listed-drafts';
import { recipeEntryTitles } from '@/components/recipe-import/recipe-entry-heading';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { RecipeStartList } from '@/components/recipe-import/recipe-start-list';
import { settings } from '@/lib/settings';

// Keyed by the page heading's level; level 4 nests the page under the design reference's own headings.
const startHeadingTags = {
	1: { page: 'h1', section: 'h2' },
	4: { page: 'h4', section: 'h5' },
} as const;

type StartHeadingLevel = keyof typeof startHeadingTags;

type RecipeStartProps = {
	headingLevel?: StartHeadingLevel;
	// The draft just left by its back link, as listed, which the notice names.
	kept?: DraftSummaryDto;
	drafts: readonly DraftSummaryDto[];
	// When the page rendered, which each draft's age counts back from.
	now: Date;
	deleteDraft: FormAction;
};

function StartSection({
	heading: Heading,
	title,
	children,
}: {
	heading: 'h2' | 'h5';
	title: string;
	children: React.ReactNode;
}) {
	const headingId = React.useId();
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<Heading id={headingId} className="font-heading text-2xl font-semibold">
				{title}
			</Heading>
			{children}
		</section>
	);
}

// The add pages' start: the ways to start a new recipe, then the member's drafts and how long each is
// kept, under a notice naming the draft just left, if any.
function RecipeStart({ headingLevel = 1, kept, drafts, now, deleteDraft }: RecipeStartProps) {
	const { page: Heading, section } = startHeadingTags[headingLevel];
	return (
		<div className="flex flex-col gap-10">
			<Heading className="font-heading text-4xl font-semibold">{recipeEntryTitles.start}</Heading>
			{kept !== undefined && (
				<KeptDraftNotice name={draftName(kept.title)} href={savedDraftPath(kept.id)} />
			)}
			<StartSection heading={section} title="Start a new recipe">
				<RecipeStartList />
			</StartSection>
			<StartSection heading={section} title="Your drafts">
				<DraftList drafts={drafts} now={now} deleteDraft={deleteDraft} />
				<p className="text-sm text-muted-foreground">
					Only you can see your drafts until you add them to the cookbook. Each is kept for{' '}
					{settings.drafts.draftLifetimeDays} days after its last change.
				</p>
			</StartSection>
		</div>
	);
}

// Mirrors the start while the member's drafts load: the ways in show as they will.
function RecipeStartSkeleton() {
	const { page: Heading, section } = startHeadingTags[1];
	return (
		<div className="flex flex-col gap-10">
			<Heading className="font-heading text-4xl font-semibold">{recipeEntryTitles.start}</Heading>
			<StartSection heading={section} title="Start a new recipe">
				<RecipeStartList />
			</StartSection>
			<StartSection heading={section} title="Your drafts">
				<DraftListSkeleton />
			</StartSection>
		</div>
	);
}

export { RecipeStart, RecipeStartSkeleton };
