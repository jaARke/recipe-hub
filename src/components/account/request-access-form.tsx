'use client';

import { CircleCheckIcon } from 'lucide-react';
import * as React from 'react';
import {
	accessRequestFieldNames,
	requestAccessFailureMessage,
} from '@/components/account/account-forms';
import { FormActions } from '@/components/forms/form-actions';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { TextField } from '@/components/forms/text-field';
import { useFocusOnChange } from '@/components/forms/use-focus-on-change';
import { useFormAction } from '@/components/forms/use-form-action';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { accessRequestBlankMessages } from '@/domain/member/access-request';

const sentNoticeId = 'request-access-sent';

type RequestAccessFormProps = {
	action: FormAction;
	// What happens after a request is sent, which the page states.
	nextSteps: React.ReactNode;
};

function RequestAccessForm({ action, nextSteps }: RequestAccessFormProps) {
	const [state, formProps, pending] = useFormAction(action, requestAccessFailureMessage, {
		blankMessages: accessRequestBlankMessages,
	});
	useFocusOnChange(state.status === 'success' ? 'sent' : 'form', sentNoticeId);

	if (state.status === 'success') {
		return (
			<Alert id={sentNoticeId} role="status" aria-live="polite" tabIndex={-1}>
				<CircleCheckIcon aria-hidden="true" />
				<AlertTitle>Request sent</AlertTitle>
				<AlertDescription>{nextSteps}</AlertDescription>
			</Alert>
		);
	}

	const failure = state.status === 'error' ? state : undefined;
	const fieldError = (name: string) => failure?.fieldErrors[name];
	const value = (name: string) => failure?.values?.[name];

	return (
		<form {...formProps} className="flex flex-col gap-7">
			<FormErrorAlert message={failure?.message} />
			<FieldGroup>
				<TextField
					id="request-access-name"
					name={accessRequestFieldNames.name}
					label="Name"
					required
					autoComplete="name"
					error={fieldError(accessRequestFieldNames.name)}
					defaultValue={value(accessRequestFieldNames.name)}
				/>
				<TextField
					id="request-access-relationship"
					name={accessRequestFieldNames.relationship}
					label="How do you know us?"
					required
					autoComplete="off"
					description="So an admin can tell who’s asking, such as whose friend or neighbor you are."
					error={fieldError(accessRequestFieldNames.relationship)}
					defaultValue={value(accessRequestFieldNames.relationship)}
				/>
				<TextField
					id="request-access-email"
					name={accessRequestFieldNames.email}
					type="email"
					label="Email (optional)"
					autoComplete="email"
					description="If your request is approved, your invite is sent here. Leave it blank to get the invite another way, such as by text."
					error={fieldError(accessRequestFieldNames.email)}
					defaultValue={value(accessRequestFieldNames.email)}
				/>
			</FieldGroup>
			<FormActions>
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? 'Sending request' : 'Send request'}
				</Button>
			</FormActions>
		</form>
	);
}

export { RequestAccessForm };
