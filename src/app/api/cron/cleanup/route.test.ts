import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/cron/cleanup/route';
import type { CleanupReport } from '@/application/cleanup/cleanup-dtos';

const secret = 'f3a9c1d7e5b2a8f4c6d0e9b1a7c3f5d2e8b4a6c0d9f1e7b3a5c2d8f0e6b4a1c9';

const report: CleanupReport = {
	interruptedImports: { settledCount: 0 },
	savedDrafts: { deletedCount: 1 },
	invites: 'failed',
	sessions: { deletedCount: 3 },
	verifications: { deletedCount: 4 },
	imageSweep: 'skipped',
};

const state = vi.hoisted(() => ({
	cronSecret: undefined as string | undefined,
	runCleanup: undefined as unknown as () => Promise<unknown>,
}));

vi.mock('@/lib/env', () => ({
	get cronSecret() {
		return state.cronSecret;
	},
}));

vi.mock('@/composition/services', () => ({
	getCleanupService: () => ({ runCleanup: state.runCleanup }),
}));

function requestCleanup(authorization?: string): Promise<Response> {
	const headers = authorization === undefined ? undefined : { authorization };
	return GET(new Request('http://localhost/api/cron/cleanup', { headers }));
}

describe('the cleanup route', () => {
	beforeEach(() => {
		state.runCleanup = vi.fn(async () => report);
	});

	afterEach(() => {
		state.cronSecret = undefined;
		vi.restoreAllMocks();
	});

	it.each([
		['no authorization', undefined],
		["the cron's token", `Bearer ${secret}`],
	])(
		'answers 404 where no cron runs, as on a preview or the dev server, to %s, and cleans nothing',
		async (_case, authorization) => {
			const response = await requestCleanup(authorization);

			expect(response.status).toBe(404);
			expect(response.headers.get('Cache-Control')).toBe('no-store');
			expect(state.runCleanup).not.toHaveBeenCalled();
		}
	);

	it.each([
		['no authorization', undefined],
		['another token', `Bearer ${secret.replace('f3', 'f4')}`],
		['the secret without its scheme', secret],
		['the secret under another scheme', `Basic ${secret}`],
		['a prefix of the token', `Bearer ${secret.slice(0, -1)}`],
	])('answers 401 on production to %s, and cleans nothing', async (_case, authorization) => {
		state.cronSecret = secret;

		const response = await requestCleanup(authorization);

		expect(response.status).toBe(401);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(state.runCleanup).not.toHaveBeenCalled();
	});

	it("runs the cleanup on production for the cron's token and answers with its report", async () => {
		state.cronSecret = secret;

		const response = await requestCleanup(`Bearer ${secret}`);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual(report);
		expect(state.runCleanup).toHaveBeenCalledOnce();
	});
});
