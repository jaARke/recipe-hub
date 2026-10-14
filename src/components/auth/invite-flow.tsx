'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { CompletedInviteDto, InvitePreviewDto } from '@/application/access/access-dtos';
import { authClient } from '@/components/auth/auth-client';
import { settleAuthCall } from '@/components/auth/auth-errors';
import { authFieldNames } from '@/components/auth/auth-forms';
import { ConfirmCodeForm, RequestCodeForm } from '@/components/auth/email-code-forms';
import { requestSignInCode, signInWithCode } from '@/components/auth/email-codes';
import {
	InviteCodeStep,
	InviteCompleteFailed,
	InviteDone,
	InviteEmailStep,
	InviteFlowSkeleton,
	InviteLoadFailed,
	InvitePasskeyOffer,
	InviteSignedIn,
	inviteStepHeadingId,
	InviteUnavailable,
	InviteWelcome,
	type InviteHeadingLevel,
	type InviteOutcome,
} from '@/components/auth/invite-steps';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { formText } from '@/components/forms/form-data';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { useFocusOnChange } from '@/components/forms/use-focus-on-change';

const fieldIds = {
	email: 'invite-email',
	code: 'invite-code',
};

type InviteFlowStep =
	| { kind: 'loading' }
	| { kind: 'load-failed' }
	| { kind: 'unavailable' }
	| { kind: 'signed-in'; displayName: string }
	| { kind: 'welcome'; preview: InvitePreviewDto }
	| { kind: 'email' }
	| { kind: 'code'; email: string }
	| { kind: 'complete-failed' }
	| { kind: 'passkey'; failed: boolean }
	| { kind: 'done'; outcome: InviteOutcome };

type InviteFlowProps = {
	// The visitor's name if they were signed in when the page loaded. Only the first render reads
	// it, so the page refreshing after the invitee signs in leaves the flow where it is.
	signedInAs: string | null;
	codeLifetimeMinutes: number;
	headingLevel: InviteHeadingLevel;
	getPreview: (token: string) => Promise<InvitePreviewDto | null>;
	bindEmail: (token: string, email: string) => Promise<FormState<{ email: string }>>;
	complete: (token: string) => Promise<FormState<CompletedInviteDto>>;
};

function focusTargetId(kind: InviteFlowStep['kind']): string {
	switch (kind) {
		case 'email':
			return fieldIds.email;
		case 'code':
			return fieldIds.code;
		default:
			return inviteStepHeadingId;
	}
}

// Reads the token from the fragment, which browsers never send to a server, then drops it from the
// address bar so it isn't left in view.
function takeInviteToken(): string | null {
	const token = window.location.hash.slice(1);
	window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
	return token === '' ? null : token;
}

// Accepting an invite: confirm an email address with a code, which creates the account and signs
// the invitee in, then offer a passkey. An address that already has an account signs in to it.
function InviteFlow({
	signedInAs,
	codeLifetimeMinutes,
	headingLevel,
	getPreview,
	bindEmail,
	complete,
}: InviteFlowProps) {
	const router = useRouter();
	// Undefined until read on mount; null when the link carried none.
	const token = React.useRef<string | null>(undefined);
	const [step, setStep] = React.useState<InviteFlowStep>(() =>
		signedInAs === null ? { kind: 'loading' } : { kind: 'signed-in', displayName: signedInAs }
	);
	const [lastEmail, setLastEmail] = React.useState<string>();
	const [creatingPasskey, startCreatingPasskey] = React.useTransition();
	useFocusOnChange(step.kind, focusTargetId(step.kind));

	async function previewStep(): Promise<InviteFlowStep> {
		if (token.current === null || token.current === undefined) {
			return { kind: 'unavailable' };
		}
		try {
			const preview = await getPreview(token.current);
			return preview === null ? { kind: 'unavailable' } : { kind: 'welcome', preview };
		} catch {
			return { kind: 'load-failed' };
		}
	}

	function loadPreview() {
		setStep({ kind: 'loading' });
		void previewStep().then(setStep);
	}

	// Development runs effects twice, and the fragment is gone after the first read.
	const startInvite = React.useEffectEvent(() => {
		if (token.current !== undefined) {
			return;
		}
		token.current = takeInviteToken();
		if (step.kind === 'loading') {
			void previewStep().then(setStep);
		}
	});

	React.useEffect(() => {
		startInvite();
	}, []);

	const requestCode: FormAction = async (_state, formData) => {
		const bound = await bindEmail(token.current ?? '', formText(formData, authFieldNames.email));
		if (bound.status !== 'success') {
			return bound;
		}
		const sent = await requestSignInCode(bound.email);
		if (sent.status === 'success') {
			setLastEmail(bound.email);
			setStep({ kind: 'code', email: bound.email });
		}
		return sent;
	};

	// Asks whether this invite created the account the code signed in to.
	async function completionStep(): Promise<InviteFlowStep> {
		try {
			const completed = await complete(token.current ?? '');
			if (completed.status !== 'success') {
				return { kind: 'complete-failed' };
			}
			return completed.account === 'created'
				? { kind: 'passkey', failed: false }
				: { kind: 'done', outcome: 'existing' };
		} catch {
			return { kind: 'complete-failed' };
		}
	}

	function retryCompletion() {
		setStep({ kind: 'loading' });
		void completionStep().then(setStep);
	}

	// Signing in with the first code creates the account, unless the address already had one; the
	// header then renders signed in. The code is spent from here on, so failures leave the form.
	async function confirmCode(email: string, formData: FormData): Promise<FormState> {
		const signedIn = await signInWithCode(email, formText(formData, authFieldNames.code));
		if (signedIn.status !== 'success') {
			return signedIn;
		}
		router.refresh();
		setStep(await completionStep());
		return signedIn;
	}

	// Started straight from the click, since Safari only opens the passkey dialog for a user gesture.
	function createPasskey() {
		startCreatingPasskey(async () => {
			const { error } = await settleAuthCall(authClient.passkey.addPasskey());
			setStep(
				error === null
					? { kind: 'done', outcome: 'created-with-passkey' }
					: { kind: 'passkey', failed: true }
			);
		});
	}

	switch (step.kind) {
		case 'loading':
			return <InviteFlowSkeleton />;
		case 'load-failed':
			return <InviteLoadFailed headingLevel={headingLevel} onRetry={loadPreview} />;
		case 'unavailable':
			return <InviteUnavailable headingLevel={headingLevel} />;
		case 'signed-in':
			return (
				<InviteSignedIn
					displayName={step.displayName}
					headingLevel={headingLevel}
					signOutButton={<SignOutButton onSignedOut={loadPreview} />}
				/>
			);
		case 'welcome':
			return (
				<InviteWelcome
					preview={step.preview}
					headingLevel={headingLevel}
					onContinue={() => setStep({ kind: 'email' })}
				/>
			);
		case 'email':
			return (
				<InviteEmailStep headingLevel={headingLevel}>
					<RequestCodeForm
						id={fieldIds.email}
						autoComplete="email"
						description="We’ll send a code to this address. It’s also the address you’ll sign in with."
						defaultEmail={lastEmail}
						action={requestCode}
					/>
				</InviteEmailStep>
			);
		case 'code':
			return (
				<InviteCodeStep headingLevel={headingLevel}>
					<ConfirmCodeForm
						id={fieldIds.code}
						description={`We sent a code to ${step.email}. It works for ${codeLifetimeMinutes} minutes.`}
						submitLabel="Create account"
						pendingLabel="Creating account"
						action={(_state, formData) => confirmCode(step.email, formData)}
						sendNewCode={() => requestSignInCode(step.email)}
						onChangeEmail={() => setStep({ kind: 'email' })}
					/>
				</InviteCodeStep>
			);
		case 'complete-failed':
			return <InviteCompleteFailed headingLevel={headingLevel} onRetry={retryCompletion} />;
		case 'passkey':
			return (
				<InvitePasskeyOffer
					failed={step.failed}
					pending={creatingPasskey}
					headingLevel={headingLevel}
					onCreate={createPasskey}
					onSkip={() => setStep({ kind: 'done', outcome: 'created' })}
				/>
			);
		case 'done':
			return <InviteDone outcome={step.outcome} headingLevel={headingLevel} />;
	}
}

export { InviteFlow };
