import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import { importFromScans } from '@/app/(site)/(contribute)/contribute/actions';
import { PageContainer } from '@/components/layout/page-container';
import {
	recipeEntryTitles,
	RecipeImportHeading,
} from '@/components/recipe-import/recipe-entry-heading';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';
import {
	ScanImportForm,
	ScanImportFormSkeleton,
} from '@/components/recipe-import/scan-import-form';
import { getRecipeImageService } from '@/composition/services';

export const metadata: Metadata = {
	title: recipeEntryTitles.photo,
};

// The import action reads photos with an AI model, which can take a minute or more. A Server Action
// runs as long as the page that renders its form allows, and this caps it below Vercel's 300-second
// default. The import service's time limit and lease are set against it.
export const maxDuration = 120;

// The authoritative check, as the proxy only looks for a cookie: a member whose session ended signs in
// before choosing photos, whose uploads would be refused.
async function ScanImportForMember() {
	await loadFormMember(recipeEntryPaths.photo);
	return (
		<ScanImportForm
			action={importFromScans}
			uploadFolder={getRecipeImageService().uploadFolders().scan}
		/>
	);
}

export default function ScanImportPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<RecipeImportHeading mode="photo" />
			<Suspense fallback={<ScanImportFormSkeleton />}>
				<ScanImportForMember />
			</Suspense>
		</PageContainer>
	);
}
