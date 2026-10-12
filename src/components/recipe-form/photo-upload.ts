// The one presentation module that imports the Blob SDK, because photos upload from the browser.
import { uploadPresigned } from '@vercel/blob/client';

// Authorizes each upload and answers with its presigned URL.
const uploadRoutePath = '/api/uploads';

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
