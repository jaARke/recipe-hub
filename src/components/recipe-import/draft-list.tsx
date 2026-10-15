'use client';

import { FilePenLineIcon } from 'lucide-react';
import Link from 'next/link';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import type { RecipeFormEntrySubject } from '@/components/recipe-form/recipe-form-autosave';
import { DraftMenu } from '@/components/recipe-form/subject-menus';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { formatTimeAgo } from '@/components/recipe-import/time-ago';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import type { RecipeImportMode } from '@/domain/recipe/recipe-import';
import { formatDate } from '@/lib/dates';
import { settings } from '@/lib/settings';

// Where each import's draft came from.
const importModeLabels = {
	url: 'From a link',
	photo: 'From photos',
} as const satisfies Record<RecipeImportMode, string>;

const untitled = 'Untitled recipe';

function DraftsEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FilePenLineIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No drafts</EmptyTitle>
				<EmptyDescription>
					A draft you save stays here for {settings.drafts.savedDraftLifetimeDays} days after your
					last save, and an import you haven’t saved for {settings.imports.importDraftLifetimeDays}{' '}
					days.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

// Where the draft opens: an import's review, which opens the draft that continues it, or the add
// page's form.
function draftPath(draft: DraftSummaryDto): string {
	if (draft.kind === 'import') {
		return recipeImportPath(draft.id);
	}
	return draft.continuesImportId === undefined
		? savedDraftPath(draft.id)
		: recipeImportPath(draft.continuesImportId);
}

// The form whose unsaved changes in this browser go with the draft.
function draftFormSubject(draft: DraftSummaryDto): RecipeFormEntrySubject {
	if (draft.kind === 'import') {
		return { kind: 'import', importId: draft.id };
	}
	return draft.continuesImportId === undefined
		? { kind: 'draft', draftId: draft.id }
		: { kind: 'import', importId: draft.continuesImportId };
}

type DraftListProps = {
	drafts: readonly DraftSummaryDto[];
	// When the page rendered, which each draft's age counts back from.
	now: Date;
	// The member signed in, whose unsaved changes to a deleted draft go with it.
	memberId: string;
	deleteDraft: FormAction;
};

// The member's drafts, as the service lists them, each opening where it continues, with when it was
// saved and when it goes, and a menu holding Delete draft. The Drafts tab names the list, so it has
// no heading of its own. Deleting one refreshes the page, which drops its row.
function DraftList({ drafts, now, memberId, deleteDraft }: DraftListProps) {
	if (drafts.length === 0) {
		return <DraftsEmptyState />;
	}

	return (
		<ul className="divide-y">
			{drafts.map((draft) => {
				const name = draft.title ?? untitled;
				const savedAt = draft.kind === 'saved' ? draft.savedAt : draft.importedAt;
				return (
					<li
						key={draft.id}
						className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="flex min-w-0 flex-col gap-1">
							<p className="font-medium wrap-anywhere">{name}</p>
							<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
								<p>{draft.kind === 'import' ? importModeLabels[draft.mode] : 'Saved draft'}</p>
								<p>
									{draft.kind === 'import' ? 'Imported' : 'Saved'}{' '}
									<time dateTime={savedAt.toISOString()}>{formatTimeAgo(savedAt, now)}</time>
								</p>
								<p>
									Kept until{' '}
									<time dateTime={draft.expiresAt.toISOString()}>
										{formatDate(draft.expiresAt)}
									</time>
								</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2 sm:shrink-0">
							<Link href={draftPath(draft)} className={buttonVariants({ variant: 'outline' })}>
								Open<span className="sr-only"> {name}</span>
							</Link>
							<DraftMenu
								label={`Actions for ${name}`}
								draft={{ kind: draft.kind, id: draft.id }}
								title={draft.title}
								formSubject={draftFormSubject(draft)}
								memberId={memberId}
								action={deleteDraft}
							/>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

export { DraftList };
