'use client';

import { useRouter } from 'next/navigation';
import { ConfirmActionDialog } from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import { recipeFormAutosaveKey } from '@/components/recipe-form/recipe-form-autosave';
import { recipeFormFieldNames } from '@/components/recipe-form/recipe-form-fields';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { removeBrowserStorage } from '@/lib/browser-storage';

type DeleteRecipeDialogProps = {
	recipeId: string;
	title: string;
	action: FormAction;
};

function DeleteRecipeDialog({ recipeId, title, action }: DeleteRecipeDialogProps) {
	const router = useRouter();

	function leave() {
		// The recipe's unsaved changes go with it, rather than stay in this browser until sign-out.
		removeBrowserStorage(recipeFormAutosaveKey({ kind: 'recipe', recipeId }));
		// The edit page is gone, so the list takes its place in the history.
		router.replace(recipeListPath);
	}

	return (
		<ConfirmActionDialog
			variant="destructive"
			trigger="Delete recipe"
			title={`Delete “${title}”?`}
			description="The recipe and its photos are deleted. This can’t be undone."
			cancelLabel="Keep recipe"
			confirmLabel="Delete recipe"
			pendingLabel="Deleting"
			successMessage="Recipe deleted"
			failureMessage="We couldn’t delete the recipe. Reload the page and try again."
			action={action}
			onSuccess={leave}
		>
			<input type="hidden" name={recipeFormFieldNames.recipeId} value={recipeId} />
		</ConfirmActionDialog>
	);
}

export { DeleteRecipeDialog };
