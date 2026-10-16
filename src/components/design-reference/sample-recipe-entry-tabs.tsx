'use client';

import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import {
	deleteSample,
	sampleMemberId,
	SampleRecipeForm,
} from '@/components/design-reference/sample-recipe-form';
import {
	SampleScanImportForm,
	SampleUrlImportForm,
} from '@/components/design-reference/sample-recipe-import';
import { HeldDraftProvider } from '@/components/recipe-form/held-draft';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { RecipeEntryTabs } from '@/components/recipe-import/recipe-entry-tabs';

// The add page's tabs over the sample form and imports, with these drafts listed. Their links lead to
// the site's pages, and deleting one is refused, since none is stored.
function SampleRecipeEntryTabs({
	drafts,
	now,
	tagLabels,
}: {
	drafts: readonly DraftSummaryDto[];
	// When the list renders, which each draft's age counts back from.
	now: Date;
	tagLabels: readonly string[];
}) {
	// Holds the sample form's draft once saved, which the Drafts tab then lists, as the add page does.
	return (
		<HeldDraftProvider opened={undefined}>
			<RecipeEntryTabs
				forms={{
					manual: <SampleRecipeForm initial={recipeFormValues()} tagLabels={tagLabels} />,
					url: <SampleUrlImportForm />,
					photo: <SampleScanImportForm />,
				}}
				defaultTab="manual"
				drafts={drafts}
				now={now}
				memberId={sampleMemberId}
				deleteDraft={deleteSample}
			/>
		</HeldDraftProvider>
	);
}

export { SampleRecipeEntryTabs };
