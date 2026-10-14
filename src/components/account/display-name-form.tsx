'use client';

import { profileFieldNames } from '@/components/account/account-forms';
import { FormActions } from '@/components/forms/form-actions';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { profileBlankMessages } from '@/domain/member/member';

type DisplayNameFormProps = {
	displayName: string;
	action: FormAction;
};

function DisplayNameForm({ displayName, action }: DisplayNameFormProps) {
	const [state, formProps, pending] = useFormAction(
		action,
		'We couldn’t save your name. Check your connection and try again.',
		{ blankMessages: profileBlankMessages }
	);
	const failure = state.status === 'error' ? state : undefined;

	return (
		<form {...formProps} className="flex flex-col gap-4">
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
			<FormActions
				status={
					<FormStatusMessage
						kind="confirmation"
						message={state.status === 'success' ? 'Saved.' : undefined}
					/>
				}
			>
				<Button type="submit" disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? 'Saving name' : 'Save name'}
				</Button>
			</FormActions>
		</form>
	);
}

export { DisplayNameForm };
