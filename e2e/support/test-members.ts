import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Member, MemberRole } from '@/domain/member/member';
import { boundedTransaction, statementTimeoutMs } from '@/infrastructure/db/bounded-transaction';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { recipeImports, recipes, users } from '@/infrastructure/db/schema';
import { queryErrorCause } from '@/lib/errors';
import { reportQueryErrorsWithoutParameters } from './develop-database';

// The error Postgres fails a delete with while another row still references the deleted one.
const foreignKeyViolation = '23503';

// A write already past its session check when the member is removed, such as a save a test cut off
// left running, lands within its transaction's statement timeout, so the deletes try again until then.
const lateWritePauseMs = 1_000;

// Every test member's display name, which pages show as who added a recipe.
export const testMemberName = 'End-to-end member';

// Where a test member's email goes. Nothing is sent to most, whose address is under .invalid (RFC
// 2606) and can never receive one. A test that sends one uses Resend's test inbox, which takes it
// without harming the sending domain's reputation, though it still counts against the daily quota.
export type TestMemberInbox = 'none' | 'resendTest';

// New each time, so tests never share an account.
function testMemberEmail(inbox: TestMemberInbox): string {
	const label = `e2e-${randomUUID()}`;
	return inbox === 'resendTest' ? `delivered+${label}@resend.dev` : `${label}@recipes.invalid`;
}

// A member made for one test, created as the seed creates its contributor.
export function createTestMember(
	db: NodePgDatabase,
	{ role, inbox }: { role: MemberRole; inbox: TestMemberInbox }
): Promise<Member> {
	return reportQueryErrorsWithoutParameters(() =>
		new DrizzleMemberRepository(db).create({
			email: testMemberEmail(inbox),
			displayName: testMemberName,
			role,
		})
	);
}

// Removes the member as an admin would, which deletes its sessions, passkeys, favorites, drafts, and
// sign-in code, then deletes its recipes, its imports, and the row a removal keeps. The app never
// deletes a member, so this last part is the suites' alone. A recipe a flow failed to delete on the
// dev server goes behind the dev server's cache, so the list may name it until the next recipe write.
export function deleteTestMember(db: NodePgDatabase, member: Member): Promise<void> {
	return reportQueryErrorsWithoutParameters(async () => {
		await new DrizzleMemberRepository(db).remove(member.id);
		const lateWritesLandBy = Date.now() + statementTimeoutMs;
		for (;;) {
			try {
				await deleteMemberRows(db, member);
				return;
			} catch (error) {
				const code = error instanceof Error ? queryErrorCause(error)?.code : undefined;
				if (code !== foreignKeyViolation || Date.now() > lateWritesLandBy) {
					throw error;
				}
				await sleep(lateWritePauseMs);
			}
		}
	});
}

// Once the member's row is gone, a write naming the member fails on its own reference to it.
function deleteMemberRows(db: NodePgDatabase, member: Member): Promise<void> {
	return boundedTransaction(db, 'deleting a test member', async (tx) => {
		await tx.delete(recipes).where(eq(recipes.contributorId, member.id));
		await tx.delete(recipeImports).where(eq(recipeImports.memberId, member.id));
		await tx.delete(users).where(eq(users.id, member.id));
	});
}
