import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Member, MemberRole } from '@/domain/member/member';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { recipeImports, recipes, users } from '@/infrastructure/db/schema';

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
	return new DrizzleMemberRepository(db).create({
		email: testMemberEmail(inbox),
		displayName: testMemberName,
		role,
	});
}

// Removes the member as an admin would, which deletes its sessions, passkeys, favorites, drafts, and
// sign-in code, then deletes its recipes, its imports, and the row a removal keeps. The app never
// deletes a member, so this last part is the suites' alone. A recipe a flow failed to delete on the
// dev server goes behind the dev server's cache, so the list may name it until the next recipe write.
export async function deleteTestMember(db: NodePgDatabase, member: Member): Promise<void> {
	await new DrizzleMemberRepository(db).remove(member.id);
	await db.transaction(async (tx) => {
		await tx.delete(recipes).where(eq(recipes.contributorId, member.id));
		await tx.delete(recipeImports).where(eq(recipeImports.memberId, member.id));
		await tx.delete(users).where(eq(users.id, member.id));
	});
}
