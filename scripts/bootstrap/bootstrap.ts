import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { MemberService } from '@/application/members/member-service';
import type { Actor, ActorProvider } from '@/application/ports/actor-provider';
import {
	guardProductionDatabase,
	pinFullSslVerification,
	productionDatabaseGuardEnvSchema,
} from '@/infrastructure/db/connection-string';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger('bootstrap');

// Making the owner an admin is a system use case that never asks who is calling.
class BootstrapActorProvider implements ActorProvider {
	async currentActor(): Promise<Actor> {
		return { kind: 'anonymous' };
	}
}

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
nextEnv.loadEnvConfig(process.cwd());

const env = z
	.object({
		// The bootstrap takes a direct connection, as migrations do, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
		// The owner's address, whose account the bootstrap makes an admin, creating it if needed.
		ADMIN_EMAIL: z.email(),
		...productionDatabaseGuardEnvSchema.shape,
	})
	.parse(process.env);

const connectionString = pinFullSslVerification(env.DATABASE_URL_UNPOOLED);
guardProductionDatabase(connectionString, env);
logger.info('Owner bootstrap started', { databaseHost: new URL(connectionString).hostname });

const pool = new Pool({ connectionString });
try {
	const members = new MemberService(
		new DrizzleMemberRepository(drizzle({ client: pool })),
		new BootstrapActorProvider(),
		env.ADMIN_EMAIL
	);
	await members.ensureOwner();
} catch (err) {
	logger.error('Owner bootstrap failed', { err });
	process.exitCode = 1;
} finally {
	await pool.end();
}
