import 'server-only';
import { asc, desc, type SQL } from 'drizzle-orm';
import type { RecipeSort } from '@/application/ports/recipe-repository';
import { recipes } from '@/infrastructure/db/schema';

// Each order ends with the id, so recipes that tie keep one order across pages.
export const recipeOrders: Record<RecipeSort, SQL[]> = {
	newest: [desc(recipes.createdAt), desc(recipes.id)],
	title: [asc(recipes.titleSort), asc(recipes.id)],
};
