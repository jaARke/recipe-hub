import { FilePenLineIcon } from 'lucide-react';
import Link from 'next/link';
import type { UnsavedImportDto } from '@/application/ingestion/recipe-import-dtos';
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
import { settings } from '@/lib/settings';

// Where each draft came from.
const importModeLabels = {
	url: 'From a link',
	photo: 'From photos',
} as const satisfies Record<RecipeImportMode, string>;

function UnsavedImportsEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FilePenLineIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No drafts</EmptyTitle>
				<EmptyDescription>
					Imports you haven’t saved stay here for {settings.imports.importDraftLifetimeDays} days.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

type UnsavedImportListProps = {
	imports: readonly UnsavedImportDto[];
	// When the page rendered, which each import's age counts back from.
	now: Date;
};

// Imports whose drafts the member hasn't saved, as the service lists them, each opening its review.
// The Drafts tab names the list, so it has no heading of its own.
function UnsavedImportList({ imports, now }: UnsavedImportListProps) {
	if (imports.length === 0) {
		return <UnsavedImportsEmptyState />;
	}

	return (
		<ul className="divide-y">
			{imports.map(({ id, mode, title, createdAt }) => (
				<li key={id}>
					<Link href={recipeImportPath(id)} className="group flex flex-col gap-1 py-3">
						<span className="text-base font-medium underline-offset-4 group-hover:underline">
							{title ?? 'Untitled'}
						</span>
						<span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
							<span>{importModeLabels[mode]}</span>
							<time dateTime={createdAt.toISOString()}>{formatTimeAgo(createdAt, now)}</time>
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}

export { UnsavedImportList };
