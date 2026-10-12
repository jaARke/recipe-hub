import { PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { recipeTextStyles } from '@/components/recipe/recipe-detail';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import { recipeEditPath } from '@/components/recipe/recipe-paths';
import { RecipeScanImage } from '@/components/recipe/recipe-photo';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RecipeImage } from '@/domain/recipe/recipe-image';

// For RecipeDetail's title action, which reserves its box on every recipe page.
function RecipeEditLink({ slug }: { slug: string }) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						href={recipeEditPath(slug)}
						aria-label="Edit recipe"
						className={buttonVariants({ variant: 'outline', size: 'icon' })}
					/>
				}
			>
				<PencilIcon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent>Edit recipe</TooltipContent>
		</Tooltip>
	);
}

// The photos of the recipe as first written, for members; each opens the viewer at its page. Left off
// the printout like the dish photos.
function RecipeScans({ scans }: { scans: readonly RecipeImage[] }) {
	const title = 'Original recipe';

	return (
		<section
			aria-labelledby="original-recipe-heading"
			className="mt-10 flex flex-col gap-6 print:hidden"
		>
			<h2 id="original-recipe-heading" className={recipeTextStyles.section}>
				{title}
			</h2>
			<RecipeImageViewer role="scan" title={title} images={scans}>
				<ul className="grid gap-4 sm:grid-cols-2">
					{scans.map((scan, index) => (
						<li key={scan.pathname}>
							{/* The button is named for its page, so the scan inside it is decorative. */}
							<RecipeImageViewerTrigger index={index} className="w-full rounded-xl">
								<RecipeScanImage
									pathname={scan.pathname}
									alt=""
									loading="lazy"
									className="aspect-3/4"
								/>
							</RecipeImageViewerTrigger>
						</li>
					))}
				</ul>
			</RecipeImageViewer>
		</section>
	);
}

export { RecipeEditLink, RecipeScans };
