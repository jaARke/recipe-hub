'use client';

import type * as React from 'react';
import { BackLink } from '@/components/layout/back-link';
import { EditingPageHeading } from '@/components/recipe-form/editing-page-heading';
import { useHeldDraft } from '@/components/recipe-form/held-draft';
import { draftName } from '@/components/recipe-import/listed-drafts';
import { backToStartLabel } from '@/components/recipe-import/recipe-entry-heading';
import { keptDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { contributePath } from '@/components/recipe/recipe-paths';
import { Skeleton } from '@/components/ui/skeleton';

type DraftPageHeadingProps = {
	// h4 nests the heading under the design reference's own headings.
	headingTag?: 'h1' | 'h4';
	// The page's menu, which shows once the form holds a saved draft.
	menu?: React.ReactNode;
	// Under the heading, such as where an import's draft came from.
	children?: React.ReactNode;
};

// The heading of a new recipe's or a draft's page: the back link to the start page, which says there
// that the draft is kept once the form holds one, then the recipe's title as last saved, as the list
// of drafts names it.
function DraftPageHeading({ headingTag, menu, children }: DraftPageHeadingProps) {
	const draft = useHeldDraft();
	return (
		<div className="flex flex-col">
			<BackLink
				href={draft === undefined ? contributePath : keptDraftPath(draft.id)}
				className="mb-6"
			>
				{backToStartLabel}
			</BackLink>
			<div className="flex flex-col gap-2">
				<EditingPageHeading title={draftName(draft?.title)} headingTag={headingTag} menu={menu} />
				{children}
			</div>
		</div>
	);
}

// Mirrors the heading while the draft loads: the back link, which leads to the start page as it is,
// over the title's place.
function DraftPageHeadingSkeleton() {
	return (
		<div className="flex flex-col">
			<BackLink href={contributePath} className="mb-6">
				{backToStartLabel}
			</BackLink>
			<Skeleton className="h-10 w-64 max-w-full" />
		</div>
	);
}

export { DraftPageHeading, DraftPageHeadingSkeleton };
