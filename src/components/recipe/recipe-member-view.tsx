import { PencilIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { recipeTextStyles } from '@/components/recipe/recipe-detail';
import { recipeEditPath, recipeImageSrc } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import type { RecipeImage } from '@/domain/recipe/recipe-image';

// Holds the edit link's row on every recipe page, so nothing moves when it streams in for a member.
function RecipeEditLinkFrame({ children }: { children?: React.ReactNode }) {
	return <div className="mb-2 flex h-8 justify-end sm:mb-4 print:hidden">{children}</div>;
}

function RecipeEditLink({ slug }: { slug: string }) {
	return (
		<Link
			href={recipeEditPath(slug)}
			className={buttonVariants({ variant: 'outline', size: 'sm' })}
		>
			<PencilIcon data-icon="inline-start" aria-hidden="true" />
			Edit recipe
		</Link>
	);
}

function scanAlt(index: number, count: number): string {
	return count === 1 ? 'Original recipe' : `Original recipe, page ${index + 1} of ${count}`;
}

// The photos of the recipe as first written, for members; each opens at full size. Left off the
// printout like the cover photo.
function RecipeScans({ scans }: { scans: readonly RecipeImage[] }) {
	return (
		<section
			aria-labelledby="original-recipe-heading"
			className="mt-10 flex flex-col gap-6 print:hidden"
		>
			<h2 id="original-recipe-heading" className={recipeTextStyles.section}>
				Original recipe
			</h2>
			<ul className="grid gap-4 sm:grid-cols-2">
				{scans.map((scan, index) => (
					<li key={scan.pathname}>
						<a
							href={recipeImageSrc(scan.pathname)}
							className="block overflow-hidden rounded-xl bg-muted transition-shadow hover:shadow-md"
						>
							{/* The image optimizer would cache a members-only scan publicly, so it gets the original. */}
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={recipeImageSrc(scan.pathname)}
								alt={scanAlt(index, scans.length)}
								loading="lazy"
								decoding="async"
								className="aspect-3/4 w-full object-contain"
							/>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

export { RecipeEditLink, RecipeEditLinkFrame, RecipeScans };
