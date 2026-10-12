import { cn } from 'cn';
import { CookingPotIcon } from 'lucide-react';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import { RecipePhoto } from '@/components/recipe/recipe-photo';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/domain/recipe/duration';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { formatYield } from '@/domain/recipe/recipe-yield';

type RecipeFact = {
	label: string;
	value: string;
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

// The ids of the parts that rendered, for a link's aria-describedby.
function describedByIds(...ids: (string | undefined)[]): string | undefined {
	const renderedIds = ids.filter((id) => id !== undefined);
	return renderedIds.length > 0 ? renderedIds.join(' ') : undefined;
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
		<dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tracking-wide text-muted-foreground uppercase">
			{facts.map((fact) => (
				<div key={fact.label}>
					<dt className="sr-only">{fact.label}</dt>
					<dd>{fact.value}</dd>
				</div>
			))}
		</dl>
	);
}

function RecipeTags({ tags }: { tags: readonly string[] }) {
	return (
		<ul className="flex flex-wrap gap-1.5">
			{tags.map((tag) => (
				<li key={tag}>
					<Badge variant="secondary">{tag}</Badge>
				</li>
			))}
		</ul>
	);
}

export { describedByIds, RecipeCover, RecipeFacts, recipeFacts, RecipeTags };
