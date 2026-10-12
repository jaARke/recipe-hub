import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import { AppError } from '@/lib/errors';

type PhotoSize = {
	width: number;
	height: number;
};

export type NormalizedPhoto = PhotoSize & {
	file: File;
};

// The longest side in pixels, and the JPEG quality from 0 to 1.
type PhotoTarget = {
	longEdge: number;
	quality: number;
};

// Scans are larger, leaving headroom above the input sizes of the AI vision models that read them.
const photoTargets: Record<RecipeImageRole, PhotoTarget> = {
	dish: { longEdge: 2400, quality: 0.85 },
	scan: { longEdge: 3072, quality: 0.9 },
};

// JPEG has no transparency, and encoding composites transparent pixels onto black.
const jpegBackground = 'white';

// The browser cannot decode the file, such as a HEIC photo outside Safari.
export class UnreadablePhotoError extends AppError {
	readonly code = 'photo.unreadable';

	constructor(options?: ErrorOptions) {
		super('Photo could not be read', options);
	}
}

// Scaled to fit the role's long edge, never enlarged, and at least one pixel on each side.
export function normalizedPhotoSize(natural: PhotoSize, role: RecipeImageRole): PhotoSize {
	const scale = Math.min(1, photoTargets[role].longEdge / Math.max(natural.width, natural.height));
	return {
		width: Math.max(1, Math.round(natural.width * scale)),
		height: Math.max(1, Math.round(natural.height * scale)),
	};
}

// An <img> applies EXIF orientation in every engine; WebKit's createImageBitmap from a Blob does
// not (bug 237895).
async function decodePhoto(url: string): Promise<HTMLImageElement> {
	const image = new Image();
	image.src = url;
	try {
		await image.decode();
	} catch (error) {
		throw new UnreadablePhotoError({ cause: error });
	}
	// Some SVGs have no size of their own, so there is nothing to scale.
	if (image.naturalWidth === 0 || image.naturalHeight === 0) {
		throw new UnreadablePhotoError();
	}
	return image;
}

function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob === null) {
					reject(new Error('Canvas could not be encoded as JPEG'));
				} else {
					resolve(blob);
				}
			},
			'image/jpeg',
			quality
		);
	});
}

async function resizedJpeg(
	image: HTMLImageElement,
	size: PhotoSize,
	quality: number
): Promise<Blob> {
	const bitmap = await createImageBitmap(image, {
		resizeWidth: size.width,
		resizeHeight: size.height,
		resizeQuality: 'high',
	});
	const canvas = document.createElement('canvas');
	try {
		canvas.width = size.width;
		canvas.height = size.height;
		const context = canvas.getContext('2d', { colorSpace: 'srgb' });
		if (context === null) {
			throw new Error('Canvas has no 2D context');
		}
		context.fillStyle = jpegBackground;
		context.fillRect(0, 0, size.width, size.height);
		context.drawImage(bitmap, 0, 0);
		return await canvasJpeg(canvas, quality);
	} finally {
		bitmap.close();
		// Safari counts a canvas against its memory limit until the canvas is shrunk.
		canvas.width = 0;
		canvas.height = 0;
	}
}

function jpegFileName(name: string): string {
	return `${name.replace(/\.[^.]*$/, '')}.jpg`;
}

// Resizes and re-encodes a photo as an sRGB JPEG, which also drops its metadata, such as its
// location. Throws UnreadablePhotoError when the browser cannot decode it.
export async function normalizePhoto(file: File, role: RecipeImageRole): Promise<NormalizedPhoto> {
	const url = URL.createObjectURL(file);
	try {
		const image = await decodePhoto(url);
		const size = normalizedPhotoSize(
			{ width: image.naturalWidth, height: image.naturalHeight },
			role
		);
		const jpeg = await resizedJpeg(image, size, photoTargets[role].quality);
		return { file: new File([jpeg], jpegFileName(file.name), { type: 'image/jpeg' }), ...size };
	} finally {
		URL.revokeObjectURL(url);
	}
}
