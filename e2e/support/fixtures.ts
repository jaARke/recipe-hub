import { randomBytes } from 'node:crypto';
import { test as base } from '@playwright/test';
import { like } from 'drizzle-orm';
import type { Member, MemberRole } from '@/domain/member/member';
import { rateLimits } from '@/infrastructure/db/schema';
import {
	openDevelopDatabase,
	reportQueryErrorsWithoutParameters,
	type DevelopDatabase,
} from './develop-database';
import { createEndToEndAuth, type EndToEndAuth } from './end-to-end-auth';
import { createTestMember, deleteTestMember, type TestMemberInbox } from './test-members';

type WorkerFixtures = {
	// The dev server's database and the suites' Better Auth on it. Tests use them through e2e/support's
	// functions, which report a failed query without its parameters.
	develop: Pick<DevelopDatabase, 'db'> & { auth: EndToEndAuth };
};

type TestFixtures = {
	// The test's own client address, which its requests carry.
	readerAddress: string;
	// The test member's role and where its email goes, which a file sets with test.use.
	memberRole: MemberRole;
	memberInbox: TestMemberInbox;
	// A new member for the test, deleted with everything it wrote once the test ends.
	member: Member;
	// Signs the test's browser context in as the member, with a new session.
	signIn: () => Promise<void>;
};

// A new /64 in IPv6's documentation range (RFC 3849), written out in full as Better Auth keys its rate
// limits, which count per /64.
function documentationAddress(): string {
	const [first, second] = [randomBytes(2), randomBytes(2)].map((bytes) => bytes.toString('hex'));
	return `2001:0db8:${first}:${second}:0000:0000:0000:0000`;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	develop: [
		async ({}, use) => {
			const { db, close } = openDevelopDatabase();
			try {
				await use({ db, auth: createEndToEndAuth(db) });
			} finally {
				await close();
			}
		},
		{ scope: 'worker' },
	],
	// Each test is a reader at an address of its own, so Better Auth's limits per address, which every
	// request from this machine would otherwise share, apply per test as they do per person. Its
	// rate-limit rows go with it.
	readerAddress: async ({ develop }, use) => {
		const address = documentationAddress();
		try {
			await use(address);
		} finally {
			await reportQueryErrorsWithoutParameters(() =>
				develop.db.delete(rateLimits).where(like(rateLimits.key, `${address}|%`))
			);
		}
	},
	// The dev server keeps a forwarded address it is sent, and Better Auth trusts one lone address.
	extraHTTPHeaders: async ({ extraHTTPHeaders, readerAddress }, use) => {
		await use({ ...extraHTTPHeaders, 'x-forwarded-for': readerAddress });
	},
	memberRole: ['member', { option: true }],
	memberInbox: ['none', { option: true }],
	member: async ({ develop, memberRole, memberInbox }, use) => {
		const member = await createTestMember(develop.db, { role: memberRole, inbox: memberInbox });
		try {
			await use(member);
		} finally {
			await deleteTestMember(develop.db, member);
		}
	},
	signIn: async ({ context, develop, member }, use) => {
		await use(async () => {
			await context.addCookies(await develop.auth.sessionCookies(member.id));
		});
	},
});

export { expect } from '@playwright/test';
