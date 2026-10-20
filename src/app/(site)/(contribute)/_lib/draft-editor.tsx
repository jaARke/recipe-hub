import 'server-only';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import {
	createRecipe,
	deleteOpenDraft,
	returnToStart,
	saveDraft,
} from '@/app/(site)/(contribute)/contribute/actions';
import type { SavedDraftDto } from '@/application/drafts/saved-draft-dtos';
import { DraftPageHeading } from '@/components/recipe-form/draft-page-heading';
import { HeldDraftProvider } from '@/components/recipe-form/held-draft';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import {
	readRecipeFormSnapshot,
	recipeFormSnapshotTitle,
	restoredRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import {
	recipeFormValues,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { HeldDraftMenu } from '@/components/recipe-form/subject-menus';
import { DraftProvenanceLine } from '@/components/recipe-import/draft-provenance-line';
import { getRecipeImageService } from '@/composition/services';

type DraftEditorProps = {
	// The page's href, which signing in again returns to.
	pageHref: string;
	// The member's draft the page opens, or none for a new recipe.
	draft?: SavedDraftDto;
};

// What the draft opens the form with: its values as last saved, or, until the form first saves an
// import's draft, what the import read. Values the form can't read, as after a change to what it
// keeps, open it empty and holding no draft.
function openedDraft(
	draft: SavedDraftDto | undefined
): { initial: RecipeFormValues; title: string | undefined } | undefined {
	const snapshot = draft === undefined ? undefined : readRecipeFormSnapshot(draft.values);
	if (snapshot !== undefined) {
		return {
			initial: restoredRecipeForm(snapshot, recipeFormValues()),
			title: recipeFormSnapshotTitle(snapshot),
		};
	}
	const imported = draft?.imported;
	return imported === undefined
		? undefined
		: {
				initial: recipeFormValues(imported.content, imported.problems),
				title: imported.content.title,
			};
}

// A new recipe's page and a draft's: the heading, where an import's draft came from, and the recipe
// form, which saves its draft as the member fills it in and holds it once saved, so the heading names
// it and its menu deletes it.
export async function DraftEditor({ pageHref, draft }: DraftEditorProps) {
	await loadFormMember(pageHref);
	const opened = draft === undefined ? undefined : openedDraft(draft);
	const held = opened === undefined ? undefined : draft;

	return (
		<HeldDraftProvider
			// Another draft starts the page afresh, as Next keeps this page's state; the provider starts the
			// form again for a version saved elsewhere since.
			key={held === undefined ? 'new' : held.id}
			opened={
				held === undefined
					? undefined
					: { id: held.id, title: opened?.title, savedAt: held.savedAt }
			}
		>
			<DraftPageHeading menu={<HeldDraftMenu action={deleteOpenDraft} />}>
				<DraftProvenanceLine mode={draft?.mode} sourceUrl={draft?.sourceUrl} />
			</DraftPageHeading>
			<RecipeForm
				initial={opened?.initial ?? recipeFormValues()}
				action={createRecipe}
				uploadFolders={getRecipeImageService().uploadFolders()}
				drafts={{
					save: saveDraft,
					delete: deleteOpenDraft,
					leave: returnToStart,
					opened: held === undefined ? undefined : { id: held.id, savedAt: held.savedAt },
					page: draft === undefined ? 'new' : 'draft',
				}}
			/>
		</HeldDraftProvider>
	);
}
