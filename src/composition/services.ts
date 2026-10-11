import 'server-only';
import { RecipeService } from '@/application/recipes/recipe-service';
import { AnonymousActorProvider } from '@/infrastructure/auth/anonymous-actor-provider';
import { db } from '@/infrastructure/db/client';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';

const actors = new AnonymousActorProvider();

export function getRecipeService(): RecipeService {
	return new RecipeService(new DrizzleRecipeRepository(db), actors);
}
