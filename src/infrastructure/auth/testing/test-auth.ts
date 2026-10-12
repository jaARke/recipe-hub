import { AccountService } from '@/application/access/account-service';
import { InMemoryEmailSender } from '@/application/testing/in-memory-email-sender';
import { createAuth, type AuthOptions } from '@/infrastructure/auth/better-auth';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import type { TestDatabase } from '@/infrastructure/db/testing/test-database';

export const testOrigin = 'http://localhost:3000';
// Server-side calls name the host, which Better Auth resolves the base URL from.
export const testHost = new URL(testOrigin).host;

// Better Auth on a test database with the real account services. Emails are recorded, and work
// Better Auth runs after answering is kept so a test can wait for it.
export function createTestAuth(
	db: TestDatabase,
	options: Pick<AuthOptions, 'productionHost'> = {}
) {
	const emails = new InMemoryEmailSender();
	const background: Promise<unknown>[] = [];
	const auth = createAuth({
		db,
		secret: 'recipe-hub-test-secret-0123456789abcdef',
		allowedHosts: [testHost],
		accounts: new AccountService(
			new DrizzleMemberRepository(db),
			new DrizzleInviteRepository(db),
			emails
		),
		runInBackground: (task) => {
			background.push(task);
		},
		...options,
	});

	return {
		auth,
		emails,
		backgroundWork: async () => {
			await Promise.all(background);
		},
	};
}

// The Cookie header a browser sends after a response that set these cookies.
export function cookiesFrom(headers: Headers): string {
	return headers
		.getSetCookie()
		.map((cookie) => cookie.split(';')[0])
		.join('; ');
}
