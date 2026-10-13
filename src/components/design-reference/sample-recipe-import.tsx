'use client';

import {
	sampleUpload,
	sampleUploadFolders,
} from '@/components/design-reference/sample-recipe-form';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { ScanImportForm } from '@/components/recipe-import/scan-import-form';
import { UrlImportForm } from '@/components/recipe-import/url-import-form';

// Long enough to watch an import's progress count a few seconds.
const sampleImportMilliseconds = 4000;

// Settles as a refused import would, so the form stays here and shows its error.
const importNothing: FormAction = () =>
	new Promise<FormState>((resolve) =>
		setTimeout(
			() =>
				resolve({
					status: 'error',
					message: 'Nothing was imported: this sample form shows the layout only.',
					fieldErrors: {},
				}),
			sampleImportMilliseconds
		)
	);

function SampleUrlImportForm() {
	return <UrlImportForm action={importNothing} />;
}

function SampleScanImportForm() {
	return (
		<ScanImportForm
			action={importNothing}
			uploadFolder={sampleUploadFolders.scan}
			uploader={sampleUpload}
		/>
	);
}

export { SampleScanImportForm, SampleUrlImportForm };
