import type { CSSProperties } from 'react';
import type { RecipePhotoProps } from '@/components/recipe/recipe-photo';
import type { ImageSize } from '@/domain/recipe/recipe-image';

// An image stored before sizes were recorded takes a 3:2 box, the shape of most dish photos.
const unsizedImageShape: ImageSize = { width: 3, height: 2 };

// A box sized by its image's shape: aspect-(--image-ratio), and widths multiplied by it.
type ImageRatioStyle = CSSProperties & { '--image-ratio': string };

// The shape an image is laid out in: its stored size, or 3:2 without one.
export function imageShape(size: ImageSize | undefined): ImageSize {
	return size ?? unsizedImageShape;
}

// The image's shape as CSS writes a ratio, "1600 / 1066", which a length can also be multiplied by.
export function imageRatioStyle(size: ImageSize | undefined): ImageRatioStyle {
	const { width, height } = imageShape(size);
	return { '--image-ratio': `${width} / ${height}` };
}

// In a box of its own shape an image fills it; an unsized one shows whole in its 3:2 box.
export function imageFit(size: ImageSize | undefined): NonNullable<RecipePhotoProps['fit']> {
	return size === undefined ? 'contain' : 'cover';
}
