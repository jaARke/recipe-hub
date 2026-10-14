'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { TextField } from '@/components/forms/text-field';
import { useFocusOnFailure } from '@/components/forms/use-focus-on-failure';
import { useFormAction } from '@/components/forms/use-form-action';
import { recipeImportFieldNames } from '@/components/recipe-import/recipe-import-forms';
import { RecipeImportSubmit } from '@/components/recipe-import/recipe-import-submit';

const failureMessage = 'We couldn’t import the recipe. Check your connection and try again.';

type UrlImportFormProps = {
	// Opens the draft for review once the page is read.
	action: FormAction;
};

// Imports a recipe from a link to its page.
function UrlImportForm({ action }: UrlImportFormProps) {
	const baseId = React.useId();
	const formRef = React.useRef<HTMLFormElement>(null);
	const [state, formAction, pending] = useFormAction(action, failureMessage);
	const failure = state.status === 'error' ? state : undefined;
	const ids = {
		formError: `${baseId}-form-error`,
		url: `${baseId}-url`,
	};
	useFocusOnFailure(state, formRef, ids.formError);

	return (
		<form ref={formRef} action={formAction} noValidate className="flex flex-col gap-8">
			{failure?.message !== undefined && (
				<div id={ids.formError} tabIndex={-1}>
					<FormErrorAlert message={failure.message} />
				</div>
			)}
			<TextField
				id={ids.url}
				name={recipeImportFieldNames.url}
				type="url"
				label="Recipe link"
				required
				autoComplete="off"
				description="Paste the address of the page with the recipe. You’ll check what’s read before saving it."
				error={failure?.fieldErrors[recipeImportFieldNames.url]}
				defaultValue={failure?.values?.[recipeImportFieldNames.url]}
			/>
			<RecipeImportSubmit
				pending={pending}
				label="Import recipe"
				pendingLabel="Importing recipe"
				stage="Reading the page…"
			/>
		</form>
	);
}

export { UrlImportForm };
