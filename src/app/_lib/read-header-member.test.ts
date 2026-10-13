import { notFound } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readHeaderMember } from '@/app/_lib/read-header-member';
import type { CurrentMemberDto } from '@/application/members/member-dtos';
import { memberIdSchema } from '@/domain/member/member';

const member: CurrentMemberDto = {
	id: memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e'),
	displayName: 'Jane',
	email: 'jane@example.com',
	role: 'member',
};

describe('readHeaderMember', () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

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
	});

	it('lets Next control-flow errors through', async () => {
		const read = async () => notFound();

		await expect(readHeaderMember(read)).rejects.toThrow();
		expect(consoleError).not.toHaveBeenCalled();
	});
});
