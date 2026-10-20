'use client';

import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import { deleteSample, sampleMemberId } from '@/components/design-reference/sample-recipe-form';
import { RecipeStart } from '@/components/recipe-import/recipe-start';

// The start page under the design reference's own headings, with these drafts listed and, if given,
// one named as just left. Their links lead to the site's pages, and deleting one is refused, since
// none is stored.
function SampleRecipeStart({
	drafts,
	kept,
	now,
}: {
	drafts: readonly DraftSummaryDto[];
	kept?: DraftSummaryDto;
	// When the list renders, which each draft's age counts back from.
	now: Date;
}) {
	return (
		<RecipeStart
			headingLevel={4}
			kept={kept}
			drafts={drafts}
			now={now}
			memberId={sampleMemberId}
			deleteDraft={deleteSample}
		/>
	);
}

export { SampleRecipeStart };
