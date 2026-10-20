import 'server-only';
import { connection } from 'next/server';
import { loadDrafts } from '@/app/(site)/(contribute)/_lib/load-drafts';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import { createRecipe, deleteDraft, saveDraft } from '@/app/(site)/(contribute)/contribute/actions';
import type { SavedDraftDto } from '@/application/drafts/saved-draft-dtos';
import { DraftPageHeading } from '@/components/recipe-form/draft-page-heading';
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
import { reviewableImportIds } from '@/components/recipe-import/listed-drafts';
import { getRecipeImageService } from '@/composition/services';

type DraftEditorProps = {
	// The page's href, which signing in again returns to.
	pageHref: string;
	// The member's saved draft the page opens, or none for a new recipe.
	draft?: SavedDraftDto;
};

// A new recipe's page and a saved draft's: the heading, where a draft saved from an import's review
// came from, and the recipe form, which saves its draft and holds it once saved, so the heading names
// it and its menu deletes it.
export async function DraftEditor({ pageHref, draft }: DraftEditorProps) {
	// The request's time, not a prerender's: with partial prefetching the query resolves while the
	// shell still prerenders, so the time waits for the request itself. Taken before the drafts are
	// listed, so changes kept for an import started meanwhile are never pruned.
	await connection();
	const now = new Date();
	const drafts = await loadDrafts(pageHref);
	const member = await loadFormMember(pageHref);
	// One the form can't read, as after a change to what it keeps, leaves the form empty.
	const snapshot = draft === undefined ? undefined : readRecipeFormSnapshot(draft.values);
	const opened = snapshot === undefined ? undefined : draft;

	return (
		<HeldDraftProvider
			// A draft saved elsewhere since starts the form again, as Next keeps this page's state.
			key={opened === undefined ? 'new' : `${opened.id}:${opened.savedAt.toISOString()}`}
			opened={
				opened === undefined || snapshot === undefined
					? undefined
					: { id: opened.id, title: recipeFormSnapshotTitle(snapshot) }
			}
		>
			<DraftPageHeading menu={<HeldDraftMenu memberId={member.id} action={deleteDraft} />}>
				<DraftProvenanceLine mode={draft?.mode} sourceUrl={draft?.sourceUrl} />
			</DraftPageHeading>
			<RecipeForm
				initial={
					snapshot === undefined
						? recipeFormValues()
						: restoredRecipeForm(snapshot, recipeFormValues())
				}
				action={createRecipe}
				uploadFolders={getRecipeImageService().uploadFolders()}
				autosave={{
					memberId: member.id,
					existing: { knownAt: now, importIds: reviewableImportIds(drafts) },
				}}
				drafts={{
					save: saveDraft,
					opened: opened === undefined ? undefined : { id: opened.id, savedAt: opened.savedAt },
					inUrl: true,
				}}
				submitLabel="Save recipe"
			/>
		</HeldDraftProvider>
	);
}
