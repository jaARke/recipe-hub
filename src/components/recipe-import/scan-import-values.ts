import type { ScanUpload } from '@/application/ingestion/recipe-import-service';
import type { FieldErrors } from '@/components/forms/form-state';
import {
	editPhotos,
	storedPathname,
	storedPhoto,
	type PhotoEdit,
	type RecipeFormPhotoValues,
} from '@/components/recipe-form/recipe-form-values';
import { recipeImportFieldNames } from '@/components/recipe-import/recipe-import-forms';
import { noScansMessage } from '@/domain/recipe/recipe-import';

// The photo import's value and every edit to it. Its pages are held as the recipe form's photo
// field holds them, so the import uses that field. Pure, so the form's behavior is tested without a
// browser.

export type ScanImportValues = RecipeFormPhotoValues & {
	// About the pages together, such as too many to read at once.
	error?: string;
};

// Keyed by the path a page's problems take, such as scans.2, naming the photo they show on.
export type PageTargets = ReadonlyMap<string, number>;

// The pages as sent, in order, and where each page's problems show.
export type ScanImportSubmission = {
	scans: ScanUpload[];
	targets: PageTargets;
};

export type ScanImportEdit =
	PhotoEdit | { type: 'attachErrors'; fieldErrors: FieldErrors; targets: PageTargets };

export const emptyScanImport: ScanImportValues = { photos: { dish: [], scan: [] }, nextId: 0 };

// Only stored pages are sent; one still uploading, or one that failed, has nothing to read.
export function scanImportSubmission(values: ScanImportValues): ScanImportSubmission {
	const scans: ScanUpload[] = [];
	const targets = new Map<string, number>();
	for (const photo of values.photos.scan) {
		const scan = storedPhoto(photo);
		if (scan === undefined) {
			continue;
		}
		targets.set(`${recipeImportFieldNames.scans}.${scans.length}`, photo.id);
		scans.push(scan);
	}
	return { scans, targets };
}

// What the browser knows an import would be refused for, as a problem with the pages together: no
// stored page to read. A photo whose upload failed is one to add again, not no photo.
export function scanImportProblems(values: ScanImportValues): FieldErrors {
	const photos = values.photos.scan;
	if (photos.some((photo) => storedPathname(photo) !== undefined)) {
		return {};
	}
	const failed = photos.filter((photo) => photo.upload.status === 'failed').length;
	if (failed === 0) {
		return { [recipeImportFieldNames.scans]: noScansMessage };
	}
	return {
		[recipeImportFieldNames.scans]:
			failed === 1
				? 'The photo didn’t upload. Remove it and add it again.'
				: 'The photos didn’t upload. Remove them and add them again.',
	};
}

// The photo for the longest part of the path that names a page, so a problem with any part of a
// page, such as scans.2.size, lands on its photo.
function pagePhotoId(path: string, targets: PageTargets): number | undefined {
	const segments = path.split('.');
	for (let length = segments.length; length > 0; length -= 1) {
		const photoId = targets.get(segments.slice(0, length).join('.'));
		if (photoId !== undefined) {
			return photoId;
		}
	}
	return undefined;
}

// Replaces every error with these. The first problem for each page wins, and one that names no page
// shows with the pages together.
function withErrors(
	values: ScanImportValues,
	fieldErrors: FieldErrors,
	targets: PageTargets
): ScanImportValues {
	const photoErrors = new Map<number, string>();
	let error: string | undefined;
	for (const [path, message] of Object.entries(fieldErrors)) {
		if (message === undefined) {
			continue;
		}
		const photoId = pagePhotoId(path, targets);
		if (photoId === undefined) {
			error ??= message;
		} else if (!photoErrors.has(photoId)) {
			photoErrors.set(photoId, message);
		}
	}

	return {
		...values,
		photos: {
			...values.photos,
			scan: values.photos.scan.map((photo) => ({ ...photo, error: photoErrors.get(photo.id) })),
		},
		error,
	};
}

export function editScanImport(values: ScanImportValues, edit: ScanImportEdit): ScanImportValues {
	return edit.type === 'attachErrors'
		? withErrors(values, edit.fieldErrors, edit.targets)
		: editPhotos(values, edit);
}
