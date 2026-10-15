'use client';

import { useRecipeScale } from '@/components/recipe/recipe-scale-provider';
import { formatScaledYield, type RecipeYield } from '@/domain/recipe/recipe-yield';

// The yield in a recipe's header, at the scale its stepper holds. The server renders it at the
// recipe's own scale, as its JSON-LD and description give it, so the cached page holds no scale.
function RecipeScaledYield({ recipeYield }: { recipeYield: RecipeYield }) {
	const scale = useRecipeScale();
	return formatScaledYield(recipeYield, scale?.factor ?? 1);
}

export { RecipeScaledYield };
