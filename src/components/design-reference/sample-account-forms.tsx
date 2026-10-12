'use client';

import { InfoIcon } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { accessRequestFieldNames, profileFieldNames } from '@/components/account/account-forms';
import { DisplayNameForm } from '@/components/account/display-name-form';
import { PasskeyList } from '@/components/account/passkey-list';
import { RequestAccessForm } from '@/components/account/request-access-form';
import { accountPath, signInHref } from '@/components/auth/auth-paths';
import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
import { formText, optionalFormText } from '@/components/forms/form-data';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { TextLink } from '@/components/layout/text-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { parseAccessRequestFields } from '@/domain/member/access-request';
import { inviteLifetimeDays } from '@/domain/member/invite';
import { parseDisplayName } from '@/domain/member/member';

// Checks the request as the service does and sends any valid one.
const sendRequest: FormAction = (_state, formData) =>
	standIn<FormState>(
		inputProblems(() =>
			parseAccessRequestFields({
				name: formText(formData, accessRequestFieldNames.name),
				relationship: formText(formData, accessRequestFieldNames.relationship),
				email: optionalFormText(formData, accessRequestFieldNames.email),
			})
		) ?? { status: 'success' }
	);

// Checks the name as the service does and saves any valid one.
const saveName: FormAction = (_state, formData) =>
	standIn<FormState>(
		inputProblems(() => parseDisplayName(formText(formData, profileFieldNames.displayName))) ?? {
			status: 'success',
		}
	);

function SampleRequestAccessForm() {
	return (
		<RequestAccessForm
			action={sendRequest}
			nextSteps={`An admin will review it. If it's approved, you'll get an invite link to create your account, by email if you gave an address. The link works for ${inviteLifetimeDays} days.`}
		/>
	);
}

function SampleDisplayNameForm({ displayName }: { displayName: string }) {
	return <DisplayNameForm displayName={displayName} action={saveName} />;
}

// Shows a passkey's removing state, then says nothing was removed, as the sample recipe form does
// for saving.
function SamplePasskeyList({
	passkeys,
}: {
	passkeys: ComponentProps<typeof PasskeyList>['passkeys'];
}) {
	const [removingId, setRemovingId] = useState<string>();

	async function removePasskey(id: string) {
		setRemovingId(id);
		await standIn(null);
		setRemovingId(undefined);
		toast.add({
			type: 'info',
			title: 'Nothing was removed',
			description: 'This sample list shows the layout only.',
		});
	}

	return <PasskeyList passkeys={passkeys} removingId={removingId} onRemove={removePasskey} />;
}

// Mirrors the alert PasskeyManager shows when adding a passkey needs a fresh sign-in; the manager
// lists and changes passkeys through the auth client itself.
function SampleStaleSessionAlert() {
	return (
		<Alert>
			<InfoIcon aria-hidden="true" />
			<AlertTitle>Sign in again to add a passkey</AlertTitle>
			<AlertDescription>
				<p>
					For your security, adding a passkey needs a sign-in from the last day.{' '}
					<TextLink href={signInHref(accountPath)}>Sign in with an email code</TextLink>, and
					you&apos;ll come back here.
				</p>
			</AlertDescription>
		</Alert>
	);
}

export {
	SampleDisplayNameForm,
	SamplePasskeyList,
	SampleRequestAccessForm,
	SampleStaleSessionAlert,
};
