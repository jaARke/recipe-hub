// The one presentation module that imports the Blob SDK, because photos upload from the browser.
import { uploadPresigned } from '@vercel/blob/client';
import { recipeImageSrc } from '@/components/recipe/recipe-paths';
import { deadlineAfter } from '@/lib/deadline';

// Authorizes each upload and answers with its presigned URL.
const uploadRoutePath = '/api/uploads';

// Long enough for a slow connection to answer, and short enough that a restored photo storage no
// longer holds soon shows it didn't upload.
const photoLookupTimeLimitMs = 10_000;

// Reports progress from 0 to 1, and rejects when the upload fails or the signal aborts it.
export type PhotoUploader = (
	pathname: string,
	file: File,
	options: { onProgress: (fraction: number) => void; signal: AbortSignal }
) => Promise<void>;

// A new name for every upload, because the upload route never lets one photo replace another.
export function newPhotoPathname(folder: string): string {
	return `${folder}${crypto.randomUUID()}.jpg`;
}

export const uploadPhoto: PhotoUploader = async (pathname, file, { onProgress, signal }) => {
	await uploadPresigned(pathname, file, {
		access: 'private',
		handleUploadUrl: uploadRoutePath,
		contentType: 'image/jpeg',
		multipart: false,
		onUploadProgress: ({ percentage }) => onProgress(percentage / 100),
		abortSignal: signal,
	});
};

// Whether an upload is still stored, since the image sweep removes one that nothing has named for a
// day: false only when the image route answers that it isn't found. Rejects when the request fails
// or outlasts its time limit.
export async function isPhotoStored(pathname: string): Promise<boolean> {
	const response = await fetch(recipeImageSrc(pathname), {
		method: 'HEAD',
		// Asks storage, never a copy this browser kept.
		cache: 'no-store',
		signal: deadlineAfter(photoLookupTimeLimitMs),
	});
	return response.status !== 404;
}
