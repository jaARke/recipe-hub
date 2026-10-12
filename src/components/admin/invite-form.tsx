'use client';

import { adminFieldNames, type IssuedInvite } from '@/components/admin/admin-forms';
import { DisplayNameField } from '@/components/admin/display-name-field';
import { IssuedInviteNotice } from '@/components/admin/issued-invite-notice';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

// Invites someone who has not requested access.
function InviteForm({ issueInvite }: { issueInvite: FormAction<IssuedInvite> }) {
	const [state, formAction, pending] = useFormAction(
		issueInvite,
		"We couldn't create the invite. Reload the page and try again."
	);
	const failed = state.status === 'error' ? state : undefined;

	return (
		<div>
			<form action={formAction} noValidate className="flex flex-col gap-6">
				<FieldGroup>
					<DisplayNameField
						id="admin-invite-name"
						defaultValue={failed?.values?.[adminFieldNames.displayName]}
						error={failed?.fieldErrors[adminFieldNames.displayName]}
					/>
					<TextField
						id="admin-invite-email"
						name={adminFieldNames.sendTo}
						type="email"
						label="Email"
						description="Optional. We email the invite here; leave it blank to send the link yourself."
						autoComplete="off"
						spellCheck={false}
						defaultValue={failed?.values?.[adminFieldNames.sendTo]}
						error={failed?.fieldErrors[adminFieldNames.sendTo]}
					/>
				</FieldGroup>
				<FormErrorAlert message={failed?.message} />
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button type="submit" disabled={pending} focusableWhenDisabled>
						{pending && <Spinner data-icon="inline-start" />}
						{pending ? 'Creating invite' : 'Create invite'}
					</Button>
				</div>
			</form>
			<div role="status">
				{state.status === 'success' && <IssuedInviteNotice invite={state} className="mt-6" />}
			</div>
		</div>
	);
}

export { InviteForm };
