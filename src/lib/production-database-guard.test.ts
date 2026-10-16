import { describe, expect, it } from 'vitest';
import {
	guardProductionDatabase,
	productionDatabaseGuardEnvSchema,
} from '@/lib/production-database-guard';

const productionEndpointId = 'ep-quiet-butterfly-w2qres1h';

const productionDirectUrl =
	'postgresql://owner:secret@ep-quiet-butterfly-w2qres1h.us-east-1.aws.neon.tech/neondb?sslmode=verify-full';

const productionPooledUrl =
	'postgresql://owner:secret@ep-quiet-butterfly-w2qres1h-pooler.us-east-1.aws.neon.tech/neondb?sslmode=verify-full';

const previewDirectUrl =
	'postgresql://owner:secret@ep-misty-morning-a1pfa4ez.us-east-1.aws.neon.tech/neondb?sslmode=verify-full';

const refusedOnPreview =
	"Refusing production's database (ep-quiet-butterfly-w2qres1h.us-east-1.aws.neon.tech) with VERCEL_ENV preview: on a preview, Neon's integration did not give the deployment its own branch";

describe('guardProductionDatabase', () => {
	it("lets production open production's database", () => {
		expect(() =>
			guardProductionDatabase(productionDirectUrl, {
				VERCEL_ENV: 'production',
				NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId,
			})
		).not.toThrow();
	});

	it("lets production open its database when production's endpoint is not named", () => {
		expect(() =>
			guardProductionDatabase(productionDirectUrl, { VERCEL_ENV: 'production' })
		).not.toThrow();
	});

	it("lets a preview open its own branch's database", () => {
		expect(() =>
			guardProductionDatabase(previewDirectUrl, {
				VERCEL_ENV: 'preview',
				NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId,
			})
		).not.toThrow();
	});

	it("refuses production's direct host on a preview", () => {
		expect(() =>
			guardProductionDatabase(productionDirectUrl, {
				VERCEL_ENV: 'preview',
				NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId,
			})
		).toThrow(refusedOnPreview);
	});

	it("refuses production's pooled host on a preview", () => {
		expect(() =>
			guardProductionDatabase(productionPooledUrl, {
				VERCEL_ENV: 'preview',
				NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId,
			})
		).toThrow(
			"Refusing production's database (ep-quiet-butterfly-w2qres1h-pooler.us-east-1.aws.neon.tech) with VERCEL_ENV preview: on a preview, Neon's integration did not give the deployment its own branch"
		);
	});

	it("refuses a host of production's compute on a preview", () => {
		expect(() =>
			guardProductionDatabase(
				'postgresql://owner:secret@ep-quiet-butterfly-w2qres1h-bph-pooler.us-east-1.aws.neon.tech/neondb',
				{ VERCEL_ENV: 'preview', NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId }
			)
		).toThrow(
			"Refusing production's database (ep-quiet-butterfly-w2qres1h-bph-pooler.us-east-1.aws.neon.tech) with VERCEL_ENV preview: on a preview, Neon's integration did not give the deployment its own branch"
		);
	});

	it("refuses a preview that does not name production's endpoint", () => {
		expect(() => guardProductionDatabase(previewDirectUrl, { VERCEL_ENV: 'preview' })).toThrow(
			"NEON_PRODUCTION_ENDPOINT_ID must be set on Preview, naming production's Neon endpoint, so a preview can refuse production's database"
		);
	});

	it("refuses production's endpoint locally once it is named", () => {
		expect(() =>
			guardProductionDatabase(productionDirectUrl, {
				NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId,
			})
		).toThrow(
			"Refusing production's database (ep-quiet-butterfly-w2qres1h.us-east-1.aws.neon.tech) with VERCEL_ENV unset: on a preview, Neon's integration did not give the deployment its own branch"
		);
	});

	it('lets a local run open any database when no variable is set', () => {
		expect(() => guardProductionDatabase(productionDirectUrl, {})).not.toThrow();
	});

	it('tells endpoints apart that only share a prefix', () => {
		expect(() =>
			guardProductionDatabase(
				'postgresql://owner:secret@ep-quiet-butterfly-w2qres1h2.us-east-1.aws.neon.tech/neondb',
				{ VERCEL_ENV: 'preview', NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId }
			)
		).not.toThrow();
	});
});

describe('productionDatabaseGuardEnvSchema', () => {
	it('takes an endpoint id', () => {
		expect(
			productionDatabaseGuardEnvSchema.parse({ NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId })
		).toEqual({ NEON_PRODUCTION_ENDPOINT_ID: productionEndpointId });
	});

	it.each([
		['the pooler', 'ep-quiet-butterfly-w2qres1h-pooler'],
		['a host', 'ep-quiet-butterfly-w2qres1h.us-east-1.aws.neon.tech'],
		['a project id', 'autumn-lake-30024670'],
	])('refuses %s in place of an endpoint id', (_, value) => {
		expect(
			productionDatabaseGuardEnvSchema.safeParse({ NEON_PRODUCTION_ENDPOINT_ID: value }).success
		).toBe(false);
	});
});
