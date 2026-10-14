import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedTagLabels } from '@/app/_lib/recipe-cache';
import {
	createRecipe,
	importFromScans,
	importFromUrl,
} from '@/app/(contribute)/contribute/actions';
import { SignInRequiredError } from '@/application/authorization';
import type { UnsavedImportDto } from '@/application/ingestion/recipe-import-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import {
	RecipeEntryTabs,
	RecipeEntryTabsSkeleton,
} from '@/components/recipe-import/recipe-entry-tabs';
import { ScanImportForm } from '@/components/recipe-import/scan-import-form';
import { UrlImportForm } from '@/components/recipe-import/url-import-form';
import { contributePath } from '@/components/recipe/recipe-paths';
import { getRecipeImageService, getRecipeImportService } from '@/composition/services';

export const metadata: Metadata = {
	title: 'Add a recipe',
};

// The import actions read a page or photos with an AI model, which can take a minute or more. A
// Server Action runs as long as the page that renders its form allows, and this caps it below
// Vercel's 300-second default. The import service's time limit and lease are set against it.
export const maxDuration = 120;

// The authoritative check: the service refuses a visitor who isn't signed in, and the proxy only
// looks for a cookie, which can be present but expired.
async function loadUnsavedImports(): Promise<UnsavedImportDto[]> {
	try {
		return await getRecipeImportService().listUnsavedImports();
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(contributePath));
		}
		throw error;
	}
}

async function ContributeForMember() {
	const unsavedImports = await loadUnsavedImports();
	const tagLabels = await getCachedTagLabels();
	const uploadFolders = getRecipeImageService().uploadFolders();

	return (
		<RecipeEntryTabs
			forms={{
				manual: (
					<RecipeForm
						initial={recipeFormValues()}
						action={createRecipe}
						uploadFolders={uploadFolders}
						tagLabels={tagLabels}
						submitLabel="Save recipe"
					/>
				),
				url: <UrlImportForm action={importFromUrl} />,
				photo: <ScanImportForm action={importFromScans} uploadFolder={uploadFolders.scan} />,
			}}
			unsavedImports={unsavedImports}
			// Reading the session waited for the request, so this is the request's time, not a prerender's.
			now={new Date()}
		/>
	);
}

export default function ContributePage() {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-semibold">Add a recipe</h1>
			<Suspense fallback={<RecipeEntryTabsSkeleton />}>
				<ContributeForMember />
			</Suspense>
		</PageContainer>
	);
}
