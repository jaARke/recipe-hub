import { cn } from 'cn';
import type { CookingRecipe } from '@/components/cooking/cooking-screens';
import type { RecipeScale } from '@/components/cooking/use-cooking-url';
import { RecipeIngredientsAndSteps } from '@/components/recipe/recipe-ingredients-and-steps';
import { RecipeParagraphs } from '@/components/recipe/recipe-paragraphs';
import { recipeTextStyles } from '@/components/recipe/recipe-text-styles';
import { formatScaledToLine } from '@/domain/recipe/recipe-yield';

// The whole recipe at the cook's scale, which prints from any screen in place of the view: its
// title, what a scaled recipe was scaled to, the ingredients by section, the steps, and the notes.
// The screen never shows it.
function CookingPrintout({ recipe, scale }: { recipe: CookingRecipe; scale: RecipeScale }) {
	return (
		<article className="hidden flex-col gap-10 print:flex">
			<header className="flex flex-col gap-4">
				<h1 className={recipeTextStyles.title}>{recipe.title}</h1>
				{scale.factor !== 1 && (
					<p className={recipeTextStyles.supporting}>
						{formatScaledToLine(scale.recipeYield, scale.factor)}
					</p>
				)}
			</header>
			<RecipeIngredientsAndSteps
				ingredientSections={recipe.ingredientSections}
				instructionSections={recipe.instructionSections}
				headingLevel={1}
				scale={scale}
			/>
			{recipe.notes !== undefined && (
				<div className="flex flex-col gap-6">
					<h2 className={recipeTextStyles.section}>Notes</h2>
					<RecipeParagraphs text={recipe.notes} className={cn(recipeTextStyles.body, 'gap-4')} />
				</div>
			)}
		</article>
	);
}

export { CookingPrintout };
