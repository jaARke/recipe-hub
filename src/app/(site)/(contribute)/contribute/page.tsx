import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { loadDrafts } from '@/app/(site)/(contribute)/_lib/load-drafts';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import { deleteDraft } from '@/app/(site)/(contribute)/contribute/actions';
import { requestedPageHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { RefreshOnReturn } from '@/components/layout/page-visits';
import { recipeEntryTitles } from '@/components/recipe-import/recipe-entry-heading';
import {
	keptDraftParamName,
	movedRecipeEntryHref,
	parseKeptDraftParam,
} from '@/components/recipe-import/recipe-entry-paths';
import { RecipeStart, RecipeStartSkeleton } from '@/components/recipe-import/recipe-start';
import { contributePath } from '@/components/recipe/recipe-paths';

export const metadata: Metadata = {
	title: recipeEntryTitles.start,
};

async function RecipeStartForMember({
	searchParams,
}: Pick<PageProps<'/contribute'>, 'searchParams'>) {
	const params = await searchParams;
	// An address from before each way in had a page of its own leads where that now lives. Inside
	// Suspense the redirect happens in the browser, where a permanent one leaves at once.
	const moved = movedRecipeEntryHref(params);
	if (moved !== undefined) {
		permanentRedirect(moved);
	}

	// The request's time, not a prerender's, which each draft's age counts back from. The drafts are
	// read on every visit, so a draft renamed or emptied elsewhere shows as it now is.
	await connection();
	const now = new Date();
	// The query names the draft just left, so signing in again says so.
	const pageHref = requestedPageHref(contributePath, params);
	const [drafts, member] = await Promise.all([loadDrafts(pageHref), loadFormMember(pageHref)]);
	const keptId = parseKeptDraftParam(params[keptDraftParamName]);
	const kept = drafts.find(({ kind, id }) => kind === 'saved' && id === keptId);

	return (
		<>
			<RefreshOnReturn />
			<RecipeStart
				kept={kept}
				drafts={drafts}
				now={now}
				memberId={member.id}
				deleteDraft={deleteDraft}
			/>
		</>
	);
}

export default function RecipeStartPage({ searchParams }: PageProps<'/contribute'>) {
	return (
		<PageContainer width="reading" className="py-12 sm:py-16">
			<Suspense fallback={<RecipeStartSkeleton />}>
				<RecipeStartForMember searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
