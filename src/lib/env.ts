import 'server-only';
import { z } from 'zod';
import { branchFolder } from '@/lib/branch-folder';
import {
	developmentImageEnvironment,
	imageEnvironmentAccess,
	previewImageEnvironmentPrefix,
	productionImageEnvironment,
} from '@/lib/image-paths';
import { productionDatabaseGuardEnvSchema } from '@/lib/production-database-guard';

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'production', 'test']),
		// VERCEL_ENV, and production's Neon endpoint, which the app's pool refuses outside production.
		...productionDatabaseGuardEnvSchema.shape,
		// Set by Vercel on every deployment, previews included: the production host, without a scheme.
		VERCEL_PROJECT_PRODUCTION_URL: z.hostname().optional(),
		// Set by Vercel on every deployment: that deployment's own host, without a scheme.
		VERCEL_URL: z.hostname().optional(),
		// Set by Vercel on Git deployments: the branch's lasting host, without a scheme.
		VERCEL_BRANCH_URL: z.hostname().optional(),
		// Set by Vercel on Git deployments: the branch, which names a preview's image folders.
		VERCEL_GIT_COMMIT_REF: z.string().min(1).optional(),
		// Pooled connection for the app; migrations use the unpooled URL through drizzle.config.ts.
		DATABASE_URL: z.url(),
		// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
		BLOB_STORE_ID: z.string().min(1),
		// Verifies Blob's upload callbacks. None are requested, but the SDK's upload handler needs it.
		BLOB_WEBHOOK_PUBLIC_KEY: z.string().min(1),
		// Signs session cookies and encrypts stored sign-in codes.
		BETTER_AUTH_SECRET: z.string().min(32),
		// Must stay unset: Better Auth reads it itself and would use it in place of BETTER_AUTH_SECRET.
		BETTER_AUTH_SECRETS: z.never().optional(),
		// Must stay unset: Better Auth reads it itself and would trust its origins beyond our hosts.
		BETTER_AUTH_TRUSTED_ORIGINS: z.never().optional(),
		// The owner's address. Their account is always an admin and is never removed.
		ADMIN_EMAIL: z.email(),
		// Resend's key, from the Vercel integration.
		RESEND_API_KEY: z.string().min(1),
		// The verified sending domain, from the Vercel integration; mail comes from an address on it.
		RESEND_EMAIL_DOMAIN: z.hostname(),
		// Vercel sends it as the bearer token of each cron request, which only production receives.
		CRON_SECRET: z.string().min(32).optional(),
	})
	.refine((vars) => vars.VERCEL_ENV !== 'preview' || vars.VERCEL_URL !== undefined, {
		message: 'Vercel sets VERCEL_URL on every preview deployment',
		path: ['VERCEL_URL'],
	})
	.refine((vars) => vars.VERCEL_ENV !== 'preview' || vars.VERCEL_GIT_COMMIT_REF !== undefined, {
		message: 'Vercel sets VERCEL_GIT_COMMIT_REF on every Git deployment',
		path: ['VERCEL_GIT_COMMIT_REF'],
	})
	.refine((vars) => vars.VERCEL_ENV !== 'production' || vars.CRON_SECRET !== undefined, {
		message: "Production's daily cleanup cron authenticates with CRON_SECRET",
		path: ['CRON_SECRET'],
	});

export const env = envSchema.parse(process.env);

// Whether the app's cookies are Secure: on a production build, as every Vercel deployment serves
// over HTTPS, and not on the dev server over http.
export const secureCookies = env.NODE_ENV === 'production';

// The base for absolute URLs in metadata: production on every deployment, else the dev server.
export const siteUrl = new URL(
	env.VERCEL_PROJECT_PRODUCTION_URL === undefined
		? 'http://localhost:3000'
		: `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
);

// The base for links in emails, which must open where they were sent from: production's domain, a
// preview's branch host, or the dev server.
export const appUrl =
	env.VERCEL_ENV === 'production'
		? siteUrl
		: env.VERCEL_ENV === 'preview'
			? new URL(`https://${env.VERCEL_BRANCH_URL ?? env.VERCEL_URL}`)
			: new URL('http://localhost:3000');

// Where this deployment's images go under each role's folder: production, a preview's branch, or
// development. Every preview shares the preview store, so each writes and deletes only in its own.
export const imageEnvironment =
	env.VERCEL_ENV === 'production'
		? productionImageEnvironment
		: env.VERCEL_ENV === 'preview'
			? `${previewImageEnvironmentPrefix}${branchFolder(env.VERCEL_GIT_COMMIT_REF!)}`
			: developmentImageEnvironment;

// What this deployment reaches besides its own images. Next.js run directly is local development.
const imageAccess = imageEnvironmentAccess[env.VERCEL_ENV ?? 'development'];

// The other environments in this deployment's store whose images it serves.
export const readableImageEnvironments = imageAccess.readableEnvironments;

// The environments whose images this deployment fetches from production's public image route.
export const imageEnvironmentsFetchedFromProduction = imageAccess.fetchedFromProduction;

// Whether this deployment sweeps its images after each write, as every one without the daily
// cleanup cron does.
export const sweepsImagesAfterWrites = imageAccess.sweepsAfterWrites;

// The token the daily cleanup cron's requests carry. Only production has one, since Vercel runs
// crons only there.
export const cronSecret = env.VERCEL_ENV === 'production' ? env.CRON_SECRET : undefined;
