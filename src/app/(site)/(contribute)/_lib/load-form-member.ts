import 'server-only';
import { redirect } from 'next/navigation';
import type { CurrentMemberDto } from '@/application/members/member-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { getMemberService } from '@/composition/services';

// The member signed in, for a page only members open, such as a recipe form, which keeps unsaved
// changes in this browser under their id. A visitor whose session ended is sent to sign in and back
// to the page's href, its query included.
export async function loadFormMember(pageHref: string): Promise<CurrentMemberDto> {
	const member = await getMemberService().getCurrentMember();
	if (member === null) {
		redirect(signInHref(pageHref));
	}
	return member;
}
