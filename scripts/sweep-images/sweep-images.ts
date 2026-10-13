import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import type { Actor, ActorProvider } from '@/application/ports/actor-provider';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { developmentImageEnvironment } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';

const logger = getLogger('sweep-images');

// Sweeping images is a system use case that never asks who is calling.
class SweepActorProvider implements ActorProvider {
	async currentActor(): Promise<Actor> {
		return { kind: 'anonymous' };
	}
}

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
nextEnv.loadEnvConfig(process.cwd());

const env = z
	.object({
		// The sweep takes a direct connection, as migrations do, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
		// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
		BLOB_STORE_ID: z.string().min(1),
		// Set by Vercel on deployments; absent locally.
		VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
	})
	.parse(process.env);

// Deployments sweep through their own route, production's on a cron; this sweeps development's folders
// against the development database only.
if (env.VERCEL_ENV !== undefined) {
	logger.error('Image sweep refused outside local development', { vercelEnv: env.VERCEL_ENV });
	process.exitCode = 1;
} else {
	const pool = new Pool({ connectionString: pinFullSslVerification(env.DATABASE_URL_UNPOOLED) });
	try {
		const db = drizzle({ client: pool });
		const folders = new ImageFolders(developmentImageEnvironment);
		const images = new RecipeImageService(
			new DrizzleRecipeRepository(db),
			new DrizzleRecipeImportRepository(db),
			new BlobImageStore({ storeId: env.BLOB_STORE_ID, folders }),
			new SweepActorProvider(),
			folders
		);
		await images.sweepImages();
	} catch (err) {
		logger.error('Image sweep failed', { err });
		process.exitCode = 1;
	} finally {
		await pool.end();
	}
}
