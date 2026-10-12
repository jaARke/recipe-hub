import { cn } from 'cn';
import Image, { type ImageProps } from 'next/image';
import { recipeImageSrc } from '@/components/recipe/recipe-paths';

type RecipePhotoProps = Pick<ImageProps, 'preload' | 'loading'> & {
	pathname: string;
	// Set by the caller, which knows whether nearby text already names the photo.
	alt: string;
	// The rendered width at each breakpoint, so the browser picks the right size from the srcset.
	sizes: string;
	// Sets the box's aspect ratio, which the photo covers.
	className: string;
};

function RecipePhoto({ pathname, alt, sizes, preload, loading, className }: RecipePhotoProps) {
	return (
		<div className={cn('relative overflow-hidden bg-muted', className)}>
			<Image
				src={recipeImageSrc(pathname)}
				alt={alt}
				fill
				sizes={sizes}
				preload={preload}
				loading={loading}
				className="object-cover"
			/>
		</div>
	);
}

export { RecipePhoto };
