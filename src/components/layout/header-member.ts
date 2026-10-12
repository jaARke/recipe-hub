import type { CurrentMemberDto } from '@/application/members/member-dtos';

// What the header shows of the signed-in member, so the email stays out of every page.
export type HeaderMember = Pick<CurrentMemberDto, 'displayName' | 'role'>;
