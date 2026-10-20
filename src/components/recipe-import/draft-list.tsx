import Link from 'next/link';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import { DraftMenu } from '@/components/recipe-form/subject-menus';
import {
	draftFormSubject,
	draftName,
	listedDraftPath,
} from '@/components/recipe-import/listed-drafts';
import { formatTimeAgo } from '@/components/recipe-import/time-ago';
import { Skeleton } from '@/components/ui/skeleton';
import type { Provenance } from '@/domain/recipe/provenance';
import { formatDate } from '@/lib/dates';

// How each draft started: typed in, or read from a link or photos, which a draft saved from an
// import's review keeps once the review is gone.
const startedLabels = {
	manual: 'Typed in',
	url: 'From a link',
	photo: 'From photos',
} as const satisfies Record<Provenance['entryMode'], string>;

type DraftListProps = {
	drafts: readonly DraftSummaryDto[];
	// When the page rendered, which each draft's age counts back from.
	now: Date;
	// The member signed in, whose unsaved changes to a deleted draft go with it.
	memberId: string;
	deleteDraft: FormAction;
};

// The member's drafts, as the page lists them, each a link to where it continues, named by its title
// and described by how it started, when it was saved, and when it goes, with a menu holding Delete
// draft at the row's end. Deleting one refreshes the page, which drops its row.
function DraftList({ drafts, now, memberId, deleteDraft }: DraftListProps) {
	if (drafts.length === 0) {
		return <p className="text-sm text-muted-foreground">No drafts.</p>;
	}

	return (
		<ul role="list" className="divide-y rounded-xl border">
			{drafts.map((draft) => {
				const name = draftName(draft.title);
				const savedAt = draft.kind === 'saved' ? draft.savedAt : draft.importedAt;
				// The title names the link, and each detail describes it, read apart as shown apart.
				const ids = {
					title: `${draft.id}-draft-title`,
					started: `${draft.id}-draft-started`,
					saved: `${draft.id}-draft-saved`,
					kept: `${draft.id}-draft-kept`,
				};
				return (
					<li key={draft.id} className="flex items-center gap-3 pr-3">
						<Link
							href={listedDraftPath(draft)}
							aria-labelledby={ids.title}
							aria-describedby={`${ids.started} ${ids.saved} ${ids.kept}`}
							className="group flex min-w-0 flex-1 flex-col gap-1 p-4"
						>
							<span
								id={ids.title}
								className="font-medium wrap-anywhere underline-offset-4 group-hover:underline"
							>
								{name}
							</span>
							<span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
								<span id={ids.started}>{startedLabels[draft.mode ?? 'manual']}</span>
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

// Mirrors two rows of the list while the drafts load.
function DraftListSkeleton() {
	return (
		<div role="status" aria-live="polite" className="divide-y rounded-xl border">
			<span className="sr-only">Loading your drafts</span>
			{[0, 1].map((row) => (
				<div key={row} className="flex items-center gap-3 p-4 pr-3">
					<div className="flex flex-1 flex-col gap-2">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-4 w-full max-w-80" />
					</div>
					<Skeleton className="size-9 shrink-0" />
				</div>
			))}
		</div>
	);
}

export { DraftList, DraftListSkeleton };
