import 'server-only';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { RecipeService } from '@/application/recipes/recipe-service';
import { AnonymousActorProvider } from '@/infrastructure/auth/anonymous-actor-provider';
import { db } from '@/infrastructure/db/client';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { env } from '@/lib/env';

const actors = new AnonymousActorProvider();

export function getRecipeService(): RecipeService {
	return new RecipeService(new DrizzleRecipeRepository(db), actors);
}

export function getRecipeImageService(): RecipeImageService {
	return new RecipeImageService(new BlobImageStore({ storeId: env.BLOB_STORE_ID }));
}
