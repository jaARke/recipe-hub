import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { heldResult } from '@/components/forms/testing/held-result';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import { scanUploadsFromForm } from '@/components/recipe-import/recipe-import-forms';
import { ScanImportForm } from '@/components/recipe-import/scan-import-form';

// A strip twice a scan's long edge, so the browser draws it at half its size, and quickly.
const naturalSize = { width: 6144, height: 20 };
const drawnSize = { width: 3072, height: 10 };

const failUpload: PhotoUploader = () => Promise.reject(new TypeError('Failed to fetch'));

async function renderForm(action: FormAction, uploader: PhotoUploader = failUpload) {
	await render(
		<ScanImportForm action={action} uploadFolder="scan/development/" uploader={uploader} />
	);
}

// A photo of a blank recipe card, as a camera would give one.
async function photoOfCard(): Promise<File> {
	const canvas = new OffscreenCanvas(naturalSize.width, naturalSize.height);
	const context = canvas.getContext('2d');
	if (context === null) {
		throw new Error('The canvas has no 2D context.');
	}
	context.fillStyle = 'white';
	context.fillRect(0, 0, naturalSize.width, naturalSize.height);
	const jpeg = await canvas.convertToBlob({ type: 'image/jpeg' });
	return new File([jpeg], 'card.jpg', { type: 'image/jpeg' });
}

// The native picker Choose photos opens, which stays out of the accessibility tree.
function filePicker() {
	const picker = document.querySelector('input[type="file"]');
	if (picker === null) {
		throw new Error('The form has no file picker.');
	}
	return page.elementLocator(picker);
}

function readRecipeButton() {
	return page.getByRole('button', { name: 'Read recipe' });
}

describe('ScanImportForm', () => {
	it('asks for a photo at once when it has none, before any request, with focus on the problem', async () => {
		const action = vi.fn<FormAction>();
		await renderForm(action);

		await readRecipeButton().click();

		await expect.element(page.getByText('Add at least one photo.')).toHaveFocus();
		expect(action).not.toHaveBeenCalled();
	});

	it('asks for a photo whose upload failed to be added again, not for a photo', async () => {
		const action = vi.fn<FormAction>();
		await renderForm(action);

		await filePicker().upload(await photoOfCard());
		await expect.element(page.getByText('Didn’t upload')).toBeVisible();
		await readRecipeButton().click();

		await expect
			.element(page.getByText('The photo didn’t upload. Remove it and add it again.'))
			.toHaveFocus();
		await expect.element(page.getByText('Add at least one photo.')).not.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();
	});

	it('no longer asks for a photo once one is stored, while the import reads it', async () => {
		// The import is still reading when the test ends.
		const { promise } = heldResult<FormState>({ status: 'success' });
		const action = vi.fn<FormAction>(() => promise);
		await renderForm(action, async () => {});

		await readRecipeButton().click();
		await expect.element(page.getByText('Add at least one photo.')).toBeVisible();
		await filePicker().upload(await photoOfCard());
		await expect.element(page.getByText('Uploaded')).toBeVisible();
		await readRecipeButton().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		await expect.element(page.getByText('Add at least one photo.')).not.toBeInTheDocument();
	});

	it('sends each page as it uploaded, with the size it was drawn at', async () => {
		const { promise } = heldResult<FormState>({ status: 'success' });
		const action = vi.fn<FormAction>(() => promise);
		const uploader = vi.fn<PhotoUploader>(async () => {});
		await renderForm(action, uploader);

		await filePicker().upload(await photoOfCard());
		await expect.element(page.getByText('Uploaded')).toBeVisible();
		await readRecipeButton().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		const [, formData] = action.mock.calls[0] ?? [];
		const scans = scanUploadsFromForm(formData ?? new FormData());
		expect(scans).toEqual([
			{ pathname: expect.stringMatching(/^scan\/development\/[\w-]+\.jpg$/), size: drawnSize },
		]);
		const [pathname, uploaded] = uploader.mock.calls[0] ?? [];
		expect(pathname).toBe(scans[0]?.pathname);
		const bitmap = await createImageBitmap(uploaded ?? new Blob());
		try {
			expect({ width: bitmap.width, height: bitmap.height }).toEqual(drawnSize);
		} finally {
			bitmap.close();
		}
	});
});
