import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/components/forms/form-state';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import { scanUploadsFromForm } from '@/components/recipe-import/recipe-import-forms';
import { ScanImportForm } from '@/components/recipe-import/scan-import-form';

// Resizing needs a real browser's canvas, so photos arrive as chosen, drawn at this size.
const drawnSize = { width: 1200, height: 1600 };
vi.mock('@/components/recipe-form/photo-processing', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/components/recipe-form/photo-processing')>()),
	normalizePhoto: async (file: File) => ({ file, size: drawnSize }),
}));

const failUpload: PhotoUploader = () => Promise.reject(new TypeError('Failed to fetch'));

function renderForm(action: FormAction, uploader: PhotoUploader = failUpload) {
	render(<ScanImportForm action={action} uploadFolder="scan/development/" uploader={uploader} />);
}

function filePicker(): HTMLInputElement {
	const picker = document.querySelector<HTMLInputElement>('input[type="file"]');
	if (picker === null) {
		throw new Error('The form has no file picker.');
	}
	return picker;
}

const card = new File(['jpeg'], 'card.jpg', { type: 'image/jpeg' });

describe('ScanImportForm', () => {
	it('asks for a photo at once when it has none, before any request, with focus on the problem', async () => {
		const action = vi.fn<FormAction>();
		const user = userEvent.setup();
		renderForm(action);

		await user.click(screen.getByRole('button', { name: 'Read recipe' }));

		const problem = screen.getByText('Add at least one photo.');
		expect(document.activeElement).toBe(problem);
		expect(action).not.toHaveBeenCalled();
	});

	it('asks for a photo whose upload failed to be added again, not for a photo', async () => {
		const action = vi.fn<FormAction>();
		const user = userEvent.setup();
		renderForm(action);

		await user.upload(filePicker(), card);
		expect(await screen.findByText('Didn’t upload')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Read recipe' }));

		const problem = screen.getByText('The photo didn’t upload. Remove it and add it again.');
		expect(document.activeElement).toBe(problem);
		expect(screen.queryByText('Add at least one photo.')).toBeNull();
		expect(action).not.toHaveBeenCalled();
	});

	it('no longer asks for a photo once one is stored, while the import reads it', async () => {
		// The import is still reading when the test ends.
		const action = vi.fn<FormAction>(() => new Promise(() => {}));
		const user = userEvent.setup();
		renderForm(action, async () => {});

		await user.click(screen.getByRole('button', { name: 'Read recipe' }));
		expect(screen.getByText('Add at least one photo.')).toBeDefined();
		await user.upload(filePicker(), card);
		await waitFor(() =>
			expect(screen.queryByText('Wait for the photos to finish uploading.')).toBeNull()
		);
		await user.click(screen.getByRole('button', { name: 'Read recipe' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		expect(screen.queryByText('Add at least one photo.')).toBeNull();
	});

	it('sends each page with the size it was drawn at', async () => {
		const action = vi.fn<FormAction>(() => new Promise(() => {}));
		const user = userEvent.setup();
		renderForm(action, async () => {});

		await user.upload(filePicker(), card);
		await waitFor(() =>
			expect(screen.queryByText('Wait for the photos to finish uploading.')).toBeNull()
		);
		await user.click(screen.getByRole('button', { name: 'Read recipe' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		const [, formData] = action.mock.calls[0] ?? [];
		expect(scanUploadsFromForm(formData ?? new FormData())).toEqual([
			{ pathname: expect.stringMatching(/^scan\/development\/[\w-]+\.jpg$/), size: drawnSize },
		]);
	});
});
