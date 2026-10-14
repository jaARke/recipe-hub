import { cn } from 'cn';
import Image, { type ImageProps } from 'next/image';
import { recipeImageSrc } from '@/components/recipe/recipe-paths';

// Cover fills the box and crops the photo; contain shows all of it, letterboxed.
const photoFitClasses = {
	cover: 'object-cover',
	contain: 'object-contain',
} as const;

type RecipePhotoProps = Pick<ImageProps, 'preload' | 'loading'> & {
	pathname: string;
	// Set by the caller, which knows whether nearby text already names the photo.
	alt: string;
	// The rendered width at each breakpoint, so the browser picks the right size from the srcset.
	sizes: string;
	fit?: keyof typeof photoFitClasses;
	// Sets the box's aspect ratio.
	className: string;
};

type RecipeScanImageProps = Pick<
	RecipePhotoProps,
	'pathname' | 'alt' | 'loading' | 'fit' | 'className'
>;

// Each box is a span, so a photo can sit inside a button.
function RecipePhoto({
	pathname,
	alt,
	sizes,
	preload,
	loading,
	fit = 'cover',
	className,
}: RecipePhotoProps) {
	return (
		<span className={cn('relative block overflow-hidden bg-muted', className)}>
			<Image
				src={recipeImageSrc(pathname)}
				alt={alt}
				fill
				sizes={sizes}
				preload={preload}
				loading={loading}
				className={photoFitClasses[fit]}
			/>
		</span>
	);
}

// A scan, shown whole unless a thumbnail crops it. The image optimizer would cache a members-only scan
// publicly, so it gets the original.
function RecipeScanImage({
	pathname,
	alt,
	loading,
	fit = 'contain',
	className,
}: RecipeScanImageProps) {
	return (
		<span className={cn('block overflow-hidden bg-muted', className)}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={recipeImageSrc(pathname)}
				alt={alt}
				loading={loading}
				decoding="async"
				className={cn('size-full', photoFitClasses[fit])}
			/>
		</span>
	);
}

export { photoFitClasses, RecipePhoto, RecipeScanImage, type RecipePhotoProps };
