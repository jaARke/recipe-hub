'use client';

import type * as React from 'react';
import { ConfirmActionDialog } from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import { recipeFormFieldNames } from '@/components/recipe-form/recipe-form-fields';

// A draft the member saved, or an import's draft awaiting review, by its id.
export type DeletedDraft = { kind: 'saved'; id: string } | { kind: 'import'; id: string };

type DeleteDraftDialogProps = {
	draft: DeletedDraft;
	// The recipe's title, if it has one yet.
	title: string | undefined;
	// The trigger's content, "Delete draft" unless a list names which.
	trigger?: React.ReactNode;
	action: FormAction;
	// Runs once the draft is deleted, such as to leave the page it was open on.
	onDeleted: () => void;
};

// Asks before deleting a draft, as DeleteRecipeDialog does a recipe.
function DeleteDraftDialog({
	draft,
	title,
	trigger = 'Delete draft',
	action,
	onDeleted,
}: DeleteDraftDialogProps) {
	return (
		<ConfirmActionDialog
			variant="destructive"
			trigger={trigger}
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
			<input
				type="hidden"
				name={draft.kind === 'saved' ? recipeFormFieldNames.draftId : recipeFormFieldNames.importId}
				value={draft.id}
			/>
		</ConfirmActionDialog>
	);
}

export { DeleteDraftDialog };
