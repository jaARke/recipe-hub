import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogger } from '@/lib/logger';

describe('getLogger', () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('cuts query parameters from a logged error and its cause', () => {
		const cause = new Error('Failed query: select 1 where email = $1\nparams: jane@example.com');
		getLogger('test').error('Lookup failed', { err: new Error('Wrapped', { cause }) });

		const line = String(consoleError.mock.calls[0]?.[0]);
		expect(line).not.toContain('jane@example.com');
		expect(JSON.parse(line).err.cause.message).toBe('Failed query: select 1 where email = $1');
	});
});
