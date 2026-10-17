import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { PhotoField } from '@/components/recipe-form/photo-field';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	editRecipeForm,
	recipeFormValues,
	type RecipeFormPhoto,
} from '@/components/recipe-form/recipe-form-values';

// A photo as a camera saves one, drawn at its size.
function photo(name: string, size: { width: number; height: number }): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob === null
					? reject(new Error('The canvas drew no photo.'))
					: resolve(new File([blob], name, { type: 'image/jpeg' })),
			'image/jpeg'
		);
	});
}

// The field's file input, which the visible button opens, out of the accessibility tree.
function fileInput() {
	const input = document.querySelector<HTMLInputElement>('input[type="file"]');
	if (input === null) {
		throw new Error('The field has no file input.');
	}
	return page.elementLocator(input);
}

// The dish photos of a new recipe, each as the form holds it after every edit.
function WatchedPhotos({
	uploader,
	onPhotos,
}: {
	uploader: PhotoUploader;
	onPhotos: (photos: readonly RecipeFormPhoto[]) => void;
}) {
	const [values, dispatch] = React.useReducer(editRecipeForm, undefined, () => recipeFormValues());
	React.useEffect(() => onPhotos(values.photos.dish), [values, onPhotos]);

	return (
		<PhotoField
			idPrefix="photos"
			role="dish"
			legend="Photos"
			description="Photos of the finished dish."
			limit={10}
			photos={values.photos.dish}
			nextId={values.nextId}
			dispatch={dispatch}
			uploadFolder="dish/development/"
			uploader={uploader}
		/>
	);
}

// The dish photos of a recipe form, with a way to put the whole form back as it loaded, as
// discarding unsaved changes does.
function DiscardablePhotos({ uploader }: { uploader: PhotoUploader }) {
	const [values, dispatch] = React.useReducer(editRecipeForm, undefined, () => recipeFormValues());

	return (
		<>
			<PhotoField
				idPrefix="photos"
				role="dish"
				legend="Photos"
				description="Photos of the finished dish."
				limit={10}
				photos={values.photos.dish}
				nextId={values.nextId}
				dispatch={dispatch}
				uploadFolder="dish/development/"
				uploader={uploader}
			/>
			<button
				type="button"
				onClick={() => dispatch({ type: 'replaceForm', values: recipeFormValues() })}
			>
				Start over
			</button>
		</>
	);
}

describe('PhotoField', () => {
	it('stops an upload whose photo leaves the form without its Remove, as discarding changes does', async () => {
		const signals: AbortSignal[] = [];
		// Never finishes, so the photo is still uploading as the form starts over.
		const uploader: PhotoUploader = async (_pathname, _file, { signal }) => {
			signals.push(signal);
			await new Promise(() => {});
		};
		await render(<DiscardablePhotos uploader={uploader} />);

		await fileInput().upload(await photo('bars.jpg', { width: 1600, height: 1200 }));
		await expect.element(page.getByText('Uploading')).toBeInTheDocument();
		expect(signals).toHaveLength(1);
		expect(signals[0]?.aborted).toBe(false);

		await page.getByRole('button', { name: 'Start over' }).click();

		await expect.element(page.getByText('bars.jpg')).not.toBeInTheDocument();
		expect(signals[0]?.aborted).toBe(true);
	});

	it('uploads each photo as a JPEG drawn within its long edge, and keeps the size it was drawn at', async () => {
		const uploaded: File[] = [];
		const onPhotos = vi.fn<(photos: readonly RecipeFormPhoto[]) => void>();
		await render(
			<WatchedPhotos
				uploader={async (_pathname, file) => void uploaded.push(file)}
				onPhotos={onPhotos}
			/>
		);

		await fileInput().upload(await photo('bars.jpg', { width: 3200, height: 2400 }));

		await expect.poll(() => onPhotos.mock.lastCall?.[0][0]?.upload.status).toBe('uploaded');
		expect(onPhotos.mock.lastCall?.[0][0]?.upload).toEqual({
			status: 'uploaded',
			pathname: expect.stringMatching(/^dish\/development\/[\w-]+\.jpg$/),
			size: { width: 2400, height: 1800 },
			file: uploaded[0],
		});
		const drawn = await createImageBitmap(uploaded[0] as File);
		try {
			expect({ type: uploaded[0]?.type, width: drawn.width, height: drawn.height }).toEqual({
				type: 'image/jpeg',
				width: 2400,
				height: 1800,
			});
		} finally {
			drawn.close();
		}
	});
});
