'use server';

import { toFormError } from '@/app/_lib/form-errors';
import type { InvitePreviewDto } from '@/application/access/access-dtos';
import type { FormState } from '@/components/forms/form-state';
import { getInviteService } from '@/composition/services';

// The token travels only in these actions' request bodies, never in a URL the server sees.

export async function getInvitePreview(token: string): Promise<InvitePreviewDto | null> {
	return getInviteService().getInvitePreview(token);
}

// Returns the address as stored, which the page then asks a sign-in code for.
export async function bindInviteEmail(
	token: string,
	email: string
): Promise<FormState<{ email: string }>> {
	try {
		return {
			status: 'success',
			email: await getInviteService().bindInviteEmail(token, email),
		};
	} catch (error) {
		return toFormError(error);
	}
}
