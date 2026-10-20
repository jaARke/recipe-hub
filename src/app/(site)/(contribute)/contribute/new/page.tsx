import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DraftEditor } from '@/app/(site)/(contribute)/_lib/draft-editor';
import { PageContainer } from '@/components/layout/page-container';
import { NewOnEachVisit } from '@/components/layout/page-visits';
import { DraftPageHeading } from '@/components/recipe-form/draft-page-heading';
import { RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { recipeEntryTitles } from '@/components/recipe-import/recipe-entry-heading';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';

export const metadata: Metadata = {
	title: recipeEntryTitles.new,
};

// Type it in always opens an empty form: a draft is resumed only from the start page's list, and Next
// keeps the page from an earlier visit, with what was typed there, so each visit starts it afresh.
export default function NewRecipePage() {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<Suspense
				fallback={
					<>
						<DraftPageHeading />
						<RecipeFormSkeleton />
					</>
				}
			>
				<NewOnEachVisit>
					<DraftEditor pageHref={recipeEntryPaths.manual} />
				</NewOnEachVisit>
			</Suspense>
		</PageContainer>
	);
}
