'use client';

import { profileFieldNames } from '@/components/account/account-forms';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type DisplayNameFormProps = {
	displayName: string;
	action: FormAction;
};

function DisplayNameForm({ displayName, action }: DisplayNameFormProps) {
	const [state, formAction, pending] = useFormAction(
		action,
		'We couldn’t save your name. Check your connection and try again.'
	);
	const failure = state.status === 'error' ? state : undefined;

	return (
		<form action={formAction} noValidate className="flex flex-col gap-6">
			<FormErrorAlert message={failure?.message} />
			<TextField
				id="account-display-name"
				name={profileFieldNames.displayName}
				label="Display name"
				required
				autoComplete="nickname"
				description="Shown beside recipes you add."
				error={failure?.fieldErrors[profileFieldNames.displayName]}
				defaultValue={failure?.values?.[profileFieldNames.displayName] ?? displayName}
			/>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
				<FormStatusMessage
					kind="confirmation"
					message={state.status === 'success' ? 'Saved.' : undefined}
				/>
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? 'Saving name' : 'Save name'}
				</Button>
			</div>
		</form>
	);
}

export { DisplayNameForm };
