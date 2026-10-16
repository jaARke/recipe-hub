'use client';

import { FilePenLineIcon } from 'lucide-react';
import Link from 'next/link';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import type { HeldDraft } from '@/components/recipe-form/held-draft';
import type { RecipeFormEntrySubject } from '@/components/recipe-form/recipe-form-autosave';
import { DraftMenu } from '@/components/recipe-form/subject-menus';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { formatTimeAgo } from '@/components/recipe-import/time-ago';
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

// Where each import's draft came from, and each draft saved from an import's review.
const importModeLabels = {
	url: 'From a link',
	photo: 'From photos',
} as const satisfies Record<RecipeImportMode, string>;

const untitled = 'Untitled recipe';

// A draft as the list shows it: as the service listed it, or as the page's form saved it since, by
// the id the form holds.
export type ListedDraft =
	DraftSummaryDto | (Omit<Extract<DraftSummaryDto, { kind: 'saved' }>, 'id'> & { id: string });

// The drafts as the page listed them, with the draft its form holds as it last saved it there, which
// the list was rendered without: in its place when listed, keeping where it came from, or else
// first, as the newest.
export function withHeldDraft(
	drafts: readonly ListedDraft[],
	held: HeldDraft | undefined
): readonly ListedDraft[] {
	if (held?.saved === undefined) {
		return drafts;
	}
	const index = drafts.findIndex(({ kind, id }) => kind === 'saved' && id === held.id);
	const listed = drafts[index]?.kind === 'saved' ? drafts[index] : undefined;
	const saved: ListedDraft = {
		kind: 'saved',
		id: held.id,
		...(listed?.continuesImportId !== undefined && { continuesImportId: listed.continuesImportId }),
		...(listed?.mode !== undefined && { mode: listed.mode }),
		...(held.title !== undefined && { title: held.title }),
		savedAt: held.saved.savedAt,
		expiresAt: held.saved.expiresAt,
	};
	return listed === undefined ? [saved, ...drafts] : drafts.with(index, saved);
}

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
function draftPath(draft: ListedDraft): string {
	if (draft.kind === 'import') {
		return recipeImportPath(draft.id);
	}
	return draft.continuesImportId === undefined
		? savedDraftPath(draft.id)
		: recipeImportPath(draft.continuesImportId);
}

// The form whose unsaved changes in this browser go with the draft.
function draftFormSubject(draft: ListedDraft): RecipeFormEntrySubject {
	if (draft.kind === 'import') {
		return { kind: 'import', importId: draft.id };
	}
	return draft.continuesImportId === undefined
		? { kind: 'draft', draftId: draft.id }
		: { kind: 'import', importId: draft.continuesImportId };
}

type DraftListProps = {
	drafts: readonly ListedDraft[];
	// When the page rendered, which each draft's age counts back from.
	now: Date;
	// The member signed in, whose unsaved changes to a deleted draft go with it.
	memberId: string;
	deleteDraft: FormAction;
};

// The member's drafts, as the page lists them, each a link to where it continues, named by its
// title and described by when it was saved and when it goes, with a menu holding Delete draft
// beside it. The Drafts tab names the list, so it has no heading of its own. Deleting one refreshes
// the page, which drops its row.
function DraftList({ drafts, now, memberId, deleteDraft }: DraftListProps) {
	if (drafts.length === 0) {
		return <DraftsEmptyState />;
	}

	return (
		<ul className="divide-y">
			{drafts.map((draft) => {
				const name = draft.title ?? untitled;
				const savedAt = draft.kind === 'saved' ? draft.savedAt : draft.importedAt;
				// The title names the link, and each detail describes it, read apart as shown apart.
				const ids = {
					title: `${draft.id}-draft-title`,
					kind: `${draft.id}-draft-kind`,
					saved: `${draft.id}-draft-saved`,
					kept: `${draft.id}-draft-kept`,
				};
				return (
					<li key={draft.id} className="flex items-center gap-4">
						<Link
							href={draftPath(draft)}
							aria-labelledby={ids.title}
							aria-describedby={`${ids.kind} ${ids.saved} ${ids.kept}`}
							className="group flex min-w-0 flex-1 flex-col gap-1 py-4"
						>
							<span
								id={ids.title}
								className="font-medium wrap-anywhere underline-offset-4 group-hover:underline"
							>
								{name}
							</span>
							<span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
								<span id={ids.kind}>
									{draft.mode === undefined ? 'Saved draft' : importModeLabels[draft.mode]}
								</span>
								<span id={ids.saved}>
									{draft.kind === 'import' ? 'Imported' : 'Saved'}{' '}
									<time dateTime={savedAt.toISOString()}>{formatTimeAgo(savedAt, now)}</time>
								</span>
								<span id={ids.kept}>
									Kept until{' '}
									<time dateTime={draft.expiresAt.toISOString()}>
										{formatDate(draft.expiresAt)}
									</time>
								</span>
							</span>
						</Link>
						<DraftMenu
							label={`Actions for ${name}`}
							draft={{ kind: draft.kind, id: draft.id }}
							title={draft.title}
							formSubject={draftFormSubject(draft)}
							memberId={memberId}
							action={deleteDraft}
						/>
					</li>
				);
			})}
		</ul>
	);
}

export { DraftList };
