'use client';

import * as React from 'react';
import { authFieldNames, codeBlankMessages } from '@/components/auth/auth-forms';
import { FormActions } from '@/components/forms/form-actions';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { useTransientState } from '@/components/forms/use-transient-state';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { emailBlankMessages } from '@/domain/member/member';

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
	const [state, formProps, pending] = useFormAction(
		action,
		'We couldn’t send a code. Check your connection and try again.',
		{ blankMessages: emailBlankMessages }
	);
	const failure = state.status === 'error' ? state : undefined;

	return (
		<form {...formProps} className="flex flex-col gap-4">
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
			<FormActions>
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? 'Sending code' : 'Email me a code'}
				</Button>
			</FormActions>
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
	const [state, formProps, pending] = useFormAction(
		action,
		'We couldn’t check the code. Check your connection and try again.',
		{ blankMessages: codeBlankMessages }
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
		<form {...formProps} className="flex flex-col gap-4">
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
			{/* The resend's alert: above the field, it would take the focus a failed code gives the field. */}
			<FormErrorAlert message={resendState?.status === 'error' ? resendState.message : undefined} />
			<FormActions
				status={
					<FormStatusMessage
						kind="confirmation"
						message={
							resendState?.status === 'success'
								? 'We sent a new code. Use the newest one, since earlier codes no longer work.'
								: undefined
						}
					/>
				}
			>
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? pendingLabel : submitLabel}
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
				<Button type="button" variant="ghost" onClick={onChangeEmail}>
					Use a different email
				</Button>
			</FormActions>
		</form>
	);
}

export { ConfirmCodeForm, RequestCodeForm };
