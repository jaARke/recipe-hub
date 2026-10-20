'use client';

import * as React from 'react';
import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
// Copies of the anise-cakes evaluation case's two pages; scripts/evaluate/SOURCES.md records their
// source, rights, and how they were scaled.
import standInScanPage1 from '@/components/design-reference/stand-in-scans/anise-cakes-page-1.jpg';
import standInScanPage2 from '@/components/design-reference/stand-in-scans/anise-cakes-page-2.jpg';
import { formText } from '@/components/forms/form-data';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { DraftPageHeading } from '@/components/recipe-form/draft-page-heading';
import {
	EditingPageHeading,
	editingPageTitles,
} from '@/components/recipe-form/editing-page-heading';
import { HeldDraftProvider, type HeldDraft } from '@/components/recipe-form/held-draft';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	RecipeForm,
	type OpenedDraft,
	type RecipeFormDrafts,
} from '@/components/recipe-form/recipe-form';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	recipeFormFieldNames,
	type EditedRecipe,
	type SavedDraftResult,
} from '@/components/recipe-form/recipe-form-fields';
import {
	editRecipeForm,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { DraftMenu, EditedRecipeMenu, HeldDraftMenu } from '@/components/recipe-form/subject-menus';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { ImageSize, RecipeImageRole } from '@/domain/recipe/recipe-image';

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

// A stand-in page as it would be once uploaded: its file, and the size it was drawn at.
type UploadedScan = {
	file: File;
	size: ImageSize;
};

// Reads the stand-in pages into files once, when asked to. The form shows a scan it has uploaded but
// not saved from its file, so the pages need no stored scan.
function useStandInScans(wanted: boolean): UploadedScan[] | undefined {
	const [scans, setScans] = React.useState<UploadedScan[]>();

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
			const file = new File([await response.blob()], fileName, { type: 'image/jpeg' });
			return { file, size: { width: image.width, height: image.height } };
		});
		Promise.all(reads).then(setScans, (error: unknown) => {
			// A cancelled read can fail with any error, so the signal is what tells.
			if (!controller.signal.aborted) {
				throw error;
			}
		});
		return () => controller.abort();
	}, [wanted]);

	return scans;
}

// The values with the scans added as the member just uploaded them, through the edits the photo
// field makes.
function withUploadedScans(
	values: RecipeFormValues,
	scans: readonly UploadedScan[]
): RecipeFormValues {
	const firstId = values.nextId;
	const edits: RecipeFormEdit[] = [
		{ type: 'addPhotos', role: 'scan', fileNames: scans.map(({ file }) => file.name) },
		...scans.flatMap(({ file, size }, index): RecipeFormEdit[] => [
			{
				type: 'startPhotoUpload',
				photoId: firstId + index,
				pathname: `${sampleUploadFolders.scan}${file.name}`,
				size,
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

// Says a draft was saved, under the one id the samples share, and keeps nothing.
const saveSampleDraft: FormAction<SavedDraftResult> = () =>
	standIn<FormState<SavedDraftResult>>({
		status: 'success',
		draftId: 'sample-draft',
		savedAt: new Date(),
	});

// Stands in for the member signed in, whose unsaved changes a menu's delete removes; deleting a
// sample is refused, so none are.
const sampleMemberId = 'sample-member';

// Refuses, so the sample stays here rather than leaving for the list or the drafts.
const deleteSample: FormAction = () =>
	standIn<FormState>({
		status: 'error',
		message: 'Nothing was deleted: this sample form shows the layout only.',
		fieldErrors: {},
	});

// The page's URL stays the design reference's.
const sampleDrafts: RecipeFormDrafts = {
	save: saveSampleDraft,
	inUrl: false,
};

function SampleRecipeForm({
	initial,
	editing,
	openedDraft,
	standInScans = false,
}: {
	initial: RecipeFormValues;
	editing?: EditedRecipe;
	// The saved draft the form opens, when adding a recipe.
	openedDraft?: OpenedDraft;
	// Adds the stand-in pages of an original recipe, as just uploaded.
	standInScans?: boolean;
}) {
	const scans = useStandInScans(standInScans);
	const values = React.useMemo(
		() => (scans === undefined ? initial : withUploadedScans(initial, scans)),
		[initial, scans]
	);

	return (
		<RecipeForm
			// The form reads its values once, so it starts again with the pages once they're read.
			key={scans === undefined ? 'without-scans' : 'with-scans'}
			initial={values}
			action={saveSampleRecipe}
			uploadFolders={sampleUploadFolders}
			uploader={sampleUpload}
			editing={editing}
			drafts={editing === undefined ? { ...sampleDrafts, opened: openedDraft } : undefined}
		/>
	);
}

// What a sample page edits, which its heading's menu acts on: a new recipe, from a saved draft if
// one is given; an import's draft; or a recipe.
export type SampleEditingSubject =
	| { page: 'add'; draft?: HeldDraft & OpenedDraft }
	| { page: 'review'; importId: string; title: string | undefined }
	| { page: 'edit'; recipe: EditedRecipe; slug: string; title: string };

// The heading's menu on each sample page, as the site's pages give it.
function sampleMenu(subject: SampleEditingSubject): React.ReactNode {
	switch (subject.page) {
		case 'add':
			return <HeldDraftMenu memberId={sampleMemberId} action={deleteSample} />;
		case 'review':
			return (
				<DraftMenu
					label="Draft actions"
					draft={{ kind: 'import', id: subject.importId }}
					title={subject.title}
					formSubject={{ kind: 'import', importId: subject.importId }}
					memberId={sampleMemberId}
					action={deleteSample}
				/>
			);
		case 'edit':
			return (
				<EditedRecipeMenu
					recipe={{ id: subject.recipe.id, slug: subject.slug, title: subject.title }}
					memberId={sampleMemberId}
					action={deleteSample}
				/>
			);
	}
}

// An editing page as the site composes it: its heading, under the design reference's own, with the
// page's menu, over the sample form. Adding a recipe is headed by the draft's title, as a draft's
// page is.
function SampleEditingPage({
	subject,
	initial,
	standInScans,
}: {
	subject: SampleEditingSubject;
	initial: RecipeFormValues;
	standInScans?: boolean;
}) {
	const draft = subject.page === 'add' ? subject.draft : undefined;
	return (
		<HeldDraftProvider opened={draft}>
			{subject.page === 'add' ? (
				<DraftPageHeading headingTag="h4" menu={sampleMenu(subject)} />
			) : (
				<EditingPageHeading
					title={editingPageTitles[subject.page]}
					headingTag="h4"
					menu={sampleMenu(subject)}
				/>
			)}
			<SampleRecipeForm
				initial={initial}
				editing={subject.page === 'edit' ? subject.recipe : undefined}
				openedDraft={draft}
				standInScans={standInScans}
			/>
		</HeldDraftProvider>
	);
}

export {
	deleteSample,
	SampleEditingPage,
	sampleMemberId,
	SampleRecipeForm,
	sampleUpload,
	sampleUploadFolders,
};
