'use client';

import {
	ConfirmActionDialog,
	type ConfirmActionDialogOpener,
} from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import { recipeFormFieldNames } from '@/components/recipe-form/recipe-form-fields';

type DeleteDraftDialogProps = {
	draftId: string;
	// The recipe's title, if it has one yet.
	title: string | undefined;
	// Opens the dialog from a menu's Delete draft.
	opener: ConfirmActionDialogOpener;
	action: FormAction;
	// Runs once the draft is deleted, such as to leave the page it was open on.
	onDeleted: () => void;
};

// Asks before deleting a draft, as DeleteRecipeDialog does a recipe.
function DeleteDraftDialog({ draftId, title, opener, action, onDeleted }: DeleteDraftDialogProps) {
	return (
		<ConfirmActionDialog
			variant="destructive"
			opener={opener}
			title={title === undefined ? 'Delete this draft?' : `Delete the draft of “${title}”?`}
			description="The draft and the photos only it uses are deleted. This can’t be undone."
			cancelLabel="Keep draft"
			confirmLabel="Delete draft"
			pendingLabel="Deleting"
			successMessage="Draft deleted"
			failureMessage="We couldn’t delete the draft. Reload the page and try again."
			action={action}
			onSuccess={onDeleted}
		>
			<input type="hidden" name={recipeFormFieldNames.draftId} value={draftId} />
		</ConfirmActionDialog>
	);
}

export { DeleteDraftDialog };
