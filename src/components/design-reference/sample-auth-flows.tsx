'use client';

import { useState, useTransition } from 'react';
import type { InvitePreviewDto } from '@/application/access/access-dtos';
import {
	codeSignInError,
	passkeySignInErrorMessage,
	type AuthClientError,
} from '@/components/auth/auth-errors';
import { authFieldNames } from '@/components/auth/auth-forms';
import { ConfirmCodeForm, RequestCodeForm } from '@/components/auth/email-code-forms';
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
} from '@/components/auth/invite-steps';
import { SignInPasskeyOption } from '@/components/auth/sign-in-form';
import { Specimen } from '@/components/design-reference/reference-section';
import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
import { formText } from '@/components/forms/form-data';
import type { FormAction, FormError, FormState } from '@/components/forms/form-state';
import { useFocusOnChange } from '@/components/forms/use-focus-on-change';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldSeparator } from '@/components/ui/field';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { parseInviteEmail } from '@/domain/member/invite';
import { settings } from '@/lib/settings';

// What the auth client reports when the passkey dialog is closed, and for a wrong code.
const closedPasskeyDialog: AuthClientError = { code: 'AUTH_CANCELLED', status: 400 };
const wrongCode: AuthClientError = { code: 'INVALID_OTP', status: 400 };

const inviteSteps = [
	{ value: 'loading', label: 'Loading' },
	{ value: 'welcome', label: 'Welcome' },
	{ value: 'email', label: 'Email' },
	{ value: 'code', label: 'Code' },
	{ value: 'passkey', label: 'Passkey offer' },
	{ value: 'passkey-failed', label: 'Passkey not created' },
	{ value: 'done-with-passkey', label: 'Done, with a passkey' },
	{ value: 'done', label: 'Done, without a passkey' },
	{ value: 'done-existing', label: 'Done, with an existing account' },
	{ value: 'load-failed', label: "Couldn't load" },
	{ value: 'complete-failed', label: "Couldn't finish" },
	{ value: 'unavailable', label: 'Unavailable' },
	{ value: 'signed-in', label: 'Already signed in' },
] as const;

type SampleInviteStep = (typeof inviteSteps)[number]['value'];

// Each move made from inside a step counts, so focus follows it as on the invite page; choosing a
// step from the list leaves focus on the list.
type SampleInviteView = {
	step: SampleInviteStep;
	moves: number;
};

const inviteFieldIds = {
	picker: 'design-invite-step',
	email: 'design-invite-email',
	code: 'design-invite-code',
};

// Nests each step under the design reference's own headings.
const inviteHeadingLevel = 4;

const sendNewCode = () => standIn<FormState>({ status: 'success' });

// Refuses a blank or malformed address with the domain's copy, as the invite page does; the sign-in
// page words only a blank one differently.
function emailProblems(email: string): FormError | undefined {
	return inputProblems(() => parseInviteEmail(email));
}

function focusTargetId(step: SampleInviteStep): string {
	switch (step) {
		case 'email':
			return inviteFieldIds.email;
		case 'code':
			return inviteFieldIds.code;
		default:
			return inviteStepHeadingId;
	}
}

type SampleSignInProps = {
	idPrefix: string;
	// Starts on the code step, as after a code was sent to this address.
	codeSentTo?: string;
	// Starts with the error a closed passkey dialog leaves.
	passkeyDialogClosed?: boolean;
};

// The sign-in page's steps with stand-ins for its auth calls: any well-formed address gets a code,
// no code signs in, and a passkey sign-in always ends as if its dialog were closed.
function SampleSignIn({ idPrefix, codeSentTo, passkeyDialogClosed = false }: SampleSignInProps) {
	const ids = {
		email: `${idPrefix}-email`,
		code: `${idPrefix}-code`,
		passkeyNote: `${idPrefix}-passkey-note`,
	};
	const [email, setEmail] = useState(codeSentTo ?? null);
	const [lastEmail, setLastEmail] = useState(codeSentTo);
	const [passkeyError, setPasskeyError] = useState(
		passkeyDialogClosed ? passkeySignInErrorMessage(closedPasskeyDialog) : undefined
	);
	const [passkeyPending, startPasskey] = useTransition();
	useFocusOnChange(email === null ? 'email' : 'code', email === null ? ids.email : ids.code);

	function signInWithPasskey() {
		setPasskeyError(undefined);
		startPasskey(async () => {
			setPasskeyError(passkeySignInErrorMessage(await standIn(closedPasskeyDialog)));
		});
	}

	const requestCode: FormAction = async (_state, formData) => {
		const address = formText(formData, authFieldNames.email);
		const result = await standIn<FormState>(emailProblems(address) ?? { status: 'success' });
		if (result.status === 'success') {
			setLastEmail(address);
			setEmail(address);
		}
		return result;
	};

	const refuseCode: FormAction = () => standIn(codeSignInError(wrongCode));

	return (
		<div className="flex flex-col gap-8">
			{email === null ? (
				<RequestCodeForm
					id={ids.email}
					autoComplete="username webauthn"
					defaultEmail={lastEmail}
					action={requestCode}
				/>
			) : (
				<ConfirmCodeForm
					id={ids.code}
					description={`If ${email} has an account, we sent it a sign-in code. The code works for ${settings.accounts.signInCodeLifetimeMinutes} minutes.`}
					submitLabel="Sign in"
					pendingLabel="Signing in"
					action={refuseCode}
					sendNewCode={sendNewCode}
					onChangeEmail={() => setEmail(null)}
				/>
			)}
			<FieldSeparator>or</FieldSeparator>
			<SignInPasskeyOption
				noteId={ids.passkeyNote}
				error={passkeyError}
				pending={passkeyPending}
				onSignIn={signInWithPasskey}
			/>
		</div>
	);
}

type SampleInviteStepsProps = {
	preview: InvitePreviewDto;
	// The address shown on the code step when it is chosen directly.
	inviteeEmail: string;
	signedInAs: string;
};

// The invite page's steps, one at a time, with stand-ins for its actions and auth calls: any
// well-formed address gets a code, any code creates the account, and creating a passkey succeeds.
function SampleInviteSteps({ preview, inviteeEmail, signedInAs }: SampleInviteStepsProps) {
	const [view, setView] = useState<SampleInviteView>({ step: 'welcome', moves: 0 });
	const [email, setEmail] = useState<string>();
	const [creatingPasskey, startCreatingPasskey] = useTransition();
	useFocusOnChange(String(view.moves), focusTargetId(view.step));

	function moveTo(step: SampleInviteStep) {
		setView(({ moves }) => ({ step, moves: moves + 1 }));
	}

	const requestCode: FormAction = async (_state, formData) => {
		const address = formText(formData, authFieldNames.email);
		const result = await standIn<FormState>(emailProblems(address) ?? { status: 'success' });
		if (result.status === 'success') {
			setEmail(address);
			moveTo('code');
		}
		return result;
	};

	const createAccount: FormAction = async () => {
		const result = await standIn<FormState>({ status: 'success' });
		moveTo('passkey');
		return result;
	};

	function createPasskey() {
		startCreatingPasskey(async () => {
			await standIn(null);
			moveTo('done-with-passkey');
		});
	}

	function stepContent() {
		switch (view.step) {
			case 'loading':
				return <InviteFlowSkeleton />;
			case 'welcome':
				return (
					<InviteWelcome
						preview={preview}
						headingLevel={inviteHeadingLevel}
						onContinue={() => moveTo('email')}
					/>
				);
			case 'email':
				return (
					<InviteEmailStep headingLevel={inviteHeadingLevel}>
						<RequestCodeForm
							id={inviteFieldIds.email}
							autoComplete="email"
							description="We'll send a code to this address. It's also the address you'll sign in with."
							defaultEmail={email}
							action={requestCode}
						/>
					</InviteEmailStep>
				);
			case 'code':
				return (
					<InviteCodeStep headingLevel={inviteHeadingLevel}>
						<ConfirmCodeForm
							id={inviteFieldIds.code}
							description={`We sent a code to ${email ?? inviteeEmail}. It works for ${settings.accounts.signInCodeLifetimeMinutes} minutes.`}
							submitLabel="Create account"
							pendingLabel="Creating account"
							action={createAccount}
							sendNewCode={sendNewCode}
							onChangeEmail={() => moveTo('email')}
						/>
					</InviteCodeStep>
				);
			case 'passkey':
			case 'passkey-failed':
				return (
					<InvitePasskeyOffer
						failed={view.step === 'passkey-failed'}
						pending={creatingPasskey}
						headingLevel={inviteHeadingLevel}
						onCreate={createPasskey}
						onSkip={() => moveTo('done')}
					/>
				);
			case 'done-with-passkey':
				return <InviteDone outcome="created-with-passkey" headingLevel={inviteHeadingLevel} />;
			case 'done':
				return <InviteDone outcome="created" headingLevel={inviteHeadingLevel} />;
			case 'done-existing':
				return <InviteDone outcome="existing" headingLevel={inviteHeadingLevel} />;
			case 'load-failed':
				return (
					<InviteLoadFailed headingLevel={inviteHeadingLevel} onRetry={() => moveTo('welcome')} />
				);
			case 'complete-failed':
				return (
					<InviteCompleteFailed
						headingLevel={inviteHeadingLevel}
						onRetry={() => moveTo('passkey')}
					/>
				);
			case 'unavailable':
				return <InviteUnavailable headingLevel={inviteHeadingLevel} />;
			case 'signed-in':
				return (
					<InviteSignedIn
						displayName={signedInAs}
						headingLevel={inviteHeadingLevel}
						// Stands in for SignOutButton, which signs out through the auth client.
						signOutButton={
							<Button type="button" variant="outline" onClick={() => moveTo('welcome')}>
								Sign out
							</Button>
						}
					/>
				);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<Field className="max-w-xs">
				<FieldLabel htmlFor={inviteFieldIds.picker}>Step</FieldLabel>
				<Select
					items={inviteSteps}
					value={view.step}
					onValueChange={(step) => {
						if (step !== null) {
							setView(({ moves }) => ({ step, moves }));
						}
					}}
				>
					<SelectTrigger id={inviteFieldIds.picker}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{inviteSteps.map((step) => (
							<SelectItem key={step.value} value={step.value}>
								{step.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Specimen className="px-0 py-10 sm:py-14">
				<PageContainer width="reading">{stepContent()}</PageContainer>
			</Specimen>
		</div>
	);
}

export { SampleInviteSteps, SampleSignIn };
