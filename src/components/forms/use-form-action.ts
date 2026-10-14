'use client';

import { unstable_rethrow } from 'next/navigation';
import {
	useActionState,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type SubmitEvent,
} from 'react';
import { hasFieldErrors } from '@/components/forms/field-errors';
import { formText } from '@/components/forms/form-data';
import type {
	FieldErrors,
	FieldValues,
	FormAction,
	FormError,
	FormState,
} from '@/components/forms/form-state';

// What the browser checks before any request, and what runs once it finds nothing. It checks only
// what it knows for certain, such as a blank field, and says what the server would; the server stays
// the authority.
type FormActionOptions = {
	// What each field says when it's blank, keyed by the field's name, from the domain's messages.
	// Mark each field required too, so assistive technology says so.
	blankMessages?: FieldErrors;
	// A custom input's own check, such as a photo count, run as the form submits: its problems keyed by
	// path, as the server's are, and empty when there are none. It shows them as the server's show.
	check?: () => FieldErrors;
	// Runs once the browser finds nothing to fix, and can still stop the submit, as a warning does.
	onSubmit?: (event: SubmitEvent<HTMLFormElement>) => void;
};

// A field marked invalid, an error shown in place of a group's fields, or an alert about the whole
// form: whichever comes first in the form is its first problem.
const problemSelector =
	'[aria-invalid="true"], [data-slot="field-error"][tabindex="-1"], [role="alert"][tabindex="-1"]';

function submittedText(formData: FormData): FieldValues {
	const values: FieldValues = {};
	for (const [name, value] of formData) {
		if (typeof value === 'string') {
			values[name] = value;
		}
	}
	return values;
}

// The fields left blank, trimmed as formText reads them, each with its message.
function blankFieldErrors(formData: FormData, blankMessages: FieldErrors): FieldErrors {
	const fieldErrors: FieldErrors = {};
	for (const [name, message] of Object.entries(blankMessages)) {
		if (message !== undefined && formText(formData, name) === '') {
			fieldErrors[name] = message;
		}
	}
	return fieldErrors;
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
// redirect passes through to the router. The form spreads formProps, through which the browser's
// check refuses a submit in place, as the server would, and which turn off the browser's own
// validation. After each failure, found in the browser or on the server, focus moves to the form's
// first problem. What an attempt said lasts only while its page is shown: Next keeps a page the member
// leaves and shows it again on return, without the outcome of the result it hid with and without
// moving focus.
export function useFormAction<Success extends object>(
	action: FormAction<Success>,
	failureMessage: string,
	{ blankMessages = {}, check, onSubmit }: FormActionOptions = {}
) {
	const formRef = useRef<HTMLFormElement>(null);
	const [actionResult, formAction, pending] = useActionState<FormState<Success>, FormData>(
		async (state, formData) => {
			try {
				const next = await action(state, formData);
				// A new object every time, so a problem the browser found reads as older.
				return next.status === 'error' ? { ...next, values: submittedText(formData) } : { ...next };
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
	// A problem the browser found, which shows until the action's next result replaces it.
	const [refusal, setRefusal] = useState<{ error: FormError; after: FormState<Success> }>();
	const result = refusal?.after === actionResult ? refusal.error : actionResult;

	// The result in view when the page last hid, or one a newer result replaced. The cleanup runs as
	// the page hides and commits before it does, so nothing flashes on return.
	const [retiredResult, setRetiredResult] = useState<FormState<Success>>();
	useLayoutEffect(() => () => setRetiredResult(result), [result]);
	const state = result === retiredResult ? withoutOutcome(result) : result;

	// Each failure moves focus once, not again when a hidden page shows.
	const focusedResult = useRef(result);
	useEffect(() => {
		if (focusedResult.current === result) {
			return;
		}
		focusedResult.current = result;
		if (result.status === 'error') {
			formRef.current?.querySelector<HTMLElement>(problemSelector)?.focus();
		}
	}, [result]);

	// A form inside another's popup submits through it in React's tree, so only the form's own
	// submit is checked.
	function checkBeforeSending(event: SubmitEvent<HTMLFormElement>) {
		if (event.target !== event.currentTarget) {
			return;
		}
		const formData = new FormData(event.currentTarget, event.submitter);
		const fieldErrors = { ...blankFieldErrors(formData, blankMessages), ...check?.() };
		if (hasFieldErrors(fieldErrors)) {
			event.preventDefault();
			setRefusal({
				error: { status: 'error', fieldErrors, values: submittedText(formData) },
				after: actionResult,
			});
			return;
		}
		onSubmit?.(event);
	}

	const formProps = {
		ref: formRef,
		action: formAction,
		onSubmit: checkBeforeSending,
		noValidate: true,
	};
	return [state, formProps, pending] as const;
}
