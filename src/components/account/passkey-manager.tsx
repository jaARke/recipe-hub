'use client';

import { InfoIcon, KeyRoundIcon } from 'lucide-react';
import * as React from 'react';
import { passkeyFieldNames } from '@/components/account/account-forms';
import { PasskeyList, PasskeyListSkeleton } from '@/components/account/passkey-list';
import { authClient } from '@/components/auth/auth-client';
import {
	isStaleSessionError,
	isUnknownPasskeyError,
	passkeyRegistrationErrorMessage,
	passkeyRemovalErrorMessage,
	passkeyRenameError,
	settleAuthCall,
} from '@/components/auth/auth-errors';
import { accountPath, signInHref } from '@/components/auth/auth-paths';
import { signalUnknownPasskey } from '@/components/auth/signal-unknown-passkey';
import { formText } from '@/components/forms/form-data';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { PageSection } from '@/components/layout/page-section';
import { TextLink } from '@/components/layout/text-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type PasskeyOutcome =
	| { kind: 'added' }
	| { kind: 'renamed' }
	| { kind: 'failed'; message: string }
	// Adding a passkey needs a recent sign-in.
	| { kind: 'stale-session' };

const outcomeMessages = {
	added: 'Passkey added. Next time, you can sign in with it.',
	renamed: 'Passkey renamed.',
} as const;

function StaleSessionAlert() {
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

// The account page's Passkeys section: lists, adds, renames, and removes the member's passkeys
// through the auth endpoint.
function PasskeyManager() {
	const { data: passkeys, error: listError, isPending, refetch } = authClient.useListPasskeys();
	const [outcome, setOutcome] = React.useState<PasskeyOutcome>();
	const [adding, startAdding] = React.useTransition();

	// Started straight from the click, since Safari only opens the passkey dialog for a user gesture.
	function addPasskey() {
		setOutcome(undefined);
		startAdding(async () => {
			const { error } = await settleAuthCall(authClient.passkey.addPasskey());
			if (error === null) {
				setOutcome({ kind: 'added' });
			} else if (isStaleSessionError(error)) {
				setOutcome({ kind: 'stale-session' });
			} else {
				setOutcome({ kind: 'failed', message: passkeyRegistrationErrorMessage(error) });
			}
		});
	}

	// The list reloads on its own once a passkey is renamed or removed.
	const renamePasskey: FormAction = async (_state, formData) => {
		setOutcome(undefined);
		const { error } = await settleAuthCall(
			authClient.passkey.updatePasskey({
				id: formText(formData, passkeyFieldNames.id),
				name: formText(formData, passkeyFieldNames.name),
			})
		);
		if (error !== null) {
			return passkeyRenameError(error);
		}
		setOutcome({ kind: 'renamed' });
		return { status: 'success' };
	};

	// Once the site no longer knows the passkey, the browser is told, so the password manager can stop
	// offering it.
	const removePasskey: FormAction = async (_state, formData) => {
		setOutcome(undefined);
		const id = formText(formData, passkeyFieldNames.id);
		const credentialId = passkeys?.find((passkey) => passkey.id === id)?.credentialID;
		const { error } = await settleAuthCall(authClient.passkey.deletePasskey({ id }));
		if (credentialId !== undefined && (error === null || isUnknownPasskeyError(error))) {
			void signalUnknownPasskey(credentialId);
		}
		if (error !== null) {
			return { status: 'error', message: passkeyRemovalErrorMessage(error), fieldErrors: {} };
		}
		return { status: 'success' };
	};

	let list: React.ReactNode;
	if (isPending) {
		list = <PasskeyListSkeleton />;
	} else if (listError !== null) {
		list = (
			<div className="flex flex-col items-start gap-3">
				<FormErrorAlert message="We couldn't load your passkeys. Check your connection and try again." />
				<Button type="button" variant="outline" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	} else {
		list = (
			<PasskeyList
				passkeys={passkeys ?? []}
				renamePasskey={renamePasskey}
				removePasskey={removePasskey}
			/>
		);
	}

	return (
		<PageSection
			id="account-passkeys"
			title="Passkeys"
			description="A passkey lets you sign in with your face, fingerprint, or screen lock instead of an email code. Don't add one on a device other people use."
			// A removed passkey's row leaves with its dialog, which held focus.
			itemCount={passkeys?.length}
		>
			{list}
			{outcome?.kind === 'stale-session' && <StaleSessionAlert />}
			<FormErrorAlert message={outcome?.kind === 'failed' ? outcome.message : undefined} />
			<FormStatusMessage
				message={
					outcome?.kind === 'added' || outcome?.kind === 'renamed'
						? outcomeMessages[outcome.kind]
						: undefined
				}
			/>
			<div>
				<Button
					type="button"
					variant="outline"
					disabled={adding}
					focusableWhenDisabled
					onClick={addPasskey}
				>
					{adding ? (
						<Spinner data-icon="inline-start" />
					) : (
						<KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
					)}
					{adding ? 'Adding passkey' : 'Add a passkey'}
				</Button>
			</div>
		</PageSection>
	);
}

export { PasskeyManager, StaleSessionAlert };
