import Link from 'next/link';
import { Mascot } from '@/components/brand/mascot';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

function FavoritesEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia>
					<Mascot pose="sleeping" size="lg" />
				</EmptyMedia>
				<EmptyTitle>No favorites yet</EmptyTitle>
				<EmptyDescription>
					Select the heart on a recipe to keep it here for the next time you cook it.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				{/* Base UI's Button must not render links, so the link takes the button's look directly. */}
				<Link href={recipeListPath} className={buttonVariants()}>
					Browse recipes
				</Link>
			</EmptyContent>
		</Empty>
	);
}

export { FavoritesEmptyState };
