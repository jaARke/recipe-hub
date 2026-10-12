'use client';

import { InfoIcon, KeyRoundIcon } from 'lucide-react';
import * as React from 'react';
import { PasskeyList, PasskeyListSkeleton } from '@/components/account/passkey-list';
import { authClient } from '@/components/auth/auth-client';
import {
	isStaleSessionError,
	passkeyRegistrationErrorMessage,
	passkeyRemovalErrorMessage,
	settleAuthCall,
} from '@/components/auth/auth-errors';
import { accountPath, signInHref } from '@/components/auth/auth-paths';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { TextLink } from '@/components/layout/text-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const addButtonId = 'account-add-passkey';

type PasskeyOutcome =
	| { kind: 'added' }
	| { kind: 'removed' }
	| { kind: 'failed'; message: string }
	// Adding a passkey needs a recent sign-in.
	| { kind: 'stale-session' };

const outcomeMessages = {
	added: 'Passkey added. Next time, you can sign in with it.',
	removed: 'Passkey removed.',
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

// Lists, adds, and removes the member's passkeys through the auth endpoint.
function PasskeyManager() {
	const { data: passkeys, error: listError, isPending, refetch } = authClient.useListPasskeys();
	const [outcome, setOutcome] = React.useState<PasskeyOutcome>();
	const [adding, startAdding] = React.useTransition();
	const [removingId, setRemovingId] = React.useState<string>();

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

	// The removed row's button leaves with it, so focus moves to the add button.
	async function removePasskey(id: string) {
		setOutcome(undefined);
		setRemovingId(id);
		const { error } = await settleAuthCall(authClient.passkey.deletePasskey({ id }));
		if (error !== null) {
			setRemovingId(undefined);
			setOutcome({ kind: 'failed', message: passkeyRemovalErrorMessage(error) });
			return;
		}
		// The list reloads on its own once a passkey is removed.
		setOutcome({ kind: 'removed' });
		document.getElementById(addButtonId)?.focus();
	}

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
			<PasskeyList passkeys={passkeys ?? []} removingId={removingId} onRemove={removePasskey} />
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{list}
			{outcome?.kind === 'stale-session' && <StaleSessionAlert />}
			<FormErrorAlert message={outcome?.kind === 'failed' ? outcome.message : undefined} />
			<FormStatusMessage
				message={
					outcome?.kind === 'added' || outcome?.kind === 'removed'
						? outcomeMessages[outcome.kind]
						: undefined
				}
			/>
			<div>
				<Button
					id={addButtonId}
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
		</div>
	);
}

export { PasskeyManager, StaleSessionAlert };
