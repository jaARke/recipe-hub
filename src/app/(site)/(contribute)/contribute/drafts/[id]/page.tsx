import { FileXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DraftEditor } from '@/app/(site)/(contribute)/_lib/draft-editor';
import { SignInRequiredError } from '@/application/authorization';
import type { SavedDraftDto } from '@/application/drafts/saved-draft-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { BackLink } from '@/components/layout/back-link';
import { PageContainer } from '@/components/layout/page-container';
import { DraftPageHeadingSkeleton } from '@/components/recipe-form/draft-page-heading';
import { RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import {
	backToStartLabel,
	recipeEntryTitles,
} from '@/components/recipe-import/recipe-entry-heading';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { contributePath } from '@/components/recipe/recipe-paths';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { getSavedDraftService } from '@/composition/services';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: recipeEntryTitles.draft,
};

// The authoritative check: the service refuses a visitor who isn't signed in, and the proxy only
// looks for a cookie. Null for a draft that isn't the member's or has expired.
async function loadSavedDraft(id: string): Promise<SavedDraftDto | null> {
	try {
		return await getSavedDraftService().getDraft(id);
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(savedDraftPath(id)));
		}
		throw error;
	}
}

// One message for a draft that isn't the member's, was deleted, or expired, so an id never tells
// another member which.
function DraftUnavailableState() {
	return (
		<div className="flex flex-col">
			<BackLink href={contributePath} className="mb-6">
				{backToStartLabel}
			</BackLink>
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileXIcon aria-hidden="true" />
					</EmptyMedia>
					{/* EmptyTitle renders a div, so the role makes it this page's heading. */}
					<EmptyTitle role="heading" aria-level={1}>
						This Draft Isn’t Available
					</EmptyTitle>
					<EmptyDescription>
						A draft is kept for {settings.drafts.draftLifetimeDays} days after it was last saved,
						and only the member who saved it can open it.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}

async function SavedDraftEditor({ params }: Pick<PageProps<'/contribute/drafts/[id]'>, 'params'>) {
	const { id } = await params;
	const draft = await loadSavedDraft(id);
	if (draft === null) {
		return <DraftUnavailableState />;
	}
	// A draft that continues an import opens in the import's review.
	if (draft.continuesImportId !== undefined) {
		redirect(recipeImportPath(draft.continuesImportId));
	}
	return <DraftEditor pageHref={savedDraftPath(id)} draft={draft} />;
}

export default function SavedDraftPage({ params }: PageProps<'/contribute/drafts/[id]'>) {
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
				<SavedDraftEditor params={params} />
			</Suspense>
		</PageContainer>
	);
}
