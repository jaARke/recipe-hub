import { FileXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import { createRecipe, deleteDraft, saveDraft } from '@/app/(site)/(contribute)/contribute/actions';
import { SignInRequiredError } from '@/application/authorization';
import type { ImportReviewDto } from '@/application/ingestion/recipe-import-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import {
	EditingPageHeading,
	editingPageTitles,
} from '@/components/recipe-form/editing-page-heading';
import { RecipeForm, RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import {
	readRecipeFormSnapshot,
	recipeFormSnapshotTitle,
	restoredRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { DraftMenu } from '@/components/recipe-form/subject-menus';
import { DraftProvenanceLine } from '@/components/recipe-import/draft-provenance-line';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { contributePath, recipePath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
	getRecipeImageService,
	getRecipeImportService,
	getSavedDraftService,
} from '@/composition/services';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: editingPageTitles.review,
};

// The authoritative check: the service refuses a visitor who isn't signed in, and the proxy only
// looks for a cookie. Null for an import that isn't the member's or can't be saved anymore.
async function loadImportReview(id: string): Promise<ImportReviewDto | null> {
	try {
		return await getRecipeImportService().getImportReview(id);
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(recipeImportPath(id)));
		}
		throw error;
	}
}

// One message for an import that isn't the member's, failed, or expired, so an id never tells
// another member which.
function ImportUnavailableEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FileXIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>This draft isn’t available</EmptyTitle>
				<EmptyDescription>
					A draft can be reviewed for {settings.imports.importDraftLifetimeDays} days by the member
					who imported it. Import the recipe again to get a new draft.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link href={contributePath} className={buttonVariants()}>
					Add a recipe
				</Link>
			</EmptyContent>
		</Empty>
	);
}

async function ImportReview({ params }: Pick<PageProps<'/contribute/imports/[id]'>, 'params'>) {
	const { id } = await params;
	const review = await loadImportReview(id);
	if (review === null) {
		return (
			<>
				<EditingPageHeading title={editingPageTitles.review} />
				<ImportUnavailableEmptyState />
			</>
		);
	}

	// A saved draft leads to its recipe for good. Inside Suspense the redirect happens in the browser,
	// where a permanent one leaves at once and a temporary one waits a second.
	if (review.status === 'saved') {
		permanentRedirect(recipePath(review.recipeSlug));
	}

	const { draft } = review;
	const [member, savedDraft] = await Promise.all([
		loadFormMember(recipeImportPath(id)),
		getSavedDraftService().getImportDraft(draft.id),
	]);
	const imported = recipeFormValues(draft.content, draft.problems);
	// The member's saved draft takes the import's place; one the form can't read, as after a change to
	// what it keeps, leaves the import's.
	const snapshot = savedDraft === null ? undefined : readRecipeFormSnapshot(savedDraft.values);
	const opened = savedDraft === null || snapshot === undefined ? undefined : savedDraft;
	return (
		<>
			<EditingPageHeading
				title={editingPageTitles.review}
				menu={
					// Deletes the import's draft, with the member's draft that continues it.
					<DraftMenu
						label="Draft actions"
						draft={{ kind: 'import', id: draft.id }}
						title={snapshot === undefined ? draft.content.title : recipeFormSnapshotTitle(snapshot)}
						formSubject={{ kind: 'import', importId: draft.id }}
						memberId={member.id}
						action={deleteDraft}
						leavesFor={contributePath}
					/>
				}
			/>
			<DraftProvenanceLine mode={draft.mode} sourceUrl={draft.sourceUrl} />
			<RecipeForm
				// The form reads initial once, and another draft's page can reuse it.
				key={draft.id}
				initial={snapshot === undefined ? imported : restoredRecipeForm(snapshot, imported)}
				action={createRecipe}
				uploadFolders={getRecipeImageService().uploadFolders()}
				importId={draft.id}
				autosave={{ memberId: member.id }}
				drafts={{
					save: saveDraft,
					opened: opened === undefined ? undefined : { id: opened.id, savedAt: opened.savedAt },
					inUrl: false,
				}}
			/>
		</>
	);
}

// Mirrors the heading, the line naming where the draft came from, and the recipe form beside the
// original.
function ImportReviewSkeleton() {
	return (
		<>
			<EditingPageHeading title={editingPageTitles.review} />
			<Skeleton className="h-5 w-48" />
			<RecipeFormSkeleton besideOriginal />
		</>
	);
}

export default function ImportReviewPage({ params }: PageProps<'/contribute/imports/[id]'>) {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<Suspense fallback={<ImportReviewSkeleton />}>
				<ImportReview params={params} />
			</Suspense>
		</PageContainer>
	);
}
