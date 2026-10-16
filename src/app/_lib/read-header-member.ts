import 'server-only';
import { readForReader } from '@/app/_lib/read-for-reader';
import type { CurrentMemberDto } from '@/application/members/member-dtos';
import type { HeaderMember } from '@/components/layout/header-member';
import { getLogger } from '@/lib/logger';

const logger = getLogger('auth');

// The header sits on every page but the cooking view, so a failed session read shows the signed-out
// header instead of the global error page.
export async function readHeaderMember(
	read: () => Promise<CurrentMemberDto | null>
): Promise<HeaderMember | null> {
	const member = await readForReader(read, {
		log: (error) => logger.error('Header session read failed', { err: error }),
		fallback: null,
	});
	return member === null ? null : { displayName: member.displayName, role: member.role };
}
