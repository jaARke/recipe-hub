import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SignInRequiredError } from '@/application/authorization';
import type { SavedDraftDto } from '@/application/drafts/saved-draft-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { DraftPageHeadingSkeleton } from '@/components/recipe-form/draft-page-heading';
import { RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { recipeEntryTitles } from '@/components/recipe-import/recipe-entry-heading';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { contributePath } from '@/components/recipe/recipe-paths';
import { getSavedDraftService } from '@/composition/services';

export const metadata: Metadata = {
	title: recipeEntryTitles.draft,
};

// The authoritative check: the service refuses a visitor who isn't signed in, and the proxy only
// looks for a cookie. Null for an import that made the member no draft that's still kept.
async function loadImportDraft(importId: string): Promise<SavedDraftDto | null> {
	try {
		return await getSavedDraftService().getImportDraft(importId);
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(recipeImportPath(importId)));
		}
		throw error;
	}
}

// Leads to the draft the import made, or to the start page once it's gone. Temporary, since the
// draft can go. Inside Suspense the redirect happens in the browser.
async function ImportDraftRedirect({
	params,
}: Pick<PageProps<'/contribute/imports/[id]'>, 'params'>): Promise<never> {
	const { id } = await params;
	const draft = await loadImportDraft(id);
	redirect(draft === null ? contributePath : savedDraftPath(draft.id));
}

// An import's earlier address, which links and history may still hold. It mirrors the draft's page
// while it looks the draft up.
export default function ImportDraftPage({ params }: PageProps<'/contribute/imports/[id]'>) {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<Suspense
				fallback={
					<>
						<DraftPageHeadingSkeleton />
						<RecipeFormSkeleton />
					</>
				}
			>
				<ImportDraftRedirect params={params} />
			</Suspense>
		</PageContainer>
	);
}
