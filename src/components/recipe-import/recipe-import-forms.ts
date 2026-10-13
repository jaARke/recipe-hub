// The fields the import forms submit and their actions read. Each is named for the service input it
// fills, so a validation problem's path names its field: url, scans, or scans.2 for the third page.
export const recipeImportFieldNames = {
	url: 'url',
	// One field per page, in page order.
	scans: 'scans',
} as const;

// The pages' pathnames, in the order the form sent them.
export function scanPathnamesFromForm(formData: FormData): string[] {
	return formData.getAll(recipeImportFieldNames.scans).filter((value) => typeof value === 'string');
}
