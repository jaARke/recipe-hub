'use client';

import { cn } from 'cn';
import * as React from 'react';
import { imageFit, imageRatioStyle } from '@/components/recipe/recipe-image-shape';
import { showImageLabel } from '@/components/recipe/recipe-image-viewer-labels';
import { ShownRecipeImage, type ShownImage } from '@/components/recipe/shown-recipe-image';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

// Each thumbnail is h-12 in its own shape, a very wide one capped at w-30 and cropped to it.
const thumbnailSizes = '120px';

// A thumbnail of every image, each in its own shape, showing the image it names; the current one is
// marked.
function RecipeImageStrip({
	role,
	images,
	current,
	onSelect,
	className,
}: {
	role: RecipeImageRole;
	images: readonly ShownImage[];
	current: number;
	onSelect: (index: number) => void;
	className?: string;
}) {
	const currentRef = React.useRef<HTMLButtonElement>(null);

	// The current thumbnail stays in view as the images change.
	React.useEffect(() => {
		currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}, [current]);

	return (
		// Padded so a thumbnail's focus ring and mark show inside the scrolling row.
		<ul
			role="list"
			className={cn('flex [scrollbar-width:thin] gap-2 overflow-x-auto p-1', className)}
		>
			{images.map((image, index) => {
				const isCurrent = index === current;
				return (
					<li key={image.pathname} className="shrink-0">
						<button
							ref={isCurrent ? currentRef : undefined}
							type="button"
							aria-label={showImageLabel(role, index, images.length)}
							aria-current={isCurrent ? 'true' : undefined}
							onClick={() => onSelect(index)}
							style={imageRatioStyle(image.size)}
							className={cn(
								'block aspect-(--image-ratio) h-12 max-w-30 overflow-hidden rounded-md transition-opacity',
								isCurrent
									? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
									: 'opacity-60 hover:opacity-100'
							)}
						>
							<ShownRecipeImage
								image={image}
								alt=""
								sizes={thumbnailSizes}
								loading="lazy"
								fit={imageFit(image.size)}
								className="size-full"
							/>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

export { RecipeImageStrip };
