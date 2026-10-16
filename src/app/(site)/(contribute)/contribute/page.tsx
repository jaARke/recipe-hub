import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedTagLabels } from '@/app/_lib/recipe-cache';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import {
	createRecipe,
	deleteDraft,
	importFromScans,
	importFromUrl,
	saveDraft,
} from '@/app/(site)/(contribute)/contribute/actions';
import { SignInRequiredError } from '@/application/authorization';
import type { DraftSummaryDto, SavedDraftDto } from '@/application/drafts/saved-draft-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import {
	EditingPageHeading,
	editingPageTitles,
} from '@/components/recipe-form/editing-page-heading';
import { HeldDraftProvider } from '@/components/recipe-form/held-draft';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import {
	readRecipeFormSnapshot,
	recipeFormSnapshotTitle,
	restoredRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { HeldDraftMenu } from '@/components/recipe-form/subject-menus';
import { DraftProvenanceLine } from '@/components/recipe-import/draft-provenance-line';
import {
	parseRecipeEntryTab,
	parseSavedDraftParam,
	recipeEntryParamNames,
} from '@/components/recipe-import/recipe-entry-paths';
import {
	RecipeEntryTabs,
	RecipeEntryTabsSkeleton,
} from '@/components/recipe-import/recipe-entry-tabs';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { ScanImportForm } from '@/components/recipe-import/scan-import-form';
import { UrlImportForm } from '@/components/recipe-import/url-import-form';
import { contributePath } from '@/components/recipe/recipe-paths';
import { getRecipeImageService, getSavedDraftService } from '@/composition/services';

export const metadata: Metadata = {
	title: editingPageTitles.add,
};

// The import actions read a page or photos with an AI model, which can take a minute or more. A
// Server Action runs as long as the page that renders its form allows, and this caps it below
// Vercel's 300-second default. The import service's time limit and lease are set against it.
export const maxDuration = 120;

// The authoritative check: the service refuses a visitor who isn't signed in, and the proxy only
// looks for a cookie, which can be present but expired.
async function loadDrafts(): Promise<DraftSummaryDto[]> {
	try {
		return await getSavedDraftService().listDrafts();
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(contributePath));
		}
		throw error;
	}
}

// The saved draft the URL names, or null for one that isn't the member's or has expired, which
// leaves the form empty.
async function loadSavedDraft(id: string | undefined): Promise<SavedDraftDto | null> {
	return id === undefined ? null : getSavedDraftService().getDraft(id);
}

async function ContributeForMember({
	searchParams,
}: Pick<PageProps<'/contribute'>, 'searchParams'>) {
	const params = await searchParams;
	const drafts = await loadDrafts();
	const [member, savedDraft, tagLabels] = await Promise.all([
		loadFormMember(contributePath),
		loadSavedDraft(parseSavedDraftParam(params[recipeEntryParamNames.draft])),
		getCachedTagLabels(),
	]);
	// A draft that continues an import opens in the import's review.
	if (savedDraft?.continuesImportId !== undefined) {
		redirect(recipeImportPath(savedDraft.continuesImportId));
	}
	const uploadFolders = getRecipeImageService().uploadFolders();
	// One the form can't read, as after a change to what it keeps, leaves the form empty.
	const snapshot = savedDraft === null ? undefined : readRecipeFormSnapshot(savedDraft.values);
	const opened = savedDraft === null || snapshot === undefined ? undefined : savedDraft;
	const tab =
		opened === undefined ? parseRecipeEntryTab(params[recipeEntryParamNames.tab]) : 'manual';

	return (
		<HeldDraftProvider
			// Another draft or tab opens the tabs and the form afresh, as Next keeps this page's state.
			key={`${opened?.id ?? 'new'}:${tab}`}
			opened={
				opened === undefined || snapshot === undefined
					? undefined
					: { id: opened.id, title: recipeFormSnapshotTitle(snapshot) }
			}
		>
			<EditingPageHeading
				page="add"
				menu={<HeldDraftMenu memberId={member.id} action={deleteDraft} />}
			/>
			{/* A draft saved from an import's review still says where it came from. */}
			<DraftProvenanceLine mode={opened?.mode} sourceUrl={opened?.sourceUrl} />
			<RecipeEntryTabs
				defaultTab={tab}
				forms={{
					manual: (
						<RecipeForm
							initial={
								snapshot === undefined
									? recipeFormValues()
									: restoredRecipeForm(snapshot, recipeFormValues())
							}
							action={createRecipe}
							uploadFolders={uploadFolders}
							tagLabels={tagLabels}
							autosave={{ memberId: member.id }}
							drafts={{
								save: saveDraft,
								opened:
									opened === undefined ? undefined : { id: opened.id, savedAt: opened.savedAt },
								inUrl: true,
							}}
							submitLabel="Save recipe"
						/>
					),
					url: <UrlImportForm action={importFromUrl} />,
					photo: <ScanImportForm action={importFromScans} uploadFolder={uploadFolders.scan} />,
				}}
				drafts={drafts}
				// Reading the session waited for the request, so this is the request's time, not a prerender's.
				now={new Date()}
				memberId={member.id}
				deleteDraft={deleteDraft}
			/>
		</HeldDraftProvider>
	);
}

export default function ContributePage({ searchParams }: PageProps<'/contribute'>) {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<Suspense
				fallback={
					<>
						<EditingPageHeading page="add" />
						<RecipeEntryTabsSkeleton />
					</>
				}
			>
				<ContributeForMember searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
