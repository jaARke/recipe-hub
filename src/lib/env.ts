import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']),
	// Set by Vercel on deployments; absent when running Next.js directly.
	VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
	// Set by Vercel on every deployment, previews included: the production host, without a scheme.
	VERCEL_PROJECT_PRODUCTION_URL: z.hostname().optional(),
	// Set by Vercel on every deployment; its image optimizer pins source requests to it with `dpl`.
	VERCEL_DEPLOYMENT_ID: z.string().min(1).optional(),
	// Pooled connection for the app; migrations use the unpooled URL through drizzle.config.ts.
	DATABASE_URL: z.url(),
	// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
	BLOB_STORE_ID: z.string().min(1),
});

export const env = envSchema.parse(process.env);

// The base for absolute URLs in metadata: production on every deployment, else the dev server.
export const siteUrl = new URL(
	env.VERCEL_PROJECT_PRODUCTION_URL === undefined
		? 'http://localhost:3000'
		: `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
);
