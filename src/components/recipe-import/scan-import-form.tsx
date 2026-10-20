'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { useFormAction } from '@/components/forms/use-form-action';
import { PhotoField } from '@/components/recipe-form/photo-field';
import { uploadPhoto, type PhotoUploader } from '@/components/recipe-form/photo-upload';
import { hasPhotosInProgress } from '@/components/recipe-form/recipe-form-values';
import {
	recipeImportFieldNames,
	scanFieldValue,
} from '@/components/recipe-import/recipe-import-forms';
import { RecipeImportSubmit } from '@/components/recipe-import/recipe-import-submit';
import {
	editScanImport,
	emptyScanImport,
	scanImportProblems,
	scanImportSubmission,
} from '@/components/recipe-import/scan-import-values';
import { Skeleton } from '@/components/ui/skeleton';
import { settings } from '@/lib/settings';

const failureMessage = 'We couldn’t read the recipe. Check your connection and try again.';

type ScanImportFormProps = {
	// Opens the draft for review once the photos are read.
	action: FormAction;
	// Where this environment keeps new scans.
	uploadFolder: string;
	uploader?: PhotoUploader;
};

// Reads a recipe from photos of its pages, in the recipe form's own "Original recipe" field: each
// photo is resized and uploads as it's chosen, and stays with the recipe once it's saved.
function ScanImportForm({ action, uploadFolder, uploader = uploadPhoto }: ScanImportFormProps) {
	const photosId = React.useId();
	const [values, dispatch] = React.useReducer(editScanImport, emptyScanImport);
	const submission = scanImportSubmission(values);
	const photosInProgress = hasPhotosInProgress(values);

	// A refusal's problems name pages in what it sent, so they land through that submission's targets.
	const readRecipe: FormAction = async (previous, formData) => {
		const { targets } = submission;
		const result = await action(previous, formData);
		if (result.status === 'error') {
			dispatch({ type: 'attachErrors', fieldErrors: result.fieldErrors, targets });
		}
		return result;
	};

	// What the browser finds before sending shows as a refusal's problems do.
	const [state, formProps, pending] = useFormAction(readRecipe, failureMessage, {
		check: () => scanImportProblems(values),
		showProblems: (fieldErrors) =>
			dispatch({ type: 'attachErrors', fieldErrors, targets: submission.targets }),
	});

	return (
		<form {...formProps} className="flex flex-col gap-4">
			<FormErrorAlert message={state.status === 'error' ? state.message : undefined} />
			{submission.scans.map((scan) => (
				<input
					key={scan.pathname}
					type="hidden"
					name={recipeImportFieldNames.scans}
					value={scanFieldValue(scan)}
				/>
			))}
			<PhotoField
				idPrefix={photosId}
				role="scan"
				legend="Original recipe"
				description={`Photos of the recipe as it was written, up to ${settings.photos.maxScansPerImport} pages in order, such as both sides of a recipe card. They stay with the recipe, and anyone can see them.`}
				limit={settings.photos.maxScansPerImport}
				photos={values.photos.scan}
				nextId={values.nextId}
				dispatch={dispatch}
				uploadFolder={uploadFolder}
				uploader={uploader}
				error={values.error}
			/>
			<RecipeImportSubmit
				pending={pending}
				label="Read recipe"
				pendingLabel="Reading recipe"
				stage="Reading the photos…"
				waitNote={photosInProgress ? 'Wait for the photos to finish uploading.' : undefined}
			/>
		</form>
	);
}

// Mirrors the form while the page checks who is signed in: the photos' legend, description and
// drop area, and the button.
function ScanImportFormSkeleton() {
	return (
		<div role="status" aria-live="polite" className="flex flex-col gap-4">
			<span className="sr-only">Loading the import</span>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-40 w-full" />
			</div>
			<Skeleton className="h-9 w-32" />
		</div>
	);
}

export { ScanImportForm, ScanImportFormSkeleton };
