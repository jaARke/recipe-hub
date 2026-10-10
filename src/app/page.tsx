import { PageContainer } from '@/components/layout/page-container';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';

export default function Home() {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Recipes</h1>
			<RecipesEmptyState />
		</PageContainer>
	);
}
