'use client';

import * as React from 'react';
import { authFieldNames } from '@/components/auth/auth-forms';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { useTransientState } from '@/components/forms/use-transient-state';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type RequestCodeFormProps = {
	id: string;
	// The sign-in page's field also lets the browser offer saved passkeys.
	autoComplete: 'email' | 'username webauthn';
	description?: string;
	defaultEmail?: string;
	action: FormAction;
};

// Asks for the address a sign-in code goes to.
function RequestCodeForm({
	id,
	autoComplete,
	description,
	defaultEmail,
	action,
}: RequestCodeFormProps) {
	const [state, formAction, pending] = useFormAction(
		action,
		'We couldn’t send a code. Check your connection and try again.'
	);
	const failure = state.status === 'error' ? state : undefined;

	return (
		<form action={formAction} noValidate className="flex flex-col gap-6">
			<FormErrorAlert message={failure?.message} />
			<TextField
				id={id}
				name={authFieldNames.email}
				type="email"
				label="Email"
				required
				autoComplete={autoComplete}
				description={description}
				error={failure?.fieldErrors[authFieldNames.email]}
				defaultValue={failure?.values?.[authFieldNames.email] ?? defaultEmail}
			/>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? 'Sending code' : 'Email me a code'}
				</Button>
			</div>
		</form>
	);
}

type ConfirmCodeFormProps = {
	id: string;
	// Says where the code went and how long it works.
	description: React.ReactNode;
	submitLabel: string;
	pendingLabel: string;
	action: FormAction;
	sendNewCode: () => Promise<FormState>;
	onChangeEmail: () => void;
};

// Takes the emailed code, with ways to get a new one or start over with another address.
function ConfirmCodeForm({
	id,
	description,
	submitLabel,
	pendingLabel,
	action,
	sendNewCode,
	onChangeEmail,
}: ConfirmCodeFormProps) {
	const [state, formAction, pending] = useFormAction(
		action,
		'We couldn’t check the code. Check your connection and try again.'
	);
	const [resendState, setResendState] = useTransientState<FormState>();
	const [resending, startResend] = React.useTransition();
	const failure = state.status === 'error' ? state : undefined;

	function resend() {
		startResend(async () => {
			try {
				setResendState(await sendNewCode());
			} catch {
				setResendState({
					status: 'error',
					message: 'We couldn’t send a new code. Check your connection and try again.',
					fieldErrors: {},
				});
			}
		});
	}

	return (
		<form action={formAction} noValidate className="flex flex-col gap-6">
			<FormErrorAlert message={failure?.message} />
			<TextField
				id={id}
				name={authFieldNames.code}
				label="Code"
				required
				autoComplete="one-time-code"
				inputMode="numeric"
				description={description}
				error={failure?.fieldErrors[authFieldNames.code]}
				defaultValue={failure?.values?.[authFieldNames.code]}
			/>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button type="button" variant="ghost" onClick={onChangeEmail}>
					Use a different email
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={resending}
					focusableWhenDisabled
					onClick={resend}
				>
					{resending && <Spinner data-icon="inline-start" />}
					{resending ? 'Sending code' : 'Send a new code'}
				</Button>
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? pendingLabel : submitLabel}
				</Button>
			</div>
			<FormErrorAlert message={resendState?.status === 'error' ? resendState.message : undefined} />
			<FormStatusMessage
				kind="confirmation"
				message={
					resendState?.status === 'success'
						? 'We sent a new code. Use the newest one, since earlier codes no longer work.'
						: undefined
				}
			/>
		</form>
	);
}

export { ConfirmCodeForm, RequestCodeForm };
