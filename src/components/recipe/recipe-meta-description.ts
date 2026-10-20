import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { formatDuration, totalMinutes } from '@/domain/recipe/duration';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { formatYield } from '@/domain/recipe/recipe-yield';
import { andList } from '@/domain/text';

type DescribedRecipe = Pick<
	PublicRecipeDto,
	'description' | 'source' | 'yield' | 'times' | 'ingredientSections'
>;

// Enough to suggest the dish without listing the whole recipe.
const describedIngredientCount = 3;

// The first few ingredients, each once as first written, ending in "more" when there are others.
function ingredientList(sections: readonly IngredientSection[]): string {
	const itemsByKey = new Map<string, string>();
	for (const { item } of sections.flatMap((section) => section.lines)) {
		const key = item.toLocaleLowerCase('en-US');
		if (!itemsByKey.has(key)) {
			itemsByKey.set(key, item);
		}
	}

	const items = [...itemsByKey.values()];
	const described = items.slice(0, describedIngredientCount);
	return andList(items.length > described.length ? [...described, 'more'] : described);
}

// For link previews and search results: the recipe's own description, or a few of its facts.
export function recipeMetaDescription(recipe: DescribedRecipe): string {
	if (recipe.description !== undefined) {
		return recipe.description;
	}

	const total = totalMinutes(recipe.times);
	const sentences = [
		recipe.source === undefined ? undefined : `From ${recipe.source}.`,
		recipe.yield === undefined ? undefined : `${formatYield(recipe.yield)}.`,
		total === undefined ? undefined : `Ready in ${formatDuration(total)}.`,
		`Made with ${ingredientList(recipe.ingredientSections)}.`,
	];
	return sentences.filter((sentence) => sentence !== undefined).join(' ');
}
