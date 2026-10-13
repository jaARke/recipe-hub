import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import type { Actor, ActorProvider, MemberActor } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type { MemberRepository, NewMember } from '@/application/ports/member-repository';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeService } from '@/application/recipes/recipe-service';
import type { Member } from '@/domain/member/member';
import { sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { seedImageEnvironment } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';

// A sample's photo is stored here under the file name its pathname ends with.
const photosFolder = path.join(import.meta.dirname, 'photos');

// Every seed photo is a JPEG, as scripts/seed/photos/SOURCES.md lists.
const photoContentType = 'image/jpeg';

// Every sample's contributor. No one signs in as it: its address can never receive a code.
const sampleContributor: NewMember = {
	email: 'sample-contributor@recipes.invalid',
	displayName: 'Sample contributor',
	role: 'member',
};

// Two builds of one pull request can seed its branch at once; the lock makes the later one wait, then skip.
const seedLockKey = 'recipe-hub:seed';

const logger = getLogger('seed');

class SeedActorProvider implements ActorProvider {
	private readonly actor: MemberActor;

	constructor(contributor: Member) {
		this.actor = { kind: 'member', memberId: contributor.id, role: contributor.role };
	}

	async currentActor(): Promise<Actor> {
		return this.actor;
	}
}

async function findOrCreateSampleContributor(members: MemberRepository): Promise<Member> {
	const existing = await members.findByEmail(sampleContributor.email);
	if (existing !== null) {
		return existing;
	}

	const created = await members.create(sampleContributor);
	logger.info('Sample contributor created', { memberId: created.id });
	return created;
}

async function withSeedLock(pool: Pool, run: () => Promise<void>): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query('select pg_advisory_lock(hashtext($1))', [seedLockKey]);
		await run();
	} finally {
		// Closing the connection releases its session lock.
		client.release(true);
	}
}

async function seed(recipes: RecipeService, images: ImageStore): Promise<void> {
	let recipesCreated = 0;
	let recipesSkipped = 0;
	let photosUploaded = 0;

	// The list shows the newest first, so inserting in reverse keeps the samples' order.
	for (const content of sampleRecipeContents.toReversed()) {
		const slug = slugify(content.title);
		if ((await recipes.getRecipe(slug)) !== null) {
			logger.info('Seed recipe skipped', { slug });
			recipesSkipped += 1;
			continue;
		}

		// Photos go first, so a seeded recipe never points at a missing photo.
		for (const { pathname } of content.images) {
			if (await images.has(pathname)) {
				continue;
			}

			const body = await readFile(path.join(photosFolder, path.basename(pathname)));
			await images.put(pathname, body, photoContentType);
			logger.info('Seed photo uploaded', { pathname });
			photosUploaded += 1;
		}

		await recipes.createRecipe({ content });
		recipesCreated += 1;
	}

	logger.info('Seeding finished', { recipesCreated, recipesSkipped, photosUploaded });
}

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
nextEnv.loadEnvConfig(process.cwd());

const env = z
	.object({
		// Seeding takes a direct connection, as migrations do, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
		// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
		BLOB_STORE_ID: z.string().min(1),
		// Set by Vercel on deployments; absent locally.
		VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
	})
	.parse(process.env);

// Production never holds synthetic recipes.
if (env.VERCEL_ENV === 'production') {
	logger.info('Seeding skipped in production');
} else {
	const pool = new Pool({ connectionString: pinFullSslVerification(env.DATABASE_URL_UNPOOLED) });
	try {
		await withSeedLock(pool, async () => {
			const db = drizzle({ client: pool });
			const members = new DrizzleMemberRepository(db);
			const contributor = await findOrCreateSampleContributor(members);
			const folders = new ImageFolders(seedImageEnvironment);
			const images = new BlobImageStore({ storeId: env.BLOB_STORE_ID, folders });
			await seed(
				new RecipeService(
					new DrizzleRecipeRepository(db),
					new DrizzleRecipeImportRepository(db),
					members,
					images,
					new SeedActorProvider(contributor),
					folders
				),
				images
			);
		});
	} catch (err) {
		logger.error('Seeding failed', { err });
		process.exitCode = 1;
	} finally {
		await pool.end();
	}
}
