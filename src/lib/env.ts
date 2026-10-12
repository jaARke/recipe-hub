import 'server-only';
import { z } from 'zod';

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'production', 'test']),
		// Set by Vercel on deployments; absent when running Next.js directly.
		VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
		// Set by Vercel on every deployment, previews included: the production host, without a scheme.
		VERCEL_PROJECT_PRODUCTION_URL: z.hostname().optional(),
		// Set by Vercel on every deployment: that deployment's own host, without a scheme.
		VERCEL_URL: z.hostname().optional(),
		// Set by Vercel on Git deployments: the branch's lasting host, without a scheme.
		VERCEL_BRANCH_URL: z.hostname().optional(),
		// Pooled connection for the app; migrations use the unpooled URL through drizzle.config.ts.
		DATABASE_URL: z.url(),
		// The image store; the Blob SDK reads and refreshes Vercel's OIDC token itself.
		BLOB_STORE_ID: z.string().min(1),
		// Signs session cookies and encrypts stored sign-in codes.
		BETTER_AUTH_SECRET: z.string().min(32),
		// Must stay unset: Better Auth reads it itself and would use it in place of BETTER_AUTH_SECRET.
		BETTER_AUTH_SECRETS: z.never().optional(),
		// Must stay unset: Better Auth reads it itself and would trust its origins beyond our hosts.
		BETTER_AUTH_TRUSTED_ORIGINS: z.never().optional(),
		// Resend's key, from the Vercel integration.
		RESEND_API_KEY: z.string().min(1),
		// The verified sending domain, from the Vercel integration; mail comes from an address on it.
		RESEND_EMAIL_DOMAIN: z.hostname(),
	})
	.refine((vars) => vars.VERCEL_ENV !== 'preview' || vars.VERCEL_URL !== undefined, {
		message: 'Vercel sets VERCEL_URL on every preview deployment',
		path: ['VERCEL_URL'],
	});

export const env = envSchema.parse(process.env);

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
