import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { MemberService } from '@/application/members/member-service';
import type { Actor, ActorProvider } from '@/application/ports/actor-provider';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger('bootstrap');

// Making the first admin is a system use case that never asks who is calling.
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
		// The address whose account becomes the first admin; without it the bootstrap does nothing.
		ADMIN_EMAIL: z.email().optional(),
	})
	.parse(process.env);

if (env.ADMIN_EMAIL === undefined) {
	logger.info('Admin bootstrap skipped without an admin email');
} else {
	const pool = new Pool({ connectionString: pinFullSslVerification(env.DATABASE_URL_UNPOOLED) });
	try {
		const members = new MemberService(
			new DrizzleMemberRepository(drizzle({ client: pool })),
			new BootstrapActorProvider()
		);
		await members.ensureAdmin(env.ADMIN_EMAIL);
	} catch (err) {
		logger.error('Admin bootstrap failed', { err });
		process.exitCode = 1;
	} finally {
		await pool.end();
	}
}
