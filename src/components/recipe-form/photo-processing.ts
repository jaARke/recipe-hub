import { maxImportScanSizeInBytes } from '@/domain/recipe/import-limits';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import { AppError } from '@/lib/errors';

type PhotoSize = {
	width: number;
	height: number;
};

export type NormalizedPhoto = PhotoSize & {
	file: File;
};

// A JPEG and the size it was drawn at.
type EncodedPhoto = PhotoSize & {
	jpeg: Blob;
};

// Draws the photo at a size, and encodes what it drew last at a JPEG quality.
type PhotoCanvas = {
	draw: (size: PhotoSize) => Promise<void>;
	encode: (quality: number) => Promise<Blob>;
};

// The longest side in pixels, and the JPEG quality from 0 to 1. A photo over its byte budget is
// encoded again at each lower quality in turn, then drawn at each smaller long edge and encoded at
// the lowest quality, until it fits, and keeps the last attempt if nothing does.
type PhotoTarget = {
	longEdge: number;
	quality: number;
	byteBudget?: {
		maxBytes: number;
		lowerQualities: readonly number[];
		smallerLongEdges: readonly number[];
	};
};

// Scans are larger, leaving headroom above the input sizes of the AI vision models that read them,
// and stay within the size an import reads. A scan no quality fits shrinks a quarter at a time,
// down to 1600 px, which still reads handwriting.
const photoTargets: Record<RecipeImageRole, PhotoTarget> = {
	dish: { longEdge: 2400, quality: 0.85 },
	scan: {
		longEdge: 3072,
		quality: 0.9,
		byteBudget: {
			maxBytes: maxImportScanSizeInBytes,
			lowerQualities: [0.8, 0.7, 0.6, 0.5],
			smallerLongEdges: [2304, 1728, 1600],
		},
	},
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

// Scaled to fit the long edge, never enlarged, and at least one pixel on each side.
function fittedSize(size: PhotoSize, longEdge: number): PhotoSize {
	const scale = Math.min(1, longEdge / Math.max(size.width, size.height));
	return {
		width: Math.max(1, Math.round(size.width * scale)),
		height: Math.max(1, Math.round(size.height * scale)),
	};
}

// The size a photo of the role is drawn at first.
export function normalizedPhotoSize(natural: PhotoSize, role: RecipeImageRole): PhotoSize {
	return fittedSize(natural, photoTargets[role].longEdge);
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

// Draws and encodes the photo at the role's size and quality, then tries again while it is over the
// role's byte budget, as PhotoTarget describes, drawing it again only at a new size.
export async function encodeWithinBudget(
	role: RecipeImageRole,
	natural: PhotoSize,
	canvas: PhotoCanvas
): Promise<EncodedPhoto> {
	const { quality, byteBudget } = photoTargets[role];
	const size = normalizedPhotoSize(natural, role);
	await canvas.draw(size);
	let encoded: EncodedPhoto = { ...size, jpeg: await canvas.encode(quality) };
	if (byteBudget === undefined) {
		return encoded;
	}
	const { maxBytes, lowerQualities, smallerLongEdges } = byteBudget;
	for (const lowerQuality of lowerQualities) {
		if (encoded.jpeg.size <= maxBytes) {
			break;
		}
		encoded = { ...size, jpeg: await canvas.encode(lowerQuality) };
	}
	const lowestQuality = lowerQualities.at(-1) ?? quality;
	// A photo is never enlarged, so one already smaller skips the long edges above its own.
	const smallerSizes = smallerLongEdges
		.filter((longEdge) => longEdge < Math.max(size.width, size.height))
		.map((longEdge) => fittedSize(size, longEdge));
	for (const smallerSize of smallerSizes) {
		if (encoded.jpeg.size <= maxBytes) {
			break;
		}
		await canvas.draw(smallerSize);
		encoded = { ...smallerSize, jpeg: await canvas.encode(lowestQuality) };
	}
	return encoded;
}

// Draws the photo over white on the context's canvas, resized to the size. Every size is resampled
// from the decoded photo, so a smaller scan is as sharp as one first drawn at that size.
async function drawPhoto(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	size: PhotoSize
): Promise<void> {
	const bitmap = await createImageBitmap(image, {
		resizeWidth: size.width,
		resizeHeight: size.height,
		resizeQuality: 'high',
	});
	try {
		// Resizing the canvas clears it and resets the context's state, fill style included.
		context.canvas.width = size.width;
		context.canvas.height = size.height;
		context.fillStyle = jpegBackground;
		context.fillRect(0, 0, size.width, size.height);
		context.drawImage(bitmap, 0, 0);
	} finally {
		bitmap.close();
	}
}

// Draws and encodes the photo on one canvas.
async function resizedJpeg(image: HTMLImageElement, role: RecipeImageRole): Promise<EncodedPhoto> {
	const canvas = document.createElement('canvas');
	try {
		const context = canvas.getContext('2d', { colorSpace: 'srgb' });
		if (context === null) {
			throw new Error('Canvas has no 2D context');
		}
		return await encodeWithinBudget(
			role,
			{ width: image.naturalWidth, height: image.naturalHeight },
			{
				draw: (size) => drawPhoto(context, image, size),
				encode: (quality) => canvasJpeg(canvas, quality),
			}
		);
	} finally {
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
		const { jpeg, ...size } = await resizedJpeg(image, role);
		return { file: new File([jpeg], jpegFileName(file.name), { type: 'image/jpeg' }), ...size };
	} finally {
		URL.revokeObjectURL(url);
	}
}
