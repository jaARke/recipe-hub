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

	it("keeps only the fields of a failed query's cause that name what failed", () => {
		const canary = 'secret-value-canary';
		const cause = Object.assign(new Error(`invalid input syntax for type uuid: "${canary}"`), {
			code: '22P02',
			detail: `Key (invite_id)=(${canary}) is not present.`,
			where: `unnamed portal parameter $1 = '${canary}'`,
			table: 'users',
		});
		const queryError = new Error(`Failed query: select 1 where id = $1\nparams: ${canary}`, {
			cause,
		});

		getLogger('test').error('Lookup failed', { err: new Error('Wrapped', { cause: queryError }) });

		const line = String(consoleError.mock.calls[0]?.[0]);
		expect(line).not.toContain(canary);
		expect(JSON.parse(line).err.cause.cause).toEqual({
			name: 'Error',
			code: '22P02',
			table: 'users',
		});
	});
});
