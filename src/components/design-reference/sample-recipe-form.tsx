'use client';

import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
import { formText } from '@/components/forms/form-data';
import type { FormAction, FormState } from '@/components/forms/form-state';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	recipeFormFieldNames,
	type EditedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import type { RecipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

// Photo pathnames name a folder the recipe accepts, though nothing is stored there.
const sampleUploadFolders: Record<RecipeImageRole, string> = {
	dish: 'dish/development/',
	scan: 'scan/development/',
};

// About two seconds from start to finish, long enough to watch a photo's progress.
const sampleUploadSteps = 20;
const sampleUploadStepMilliseconds = 100;

// Reports progress as an upload would and stores nothing.
const sampleUpload: PhotoUploader = (_pathname, _file, { onProgress, signal }) =>
	new Promise((resolve, reject) => {
		let step = 0;
		const timer = setInterval(() => {
			step += 1;
			onProgress(step / sampleUploadSteps);
			if (step === sampleUploadSteps) {
				clearInterval(timer);
				resolve();
			}
		}, sampleUploadStepMilliseconds);
		signal.addEventListener(
			'abort',
			() => {
				clearInterval(timer);
				reject(signal.reason);
			},
			{ once: true }
		);
	});

// Checks the recipe as the action and the service do, then saves nothing, so the form stays here.
const saveSampleRecipe: FormAction = (_state, formData) =>
	standIn<FormState>(
		inputProblems(() =>
			parseRecipeContent(recipeContentFromForm(formText(formData, recipeFormFieldNames.recipe)))
		) ?? {
			status: 'error',
			message: 'Nothing was saved: this sample form shows the layout only.',
			fieldErrors: {},
		}
	);

function SampleRecipeForm({
	initial,
	editing,
}: {
	initial: RecipeFormValues;
	editing?: EditedRecipe;
}) {
	return (
		<RecipeForm
			initial={initial}
			action={saveSampleRecipe}
			uploadFolders={sampleUploadFolders}
			uploader={sampleUpload}
			editing={editing}
			submitLabel="Save recipe"
		/>
	);
}

export { SampleRecipeForm };
