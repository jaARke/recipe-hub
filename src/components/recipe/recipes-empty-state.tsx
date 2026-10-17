import { Mascot } from '@/components/brand/mascot';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

function RecipesEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia>
					<Mascot pose="sleeping" size="lg" />
				</EmptyMedia>
				<EmptyTitle>No recipes yet</EmptyTitle>
				<EmptyDescription>Recipes will show up here once they are added.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export { RecipesEmptyState };
