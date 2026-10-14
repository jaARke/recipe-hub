'use client';

import { useState, type ComponentProps } from 'react';
import {
	accessRequestFieldNames,
	passkeyFieldNames,
	profileFieldNames,
} from '@/components/account/account-forms';
import { DisplayNameForm } from '@/components/account/display-name-form';
import { PasskeyList } from '@/components/account/passkey-list';
import { RequestAccessForm } from '@/components/account/request-access-form';
import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
import { formText, optionalFormText } from '@/components/forms/form-data';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { parseAccessRequestFields } from '@/domain/member/access-request';
import { displayNameSchema, parseDisplayName } from '@/domain/member/member';
import { settings } from '@/lib/settings';

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
			nextSteps={`An admin will review it. If it’s approved, you’ll get an invite link to create your account, by email if you gave an address. The link works for ${settings.accounts.inviteLifetimeDays} days.`}
		/>
	);
}

function SampleDisplayNameForm({ displayName }: { displayName: string }) {
	return <DisplayNameForm displayName={displayName} action={saveName} />;
}

// Checks a new name as the server does, and renames and removes passkeys in the list as the account
// page would; reloading restores them.
function SamplePasskeyList({
	passkeys: initialPasskeys,
}: {
	passkeys: ComponentProps<typeof PasskeyList>['passkeys'];
}) {
	const [passkeys, setPasskeys] = useState(initialPasskeys);

	const renamePasskey: FormAction = async (_state, formData) => {
		const id = formText(formData, passkeyFieldNames.id);
		const name = displayNameSchema.safeParse(formText(formData, passkeyFieldNames.name));
		if (!name.success) {
			return standIn<FormState>({
				status: 'error',
				fieldErrors: { [passkeyFieldNames.name]: name.error.issues[0]?.message },
			});
		}

		await standIn(null);
		setPasskeys((current) =>
			current.map((passkey) => (passkey.id === id ? { ...passkey, name: name.data } : passkey))
		);
		return { status: 'success' };
	};

	const removePasskey: FormAction = async (_state, formData) => {
		const id = formText(formData, passkeyFieldNames.id);
		await standIn(null);
		setPasskeys((current) => current.filter((passkey) => passkey.id !== id));
		return { status: 'success' };
	};

	return (
		<PasskeyList passkeys={passkeys} renamePasskey={renamePasskey} removePasskey={removePasskey} />
	);
}

export { SampleDisplayNameForm, SamplePasskeyList, SampleRequestAccessForm };
