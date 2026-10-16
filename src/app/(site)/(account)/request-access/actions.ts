'use server';

import { checkBotId } from 'botid/server';
import { toFormError } from '@/app/_lib/form-errors';
import {
	accessRequestFieldNames,
	requestAccessFailureMessage,
} from '@/components/account/account-forms';
import { formText, optionalFormText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { getAccessRequestService } from '@/composition/services';
import { getLogger } from '@/lib/logger';

const logger = getLogger('access');

// BotID judges the submission first; a bot gets the form's usual failure message.
export async function requestAccess(_state: FormState, formData: FormData): Promise<FormState> {
	if ((await checkBotId()).isBot) {
		logger.warn('Access request refused as automated');
		return { status: 'error', message: requestAccessFailureMessage, fieldErrors: {} };
	}

	try {
		await getAccessRequestService().submitRequest({
			name: formText(formData, accessRequestFieldNames.name),
			relationship: formText(formData, accessRequestFieldNames.relationship),
			email: optionalFormText(formData, accessRequestFieldNames.email),
		});
	} catch (error) {
		return toFormError(error);
	}

	return { status: 'success' };
}
