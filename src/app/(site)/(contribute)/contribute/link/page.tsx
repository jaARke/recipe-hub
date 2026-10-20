import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import { importFromUrl } from '@/app/(site)/(contribute)/contribute/actions';
import { PageContainer } from '@/components/layout/page-container';
import {
	recipeEntryTitles,
	RecipeImportHeading,
} from '@/components/recipe-import/recipe-entry-heading';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';
import { UrlImportForm, UrlImportFormSkeleton } from '@/components/recipe-import/url-import-form';

export const metadata: Metadata = {
	title: recipeEntryTitles.url,
};

// The import action reads a page with an AI model, which can take a minute or more. A Server Action
// runs as long as the page that renders its form allows, and this caps it below Vercel's 300-second
// default. The import service's time limit and lease are set against it.
export const maxDuration = 120;

// The authoritative check, as the proxy only looks for a cookie: a member whose session ended signs in
// before entering a link the import would refuse.
async function UrlImportForMember() {
	await loadFormMember(recipeEntryPaths.url);
	return <UrlImportForm action={importFromUrl} />;
}

export default function UrlImportPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<RecipeImportHeading mode="url" />
			<Suspense fallback={<UrlImportFormSkeleton />}>
				<UrlImportForMember />
			</Suspense>
		</PageContainer>
	);
}
