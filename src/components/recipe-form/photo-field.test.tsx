import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoField } from '@/components/recipe-form/photo-field';
import type { PhotoUploader } from '@/components/recipe-form/photo-upload';
import { editRecipeForm, recipeFormValues } from '@/components/recipe-form/recipe-form-values';

// happy-dom draws no images, so a chosen photo goes to its upload as it was chosen.
vi.mock('@/components/recipe-form/photo-processing', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/components/recipe-form/photo-processing')>()),
	normalizePhoto: async (file: File) => ({ file, width: 1600, height: 1200 }),
}));

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
		const user = userEvent.setup();
		const signals: AbortSignal[] = [];
		// Never finishes, so the photo is still uploading as the form starts over.
		const uploader: PhotoUploader = async (_pathname, _file, { signal }) => {
			signals.push(signal);
			await new Promise(() => {});
		};
		render(<DiscardablePhotos uploader={uploader} />);
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		if (input === null) {
			throw new Error('The field has no file input.');
		}

		await user.upload(input, new File(['jpeg'], 'bars.jpg', { type: 'image/jpeg' }));
		await waitFor(() => expect(signals).toHaveLength(1));
		expect(await screen.findByText('Uploading')).toBeDefined();
		expect(signals[0]?.aborted).toBe(false);

		await user.click(screen.getByRole('button', { name: 'Start over' }));

		expect(screen.queryByText('bars.jpg')).toBeNull();
		expect(signals[0]?.aborted).toBe(true);
	});
});
