import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageFolders } from '@/application/recipes/image-folders';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';

beforeEach(() => {
	// Nothing listens here, so a request that slipped past the refusal would fail, not reach Blob.
	vi.stubEnv('VERCEL_BLOB_API_URL', 'http://127.0.0.1:9');
	vi.stubEnv('VERCEL_OIDC_TOKEN', 'not-a-token');
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('delete', () => {
	it.each([
		[['dish/production/photo.jpg']],
		[['dish/seed/buttermilk-biscuits.jpg']],
		[['dish/preview/feature-x/photo.jpg', 'dish/production/photo.jpg']],
	])(
		"refuses %j, which reaches outside this environment's folders, before calling Blob",
		async (pathnames) => {
			const store = new BlobImageStore({
				storeId: 'store_test',
				folders: new ImageFolders('preview/feature-x'),
			});

			await expect(store.delete(pathnames)).rejects.toThrow(
				"Images outside this environment's folders are never deleted"
			);
		}
	);
});
