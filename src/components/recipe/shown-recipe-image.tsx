'use client';

import { cn } from 'cn';
import { ExternalLinkIcon } from 'lucide-react';
import * as React from 'react';
import { recipeImageSrc } from '@/components/recipe/recipe-paths';
import {
	photoFitClasses,
	RecipePhoto,
	type RecipePhotoProps,
} from '@/components/recipe/recipe-photo';
import { buttonVariants } from '@/components/ui/button';
import type { RecipeImage } from '@/domain/recipe/recipe-image';

// A stored image, or one the member chose in the recipe form and uploaded but hasn't saved, which
// shows from its file, so the browser never downloads what it already holds. Its size, where it has
// one, lays it out in its own shape.
export type ShownImage = Pick<RecipeImage, 'pathname' | 'alt' | 'size'> & { file?: File };

// Points the element's attribute at the file, when there is one. The URL is made here rather than on
// choosing, so it is revoked whenever the element unmounts or its page is hidden, and made again when
// it shows.
function useFileUrl<Element extends HTMLElement>(
	file: File | undefined,
	attribute: 'src' | 'href'
): React.RefObject<Element | null> {
	const ref = React.useRef<Element>(null);

	React.useEffect(() => {
		const element = ref.current;
		if (element === null || file === undefined) {
			return;
		}
		const url = URL.createObjectURL(file);
		element.setAttribute(attribute, url);
		return () => URL.revokeObjectURL(url);
	}, [file, attribute]);

	return ref;
}

type LocalPhotoProps = Pick<RecipePhotoProps, 'alt' | 'fit' | 'className'> & { file: File };

// A photo chosen on this device, from its file.
function LocalPhoto({ file, alt, fit = 'cover', className }: LocalPhotoProps) {
	const imageRef = useFileUrl<HTMLImageElement>(file, 'src');

	return (
		<span className={cn('block overflow-hidden bg-muted', className)}>
			{/* next/image needs its source at render time; this one is made and revoked in the effect. */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img ref={imageRef} alt={alt} className={cn('size-full', photoFitClasses[fit])} />
		</span>
	);
}

type ShownRecipeImageProps = Pick<
	RecipePhotoProps,
	'alt' | 'sizes' | 'fit' | 'loading' | 'className'
> & {
	image: ShownImage;
};

// The stored image through the optimizer, or the one from its file until the recipe is saved.
function ShownRecipeImage({ image, alt, sizes, fit, loading, className }: ShownRecipeImageProps) {
	if (image.file !== undefined) {
		return <LocalPhoto file={image.file} alt={alt} fit={fit} className={className} />;
	}
	return (
		<RecipePhoto
			pathname={image.pathname}
			alt={alt}
			sizes={sizes}
			fit={fit}
			loading={loading}
			className={className}
		/>
	);
}

// Full size, an outline button that opens the image by itself in a new tab: the stored one, or the
// file until the recipe is saved.
function FullSizeImageLink({ image, className }: { image: ShownImage; className?: string }) {
	const linkRef = useFileUrl<HTMLAnchorElement>(image.file, 'href');

	return (
		<a
			ref={linkRef}
			// A file's URL is made in the effect, as a local photo's is.
			href={image.file === undefined ? recipeImageSrc(image.pathname) : undefined}
			target="_blank"
			// Named outright, since browsers read the name from a flex row's parts with a space before the
			// comma; it opens with the visible text, so speech input still finds it.
			aria-label="Full size, opens in a new tab"
			className={buttonVariants({ variant: 'outline', size: 'sm', className })}
		>
			Full size
			<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" />
		</a>
	);
}

export { FullSizeImageLink, LocalPhoto, ShownRecipeImage };
