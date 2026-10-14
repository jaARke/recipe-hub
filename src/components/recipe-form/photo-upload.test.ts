import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPhotoStored, newPhotoPathname } from '@/components/recipe-form/photo-upload';
import { recipeImageSchema } from '@/domain/recipe/recipe-image';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('newPhotoPathname', () => {
	it.each([
		['dish', 'dish/production/'],
		['scan', 'scan/development/'],
		['dish', 'dish/preview/session-6-authoring/'],
	] as const)('names a JPEG in a %s folder that the recipe accepts', (role, folder) => {
		const pathname = newPhotoPathname(folder);

		expect(pathname.startsWith(folder)).toBe(true);
		expect(pathname.slice(folder.length)).toMatch(
			/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.jpg$/
		);
		expect(recipeImageSchema.safeParse({ role, pathname }).success).toBe(true);
	});

	it('names each upload differently', () => {
		expect(newPhotoPathname('dish/development/')).not.toBe(newPhotoPathname('dish/development/'));
	});
});

describe('isPhotoStored', () => {
	const pathname = 'dish/development/0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10.jpg';

	function answering(status: number) {
		const fetch = vi.fn(async () => new Response(null, { status }));
		vi.stubGlobal('fetch', fetch);
		return fetch;
	}

	it('asks the image route for the photo’s headers, past any copy the browser kept', async () => {
		const fetch = answering(200);

		await isPhotoStored(pathname);

		expect(fetch).toHaveBeenCalledWith(`/api/images/${pathname}`, {
			method: 'HEAD',
			cache: 'no-store',
			signal: expect.any(AbortSignal),
		});
	});

	it('finds a photo gone only when the route says it isn’t found', async () => {
		answering(404);
		await expect(isPhotoStored(pathname)).resolves.toBe(false);

		answering(200);
		await expect(isPhotoStored(pathname)).resolves.toBe(true);

		answering(503);
		await expect(isPhotoStored(pathname)).resolves.toBe(true);
	});

	it('gives up once the lookup has waited 10 seconds', async () => {
		vi.useFakeTimers();
		try {
			// Never answers, and fails as fetch does once its signal aborts.
			vi.stubGlobal(
				'fetch',
				vi.fn(
					(_url: string, init: RequestInit) =>
						new Promise((_resolve, reject) => {
							init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
						})
				)
			);
			const lookup = isPhotoStored(pathname);
			const outcome = expect(lookup).rejects.toMatchObject({ name: 'TimeoutError' });

			await vi.advanceTimersByTimeAsync(9_999);
			await vi.advanceTimersByTimeAsync(1);

			await outcome;
		} finally {
			vi.useRealTimers();
		}
	});

	it('rejects when the request fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			})
		);

		await expect(isPhotoStored(pathname)).rejects.toThrow('Failed to fetch');
	});
});
