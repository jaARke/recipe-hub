import nextEnv from '@next/env';
import { lt } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import type { Actor, ActorProvider, MemberActor } from '@/application/ports/actor-provider';
import type { MemberRepository, NewMember } from '@/application/ports/member-repository';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeService } from '@/application/recipes/recipe-service';
import type { Member } from '@/domain/member/member';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleSavedDraftRepository } from '@/infrastructure/db/drizzle-saved-draft-repository';
import { poolDeadlines } from '@/infrastructure/db/pool-deadlines';
import { rateLimits, sessions, verifications } from '@/infrastructure/db/schema';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { seedImageEnvironment } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';
import {
	guardProductionDatabase,
	productionDatabaseGuardEnvSchema,
} from '@/lib/production-database-guard';
import { seedSamples } from './seed-samples';

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
		this.actor = {
			kind: 'member',
			memberId: contributor.id,
			role: contributor.role,
			sessionStartedAt: new Date(),
		};
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

// A preview's branch starts as a copy of production, live sessions included. The branch's first seed
// created the sample contributor, so every sign-in row older than it came from production.
async function deleteCopiedSignInRows(db: NodePgDatabase, firstSeedAt: Date): Promise<void> {
	const sessionsDeleted = await db.delete(sessions).where(lt(sessions.createdAt, firstSeedAt));
	const verificationsDeleted = await db
		.delete(verifications)
		.where(lt(verifications.createdAt, firstSeedAt));
	const rateLimitsDeleted = await db
		.delete(rateLimits)
		.where(lt(rateLimits.lastRequest, firstSeedAt.getTime()));
	logger.info('Copied sign-in rows deleted', {
		sessions: sessionsDeleted.rowCount,
		verifications: verificationsDeleted.rowCount,
		rateLimits: rateLimitsDeleted.rowCount,
	});
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

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
nextEnv.loadEnvConfig(process.cwd());

const env = z
	.object({
		// Seeding takes a direct connection, as migrations do, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
		// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
		BLOB_STORE_ID: z.string().min(1),
		...productionDatabaseGuardEnvSchema.shape,
	})
	.parse(process.env);

// Production never holds synthetic recipes.
if (env.VERCEL_ENV === 'production') {
	logger.info('Seeding skipped in production');
} else {
	const connectionString = pinFullSslVerification(env.DATABASE_URL_UNPOOLED);
	guardProductionDatabase(connectionString, env);
	logger.info('Seeding started', { databaseHost: new URL(connectionString).hostname });

	const pool = new Pool({ connectionString, ...poolDeadlines });
	try {
		await withSeedLock(pool, async () => {
			const db = drizzle({ client: pool });
			const members = new DrizzleMemberRepository(db);
			const contributor = await findOrCreateSampleContributor(members);
			if (env.VERCEL_ENV === 'preview') {
				await deleteCopiedSignInRows(db, contributor.createdAt);
			}
			const folders = new ImageFolders(seedImageEnvironment);
			const images = new BlobImageStore({ storeId: env.BLOB_STORE_ID, folders });
			await seedSamples(
				new RecipeService(
					new DrizzleRecipeRepository(db),
					new DrizzleRecipeImportRepository(db),
					new DrizzleSavedDraftRepository(db),
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
