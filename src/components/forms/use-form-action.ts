'use client';

import { useActionState } from 'react';
import type { FieldValues, FormAction, FormState } from '@/components/forms/form-state';

function submittedText(formData: FormData): FieldValues {
	const values: FieldValues = {};
	for (const [name, value] of formData) {
		if (typeof value === 'string') {
			values[name] = value;
		}
	}
	return values;
}

// Calls the action from a client function. React replays a submit made before hydration through
// fetch, which BotID can check, and a call that fails in transport (a firewall 429 or a lost
// connection) shows failureMessage in the form instead of the error page. A failure carries the
// submitted text, so the form keeps it. The action must not redirect; the form navigates on success.
export function useFormAction<Success extends object>(
	action: FormAction<Success>,
	failureMessage: string
) {
	return useActionState<FormState<Success>, FormData>(
		async (state, formData) => {
			try {
				const result = await action(state, formData);
				return result.status === 'error' ? { ...result, values: submittedText(formData) } : result;
			} catch {
				return {
					status: 'error',
					message: failureMessage,
					fieldErrors: {},
					values: submittedText(formData),
				};
			}
		},
		{ status: 'idle' }
	);
}
