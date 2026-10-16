import { parseArgs } from 'node:util';
import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { ImageFolders } from '@/application/recipes/image-folders';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { developmentImageEnvironment } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';
import { backfillImageSizes, backfillReport } from './backfill';
import { DrizzleImageRecordStore } from './image-records';
import { storedImageSizeReader } from './image-sizes';

const logger = getLogger('backfill-image-sizes');

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
// It never replaces a variable already set, so tsx's --env-file can point the run at another database.
nextEnv.loadEnvConfig(process.cwd());

const env = z
	.object({
		// The backfill takes a direct connection, as migrations do, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
		// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
		BLOB_STORE_ID: z.string().min(1),
	})
	.parse(process.env);

const { values: options } = parseArgs({
	options: {
		// Without it, a dry run that writes nothing.
		write: { type: 'boolean', default: false },
	},
});

// The backfill only reads images, which every folder allows, so the folders, which bound moves and
// deletes, are never used.
const images = new BlobImageStore({
	storeId: env.BLOB_STORE_ID,
	folders: new ImageFolders(developmentImageEnvironment),
});

const connectionString = pinFullSslVerification(env.DATABASE_URL_UNPOOLED);
const pool = new Pool({ connectionString });
try {
	// The host tells production's database from develop's before anything is read.
	logger.info('Image size backfill started', {
		write: options.write,
		databaseHost: new URL(connectionString).hostname,
	});
	const result = await backfillImageSizes(
		new DrizzleImageRecordStore(drizzle({ client: pool })),
		storedImageSizeReader(images),
		{ write: options.write }
	);
	process.stdout.write(`${backfillReport(result)}\n`);
} catch (err) {
	logger.error('Image size backfill failed', { err });
	process.exitCode = 1;
} finally {
	await pool.end();
}
