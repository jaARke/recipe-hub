import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { readHeaderMember } from '@/app/_lib/read-header-member';
import type { CurrentMemberDto } from '@/application/members/member-dtos';
import { memberIdSchema } from '@/domain/member/member';

// Outside a request connection() throws; readForReader's tests cover how its wait settles.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

const member: CurrentMemberDto = {
	id: memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e'),
	displayName: 'Jane',
	email: 'jane@example.com',
	role: 'member',
};

describe('readHeaderMember', () => {
	let consoleError: MockInstance<typeof console.error>;

	beforeEach(() => {
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps the email out of the header member', async () => {
		await expect(readHeaderMember(async () => member)).resolves.toEqual({
			displayName: 'Jane',
			role: 'member',
		});
	});

	it('is signed out for a visitor without a session', async () => {
		await expect(readHeaderMember(async () => null)).resolves.toBeNull();
	});

	it('falls back to signed out and logs when the session read fails', async () => {
		const read = async () => {
			throw new Error('Database unavailable');
		};

		await expect(readHeaderMember(read)).resolves.toBeNull();
		expect(consoleError).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleError.mock.calls[0]?.[0]))).toMatchObject({
			level: 'error',
			logger: 'auth',
			message: 'Header session read failed',
			err: { message: 'Database unavailable' },
		});
	});
});
