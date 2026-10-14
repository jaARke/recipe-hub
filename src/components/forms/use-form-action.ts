'use client';

import { unstable_rethrow } from 'next/navigation';
import { useActionState, useLayoutEffect, useState } from 'react';
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

// What a result still says once its page has been hidden: only what describes the text in the
// fields, so a success reads as idle and an error keeps its field errors and values, not its message.
function withoutOutcome<Success extends object>(result: FormState<Success>): FormState<Success> {
	switch (result.status) {
		case 'idle':
			return result;
		case 'success':
			return { status: 'idle' };
		case 'error':
			return { status: 'error', fieldErrors: result.fieldErrors, values: result.values };
	}
}

// Calls the action from a client function. React replays a submit made before hydration through
// fetch, which BotID can check, and a call that fails in transport (a firewall 429 or a lost
// connection) shows failureMessage in the form instead of the error page. A failure carries the
// submitted text, so the form keeps it. An action that leads to another page redirects, and Next's
// redirect passes through to the router. What an attempt said lasts only while its page is shown:
// Next keeps a page the member leaves and shows it again on return, without the outcome of the
// result it hid with. The last element is the action's own result, which useFocusOnFailure
// compares, so showing the page never moves focus.
export function useFormAction<Success extends object>(
	action: FormAction<Success>,
	failureMessage: string
) {
	const [result, formAction, pending] = useActionState<FormState<Success>, FormData>(
		async (state, formData) => {
			try {
				const next = await action(state, formData);
				return next.status === 'error' ? { ...next, values: submittedText(formData) } : next;
			} catch (error) {
				unstable_rethrow(error);
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
	// The result in view when the page last hid, or one a newer result replaced. The cleanup runs as
	// the page hides and commits before it does, so nothing flashes on return.
	const [retiredResult, setRetiredResult] = useState<FormState<Success>>();
	useLayoutEffect(() => () => setRetiredResult(result), [result]);
	const state = result === retiredResult ? withoutOutcome(result) : result;

	return [state, formAction, pending, result] as const;
}
