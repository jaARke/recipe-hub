'use server';

import { refresh, updateTag } from 'next/cache';
import { toFormError } from '@/app/_lib/form-errors';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { MemberRef } from '@/application/members/member-dtos';
import { profileFieldNames } from '@/components/account/account-forms';
import { formText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { getMemberService } from '@/composition/services';

// Recipe pages carry their contributor's tag, so the new name reaches every page showing it.
export async function renameMember(_state: FormState, formData: FormData): Promise<FormState> {
	let member: MemberRef;
	try {
		member = await getMemberService().renameCurrentMember(
			formText(formData, profileFieldNames.displayName)
		);
	} catch (error) {
		return toFormError(error);
	}

	updateTag(recipeCacheTags.member(member.id));
	refresh();
	return { status: 'success' };
}
