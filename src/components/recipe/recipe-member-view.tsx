import { PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { recipeEditPath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

export { RecipeEditLink };
