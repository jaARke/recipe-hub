import { z } from 'zod';

export const memberIdSchema = z.uuid().brand<'MemberId'>();
export type MemberId = z.infer<typeof memberIdSchema>;

export const memberRoleSchema = z.enum(['member', 'admin']);
export type MemberRole = z.infer<typeof memberRoleSchema>;
