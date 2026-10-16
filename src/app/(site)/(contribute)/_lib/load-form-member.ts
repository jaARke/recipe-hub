import 'server-only';
import { redirect } from 'next/navigation';
import type { CurrentMemberDto } from '@/application/members/member-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { getMemberService } from '@/composition/services';

// The member signed in, whose unsaved changes the recipe form keeps in this browser under their id.
// A visitor whose session ended is sent to sign in and back to the page.
export async function loadFormMember(path: string): Promise<CurrentMemberDto> {
	const member = await getMemberService().getCurrentMember();
	if (member === null) {
		redirect(signInHref(path));
	}
	return member;
}
