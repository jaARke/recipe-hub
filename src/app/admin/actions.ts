'use server';

import { refresh } from 'next/cache';
import { toFormError } from '@/app/_lib/form-errors';
import type { IssuedInviteDto } from '@/application/access/access-dtos';
import { adminFieldNames, type IssuedInvite } from '@/components/admin/admin-forms';
import { formText, optionalFormText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { getAccessRequestService, getInviteService } from '@/composition/services';

// Approving a request sends its id; inviting someone directly sends none.
export async function issueInvite(
	_state: FormState<IssuedInvite>,
	formData: FormData
): Promise<FormState<IssuedInvite>> {
	const input = {
		displayName: formText(formData, adminFieldNames.displayName),
		sendTo: optionalFormText(formData, adminFieldNames.sendTo),
		requestId: optionalFormText(formData, adminFieldNames.requestId),
	};
	let issued: IssuedInviteDto;
	try {
		issued = await getInviteService().issueInvite(input);
	} catch (error) {
		return toFormError(error);
	}

	refresh();
	return { status: 'success', ...issued };
}

export async function declineRequest(_state: FormState, formData: FormData): Promise<FormState> {
	try {
		await getAccessRequestService().declineRequest(formText(formData, adminFieldNames.requestId));
	} catch (error) {
		return toFormError(error);
	}

	refresh();
	return { status: 'success' };
}

export async function revokeInvite(_state: FormState, formData: FormData): Promise<FormState> {
	try {
		await getInviteService().revokeInvite(formText(formData, adminFieldNames.inviteId));
	} catch (error) {
		return toFormError(error);
	}

	refresh();
	return { status: 'success' };
}
