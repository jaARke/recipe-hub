import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import type { NewMember } from '@/application/ports/member-repository';
import { memberSchema, type Member } from '@/domain/member/member';
import { users } from '@/infrastructure/db/schema';

// What every member read selects; Better Auth's own columns stay out.
export const memberColumns = {
	id: users.id,
	displayName: users.displayName,
	email: users.email,
	role: users.role,
	createdAt: users.createdAt,
};

type MemberRow = InferModelFromColumns<typeof memberColumns>;

export function toInsertColumns(member: NewMember): typeof users.$inferInsert {
	return { ...member, emailVerified: true };
}

// Invalid rows throw.
export function toMember(row: MemberRow): Member {
	return memberSchema.parse(row);
}
