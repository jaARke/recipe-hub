import { FileXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedTagLabels } from '@/app/_lib/recipe-cache';
import { createRecipe } from '@/app/(site)/(contribute)/contribute/actions';
import { SignInRequiredError } from '@/application/authorization';
import type { ImportReviewDto } from '@/application/ingestion/recipe-import-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeForm, RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { RecipeImportedFrom } from '@/components/recipe/recipe-detail';
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
import { getRecipeImageService, getRecipeImportService } from '@/composition/services';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: 'Review the import',
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
		return <ImportUnavailableEmptyState />;
	}

	// A saved draft leads to its recipe for good. Inside Suspense the redirect happens in the browser,
	// where a permanent one leaves at once and a temporary one waits a second.
	if (review.status === 'saved') {
		permanentRedirect(recipePath(review.recipeSlug));
	}

	const { draft } = review;
	const tagLabels = await getCachedTagLabels();
	return (
		<div className="flex flex-col gap-8">
			{draft.sourceUrl === undefined ? (
				<p className="text-sm text-muted-foreground">Read from your photos</p>
			) : (
				<RecipeImportedFrom sourceUrl={draft.sourceUrl} />
			)}
			<RecipeForm
				// The form reads initial once, and another draft's page can reuse it.
				key={draft.id}
				initial={recipeFormValues(draft.content, draft.problems)}
				action={createRecipe}
				uploadFolders={getRecipeImageService().uploadFolders()}
				tagLabels={tagLabels}
				importId={draft.id}
				autosave
				submitLabel="Save recipe"
			/>
		</div>
	);
}

// Mirrors the line naming where the draft came from, over the recipe form beside the original.
function ImportReviewSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			<Skeleton className="h-5 w-48" />
			<RecipeFormSkeleton besideOriginal />
		</div>
	);
}

export default function ImportReviewPage({ params }: PageProps<'/contribute/imports/[id]'>) {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-semibold">Review the import</h1>
			<Suspense fallback={<ImportReviewSkeleton />}>
				<ImportReview params={params} />
			</Suspense>
		</PageContainer>
	);
}
