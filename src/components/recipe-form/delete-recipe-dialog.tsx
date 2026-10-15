'use client';

import {
	ConfirmActionDialog,
	type ConfirmActionDialogOpener,
} from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import { recipeFormFieldNames } from '@/components/recipe-form/recipe-form-fields';

type DeleteRecipeDialogProps = {
	recipeId: string;
	title: string;
	// Opens the dialog from a menu's Delete recipe.
	opener: ConfirmActionDialogOpener;
	action: FormAction;
	// Runs once the recipe is deleted, such as to leave its edit page.
	onDeleted: () => void;
};

function DeleteRecipeDialog({
	recipeId,
	title,
	opener,
	action,
	onDeleted,
}: DeleteRecipeDialogProps) {
	return (
		<ConfirmActionDialog
			variant="destructive"
			opener={opener}
			title={`Delete “${title}”?`}
			description="The recipe and its photos are deleted. This can’t be undone."
			cancelLabel="Keep recipe"
			confirmLabel="Delete recipe"
			pendingLabel="Deleting"
			successMessage="Recipe deleted"
			failureMessage="We couldn’t delete the recipe. Reload the page and try again."
			action={action}
			onSuccess={onDeleted}
		>
			<input type="hidden" name={recipeFormFieldNames.recipeId} value={recipeId} />
		</ConfirmActionDialog>
	);
}

export { DeleteRecipeDialog };
