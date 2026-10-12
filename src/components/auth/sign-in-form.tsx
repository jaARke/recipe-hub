'use client';

import { KeyRoundIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { authClient } from '@/components/auth/auth-client';
import {
	isPasskeyCancellation,
	passkeySignInErrorMessage,
	settleAuthCall,
	type AuthClientError,
} from '@/components/auth/auth-errors';
import { authFieldNames } from '@/components/auth/auth-forms';
import { ConfirmCodeForm, RequestCodeForm } from '@/components/auth/email-code-forms';
import { requestSignInCode, signInWithCode } from '@/components/auth/email-codes';
import { formText } from '@/components/forms/form-data';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { useFocusOnChange } from '@/components/forms/use-focus-on-change';
import { Button } from '@/components/ui/button';
import { FieldSeparator } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

const fieldIds = {
	email: 'sign-in-email',
	code: 'sign-in-code',
	passkeyNote: 'sign-in-passkey-note',
};

type SignInFormProps = {
	// Where to go once signed in, already checked to be a path on this site.
	next: string;
	codeLifetimeMinutes: number;
};

type SignInPasskeyOptionProps = {
	noteId: string;
	error: string | undefined;
	pending: boolean;
	onSignIn: () => void;
};

async function canAutofillPasskeys(): Promise<boolean> {
	return (
		typeof PublicKeyCredential !== 'undefined' &&
		typeof PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
		PublicKeyCredential.isConditionalMediationAvailable()
	);
}

// Null where the browser can't offer passkeys in the email field's autofill.
type PasskeyAutofillResult = { error: AuthClientError | null } | null;

// Resolves once the visitor picks a saved passkey from the email field's autofill, or the request
// ends.
async function signInWithPasskeyAutofill(): Promise<PasskeyAutofillResult> {
	if (!(await canAutofillPasskeys())) {
		return null;
	}
	return settleAuthCall(authClient.signIn.passkey({ autoFill: true }));
}

// The passkey alternative below the email code; the caller makes the passkey request.
function SignInPasskeyOption({ noteId, error, pending, onSignIn }: SignInPasskeyOptionProps) {
	return (
		<div className="flex flex-col gap-4">
			<FormErrorAlert message={error} />
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<p id={noteId} className="text-sm text-muted-foreground">
					Use your face, fingerprint, or screen lock.
				</p>
				<Button
					type="button"
					variant="outline"
					disabled={pending}
					focusableWhenDisabled
					aria-describedby={noteId}
					onClick={onSignIn}
				>
					{pending ? (
						<Spinner data-icon="inline-start" />
					) : (
						<KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
					)}
					{pending ? 'Signing in' : 'Sign in with a passkey'}
				</Button>
			</div>
		</div>
	);
}

// An email code first, with a passkey offered below and in the email field's autofill.
function SignInForm({ next, codeLifetimeMinutes }: SignInFormProps) {
	const router = useRouter();
	// Null while asking for the address; then the address the code went to.
	const [email, setEmail] = React.useState<string | null>(null);
	const [lastEmail, setLastEmail] = React.useState<string>();
	const [passkeyError, setPasskeyError] = React.useState<string>();
	const [passkeyPending, startPasskey] = React.useTransition();
	useFocusOnChange(
		email === null ? 'email' : 'code',
		email === null ? fieldIds.email : fieldIds.code
	);

	// The header and the destination render for the new session.
	function finishSignIn() {
		router.push(next);
		router.refresh();
	}

	// A newer passkey request cancels the autofill's, which is expected and stays quiet.
	function handleAutofillResult(result: PasskeyAutofillResult) {
		if (result === null) {
			return;
		}
		if (result.error === null) {
			finishSignIn();
		} else if (!isPasskeyCancellation(result.error)) {
			setPasskeyError(passkeySignInErrorMessage(result.error));
		}
	}

	function offerPasskeyAutofill() {
		void signInWithPasskeyAutofill().then(handleAutofillResult);
	}

	const onAutofillResult = React.useEffectEvent(handleAutofillResult);

	React.useEffect(() => {
		void signInWithPasskeyAutofill().then(onAutofillResult);
	}, []);

	// Started straight from the click, since Safari only opens the passkey dialog for a user gesture.
	function signInWithPasskey() {
		setPasskeyError(undefined);
		startPasskey(async () => {
			const { error } = await settleAuthCall(authClient.signIn.passkey({ autoFill: false }));
			if (error === null) {
				finishSignIn();
				return;
			}
			setPasskeyError(passkeySignInErrorMessage(error));
			offerPasskeyAutofill();
		});
	}

	const requestCode: FormAction = async (_state, formData) => {
		const address = formText(formData, authFieldNames.email);
		const result = await requestSignInCode(address);
		if (result.status === 'success') {
			setLastEmail(address);
			setEmail(address);
		}
		return result;
	};

	const confirmCode: FormAction = async (_state, formData) => {
		const result = await signInWithCode(email ?? '', formText(formData, authFieldNames.code));
		if (result.status === 'success') {
			finishSignIn();
		}
		return result;
	};

	return (
		<div className="flex flex-col gap-8">
			{email === null ? (
				<RequestCodeForm
					id={fieldIds.email}
					autoComplete="username webauthn"
					defaultEmail={lastEmail}
					action={requestCode}
				/>
			) : (
				<ConfirmCodeForm
					id={fieldIds.code}
					description={`If ${email} has an account, we sent it a sign-in code. The code works for ${codeLifetimeMinutes} minutes.`}
					submitLabel="Sign in"
					pendingLabel="Signing in"
					action={confirmCode}
					sendNewCode={() => requestSignInCode(email)}
					onChangeEmail={() => setEmail(null)}
				/>
			)}
			<FieldSeparator>or</FieldSeparator>
			<SignInPasskeyOption
				noteId={fieldIds.passkeyNote}
				error={passkeyError}
				pending={passkeyPending}
				onSignIn={signInWithPasskey}
			/>
		</div>
	);
}

function SignInFormSkeleton() {
	return (
		<div role="status" className="flex flex-col gap-8">
			<span className="sr-only">Loading sign-in</span>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-12" />
				<Skeleton className="h-9 w-full" />
			</div>
			<Skeleton className="h-9 w-36 self-end" />
			<Skeleton className="h-5 w-full" />
			<Skeleton className="h-9 w-48 self-end" />
		</div>
	);
}

export { SignInForm, SignInFormSkeleton, SignInPasskeyOption };
