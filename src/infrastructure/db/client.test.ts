import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A preview deployment's variables as Vercel sets them, with the pooled URL under test.
function stubPreviewEnv(databaseUrl: string): void {
	const variables = {
		VERCEL_ENV: 'preview',
		VERCEL_URL: 'recipe-hub-git-feature-x.vercel.app',
		VERCEL_GIT_COMMIT_REF: 'feature-x',
		NEON_PRODUCTION_ENDPOINT_ID: 'ep-quiet-butterfly-w2qres1h',
		DATABASE_URL: databaseUrl,
		BLOB_STORE_ID: 'store_test',
		BLOB_WEBHOOK_PUBLIC_KEY: 'test-public-key',
		BETTER_AUTH_SECRET: 'a'.repeat(32),
		ADMIN_EMAIL: 'owner@recipes.invalid',
		RESEND_API_KEY: 're_test',
		RESEND_EMAIL_DOMAIN: 'mail.recipes.invalid',
	};
	for (const [name, value] of Object.entries(variables)) {
		vi.stubEnv(name, value);
	}
}

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('the database client', () => {
	it("refuses a preview's pooled URL on production's endpoint as it loads", async () => {
		stubPreviewEnv(
			'postgresql://owner:secret@ep-quiet-butterfly-w2qres1h-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
		);

		await expect(import('@/infrastructure/db/client')).rejects.toThrow(
			"Refusing production's database (ep-quiet-butterfly-w2qres1h-pooler.us-east-1.aws.neon.tech) with VERCEL_ENV preview: on a preview, Neon's integration did not give the deployment its own branch"
		);
	});

	it("loads on a preview whose pooled URL names its own branch's endpoint", async () => {
		stubPreviewEnv(
			'postgresql://owner:secret@ep-misty-morning-a1pfa4ez-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
		);

		await expect(import('@/infrastructure/db/client')).resolves.toHaveProperty('db');
	});
});
