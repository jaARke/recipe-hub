import { z } from 'zod';
import type { ScanUpload } from '@/application/ingestion/recipe-import-service';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { storedImageSizeSchema } from '@/domain/recipe/recipe-image';

// The fields the import forms submit and their actions read. Each is named for the service input it
// fills, so a validation problem's path names its field: url, scans, or scans.2 for the third page.
export const recipeImportFieldNames = {
	url: 'url',
	// One field per page, in page order, each the page as JSON.
	scans: 'scans',
} as const;

const scanFieldSchema = z.object({
	pathname: z.string(),
	size: storedImageSizeSchema.optional(),
}) satisfies z.ZodType<ScanUpload>;

// The form always sends this shape, so anything else came from an out-of-date page.
const unreadableScansProblem = {
	path: '',
	message: 'We couldn’t read the photos. Reload the page and try again.',
};

// A page as its field sends it.
export function scanFieldValue(scan: ScanUpload): string {
	return JSON.stringify(scan);
}

function readScanField(value: FormDataEntryValue): ScanUpload {
	let data: unknown;
	try {
		data = typeof value === 'string' ? JSON.parse(value) : undefined;
	} catch {
		throw new InvalidRecipeError([unreadableScansProblem]);
	}
	const result = scanFieldSchema.safeParse(data);
	if (!result.success) {
		throw new InvalidRecipeError([unreadableScansProblem]);
	}
	return result.data;
}

// The pages, in the order the form sent them. Throws InvalidRecipeError when one can't be read.
export function scanUploadsFromForm(formData: FormData): ScanUpload[] {
	return formData.getAll(recipeImportFieldNames.scans).map(readScanField);
}
