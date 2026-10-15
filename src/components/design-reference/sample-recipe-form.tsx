'use client';

import * as React from 'react';
import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
// Copies of the anise-cakes evaluation case's two pages; scripts/evaluate/SOURCES.md records their
// source, rights, and how they were scaled.
import standInScanPage1 from '@/components/design-reference/stand-in-scans/anise-cakes-page-1.jpg';
import standInScanPage2 from '@/components/design-reference/stand-in-scans/anise-cakes-page-2.jpg';
import { formText } from '@/components/forms/form-data';
import type { FormAction, FormState } from '@/components/forms/form-state';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	recipeFormFieldNames,
	type EditedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import {
	editRecipeForm,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
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

const standInScanPages = [
	{ image: standInScanPage1, fileName: 'anise-cakes-page-1.jpg' },
	{ image: standInScanPage2, fileName: 'anise-cakes-page-2.jpg' },
] as const;

// Reads the stand-in pages into files once, when asked to. The form shows a scan it has uploaded but
// not saved from its file, so the pages need no stored scan.
function useStandInScanFiles(wanted: boolean): File[] | undefined {
	const [files, setFiles] = React.useState<File[]>();

	React.useEffect(() => {
		if (!wanted) {
			return;
		}
		const controller = new AbortController();
		const reads = standInScanPages.map(async ({ image, fileName }) => {
			const response = await fetch(image.src, { signal: controller.signal });
			if (!response.ok) {
				throw new Error(`The stand-in scan ${fileName} answered ${response.status}`);
			}
			return new File([await response.blob()], fileName, { type: 'image/jpeg' });
		});
		Promise.all(reads).then(setFiles, (error: unknown) => {
			// A cancelled read can fail with any error, so the signal is what tells.
			if (!controller.signal.aborted) {
				throw error;
			}
		});
		return () => controller.abort();
	}, [wanted]);

	return files;
}

// The values with the files added as scans the member just uploaded, through the edits the photo
// field makes.
function withUploadedScans(values: RecipeFormValues, files: readonly File[]): RecipeFormValues {
	const firstId = values.nextId;
	const edits: RecipeFormEdit[] = [
		{ type: 'addPhotos', role: 'scan', fileNames: files.map((file) => file.name) },
		...files.flatMap((file, index): RecipeFormEdit[] => [
			{
				type: 'startPhotoUpload',
				photoId: firstId + index,
				pathname: `${sampleUploadFolders.scan}${file.name}`,
				file,
			},
			{ type: 'finishPhotoUpload', photoId: firstId + index },
		]),
	];
	return edits.reduce(editRecipeForm, values);
}

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
	tagLabels,
	editing,
	standInScans = false,
}: {
	initial: RecipeFormValues;
	tagLabels: readonly string[];
	editing?: EditedRecipe;
	// Adds the stand-in pages of an original recipe, as just uploaded.
	standInScans?: boolean;
}) {
	const scanFiles = useStandInScanFiles(standInScans);
	const values = React.useMemo(
		() => (scanFiles === undefined ? initial : withUploadedScans(initial, scanFiles)),
		[initial, scanFiles]
	);

	return (
		<RecipeForm
			// The form reads its values once, so it starts again with the pages once they're read.
			key={scanFiles === undefined ? 'without-scans' : 'with-scans'}
			initial={values}
			action={saveSampleRecipe}
			uploadFolders={sampleUploadFolders}
			tagLabels={tagLabels}
			uploader={sampleUpload}
			editing={editing}
			submitLabel="Save recipe"
		/>
	);
}

export { SampleRecipeForm, sampleUpload, sampleUploadFolders };
