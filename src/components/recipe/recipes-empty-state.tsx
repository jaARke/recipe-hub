import { CookingPotIcon } from 'lucide-react';
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
				<EmptyMedia variant="icon">
					<CookingPotIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No recipes yet</EmptyTitle>
				<EmptyDescription>Recipes will show up here once they are added.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export { RecipesEmptyState };
