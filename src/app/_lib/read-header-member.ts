import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import type { CurrentMemberDto } from '@/application/members/member-dtos';
import type { HeaderMember } from '@/components/layout/header-member';
import { getLogger } from '@/lib/logger';

const logger = getLogger('auth');

// The header sits on every page, so a failed session read shows the signed-out header instead of
// the global error page. Next's own control-flow errors still pass through.
export async function readHeaderMember(
	read: () => Promise<CurrentMemberDto | null>
): Promise<HeaderMember | null> {
	try {
		const member = await read();
		return member === null ? null : { displayName: member.displayName, role: member.role };
	} catch (error) {
		unstable_rethrow(error);
		logger.error('Header session read failed', { err: error });
		return null;
	}
}
