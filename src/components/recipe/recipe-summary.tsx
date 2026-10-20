import { cn } from 'cn';
import { CookingPotIcon } from 'lucide-react';
import Link from 'next/link';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import { RecipePhoto } from '@/components/recipe/recipe-photo';
import { Badge } from '@/components/ui/badge';
import { dietLabels } from '@/domain/recipe/diet';
import { formatDuration } from '@/domain/recipe/duration';
import { holidayLabels } from '@/domain/recipe/holiday';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { formatYield } from '@/domain/recipe/recipe-yield';

type RecipeFact = {
	label: string;
	value: string;
};

// A badge naming one of a recipe's holidays or diets, linked to the list it filters where given.
type RecipeBadge = {
	label: string;
	href?: string;
};

function recipeFacts({
	totalMinutes,
	yield: recipeYield,
}: Pick<RecipeSummaryDto, 'totalMinutes' | 'yield'>): RecipeFact[] {
	const facts: RecipeFact[] = [];
	if (totalMinutes !== undefined) {
		facts.push({ label: 'Total time', value: formatDuration(totalMinutes) });
	}
	if (recipeYield !== undefined) {
		facts.push({ label: 'Yield', value: formatYield(recipeYield) });
	}
	return facts;
}

// A card's or a result row's badges: the recipe's holidays, then its diets. The card or row is a link
// itself, so its badges are not.
function recipeBadges({
	holidays,
	diets,
}: Pick<RecipeSummaryDto, 'holidays' | 'diets'>): RecipeBadge[] {
	return [
		...holidays.map((holiday) => ({ label: holidayLabels[holiday] })),
		...diets.map((diet) => ({ label: dietLabels[diet] })),
	];
}

function RecipeCover({
	image,
	sizes,
	eager = false,
	className,
}: {
	image: RecipeImage | undefined;
	// The rendered width at each breakpoint, as RecipePhoto takes it.
	sizes: string;
	eager?: boolean;
	// Sets the box's width and rounding; the box is always 4:3.
	className?: string;
}) {
	if (image === undefined) {
		return (
			// The same box without a photo, so every card and row lines up.
			<div
				className={cn(
					'flex aspect-4/3 items-center justify-center bg-muted text-muted-foreground',
					className
				)}
			>
				<CookingPotIcon className="size-8" aria-hidden="true" />
			</div>
		);
	}

	return (
		<RecipePhoto
			pathname={image.pathname}
			// Decorative, so the link around it is named by the recipe's title alone.
			alt=""
			sizes={sizes}
			loading={eager ? 'eager' : 'lazy'}
			className={cn('aspect-4/3', className)}
		/>
	);
}

function RecipeFacts({ facts }: { facts: readonly RecipeFact[] }) {
	return (
		<dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium wrap-anywhere text-muted-foreground">
			{facts.map((fact) => (
				<div key={fact.label}>
					<dt className="sr-only">{fact.label}</dt>
					<dd>{fact.value}</dd>
				</div>
			))}
		</dl>
	);
}

function RecipeBadges({ badges }: { badges: readonly RecipeBadge[] }) {
	return (
		<ul role="list" className="flex flex-wrap gap-1.5">
			{badges.map(({ label, href }) => (
				<li key={label}>
					<Badge
						variant="secondary"
						wrap
						render={href === undefined ? undefined : <Link href={href} />}
					>
						{label}
					</Badge>
				</li>
			))}
		</ul>
	);
}

export { RecipeBadges, recipeBadges, RecipeCover, RecipeFacts, recipeFacts };
