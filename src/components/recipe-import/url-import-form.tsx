'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { recipeImportFieldNames } from '@/components/recipe-import/recipe-import-forms';
import { RecipeImportSubmit } from '@/components/recipe-import/recipe-import-submit';
import { Skeleton } from '@/components/ui/skeleton';
import { urlImportBlankMessages } from '@/domain/recipe/recipe-import';

const failureMessage = 'We couldn’t import the recipe. Check your connection and try again.';

type UrlImportFormProps = {
	// Opens the draft for review once the page is read.
	action: FormAction;
};

// Imports a recipe from a link to its page.
function UrlImportForm({ action }: UrlImportFormProps) {
	const urlId = React.useId();
	const [state, formProps, pending] = useFormAction(action, failureMessage, {
		blankMessages: urlImportBlankMessages,
	});
	const failure = state.status === 'error' ? state : undefined;

	return (
		<form {...formProps} className="flex flex-col gap-4">
			<FormErrorAlert message={failure?.message} />
			<TextField
				id={urlId}
				name={recipeImportFieldNames.url}
				type="url"
				label="Recipe link"
				required
				autoComplete="off"
				description="Paste the address of the page with the recipe. You’ll check what’s read before adding it to the cookbook."
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

// Mirrors the form while the page checks who is signed in: the field, its description, and the button.
function UrlImportFormSkeleton() {
	return (
		<div role="status" aria-live="polite" className="flex flex-col gap-4">
			<span className="sr-only">Loading the import</span>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-24" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-5 w-full" />
			</div>
			<Skeleton className="h-9 w-36" />
		</div>
	);
}

export { UrlImportForm, UrlImportFormSkeleton };
