'use client';

import { InfoIcon, KeyRoundIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import type { InvitePreviewDto } from '@/application/access/access-dtos';
import { accountPath, requestAccessPath } from '@/components/auth/auth-paths';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/dates';
import { siteName } from '@/lib/site';

// One step shows at a time, and focus moves to its heading when the step changes.
const inviteStepHeadingId = 'invite-step-heading';

// Keyed by the step heading's level; level 4 nests a step under the design reference's own headings.
const inviteHeadingTags = {
	2: 'h2',
	4: 'h4',
} as const;

type InviteHeadingLevel = keyof typeof inviteHeadingTags;

// Keyed by how the invite ended: a new account, with or without a passkey, or the account the
// invitee already had.
const inviteDoneMessages = {
	'created-with-passkey':
		'Your account and passkey are ready. Next time, sign in with your passkey.',
	created:
		'Your account is ready. Next time, sign in with a code sent to your email. You can add a passkey any time from your account page.',
	existing: 'You already have an account, and you’re signed in.',
} as const;

type InviteOutcome = keyof typeof inviteDoneMessages;

function InviteStepHeading({
	headingLevel,
	children,
}: {
	headingLevel: InviteHeadingLevel;
	children: React.ReactNode;
}) {
	const Heading = inviteHeadingTags[headingLevel];

	return (
		<Heading id={inviteStepHeadingId} tabIndex={-1} className="font-heading text-2xl font-semibold">
			{children}
		</Heading>
	);
}

function InviteStep({ children }: { children: React.ReactNode }) {
	return <div className="flex flex-col gap-6">{children}</div>;
}

function InviteActions({ children }: { children: React.ReactNode }) {
	return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

function InviteWelcome({
	preview,
	headingLevel,
	onContinue,
}: {
	preview: InvitePreviewDto;
	headingLevel: InviteHeadingLevel;
	onContinue: () => void;
}) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>
					Welcome, {preview.displayName}
				</InviteStepHeading>
				<p>
					You’re invited to {siteName}, where members add recipes to the shared collection. Confirm
					your email address to create your account.
				</p>
				<p className="text-muted-foreground">
					This invite expires on{' '}
					<time dateTime={preview.expiresAt.toISOString()}>{formatDate(preview.expiresAt)}</time>.
				</p>
			</div>
			<InviteActions>
				<Button type="button" onClick={onContinue}>
					Get started
				</Button>
			</InviteActions>
		</InviteStep>
	);
}

// The form inside comes from the flow, which knows how to send the code.
function InviteEmailStep({
	headingLevel,
	children,
}: {
	headingLevel: InviteHeadingLevel;
	children: React.ReactNode;
}) {
	return (
		<InviteStep>
			<InviteStepHeading headingLevel={headingLevel}>Confirm your email</InviteStepHeading>
			{children}
		</InviteStep>
	);
}

function InviteCodeStep({
	headingLevel,
	children,
}: {
	headingLevel: InviteHeadingLevel;
	children: React.ReactNode;
}) {
	return (
		<InviteStep>
			<InviteStepHeading headingLevel={headingLevel}>Check your email</InviteStepHeading>
			{children}
		</InviteStep>
	);
}

type InvitePasskeyOfferProps = {
	// Set after the dialog was closed or the passkey couldn't be saved.
	failed: boolean;
	pending: boolean;
	headingLevel: InviteHeadingLevel;
	onCreate: () => void;
	onSkip: () => void;
};

function InvitePasskeyOffer({
	failed,
	pending,
	headingLevel,
	onCreate,
	onSkip,
}: InvitePasskeyOfferProps) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>Create a passkey</InviteStepHeading>
				<p>Your account is ready, and you’re signed in.</p>
				<p>
					{siteName} uses a passkey instead of a password. Your phone or computer keeps it for you,
					and you unlock it the way you unlock your device: face, fingerprint, or screen lock.
				</p>
				<p className="text-muted-foreground">
					Skip this on a device other people use. If you opened this link in an email app, its
					built-in browser may not be able to save a passkey. Open the site in Safari or Chrome
					instead, or add one later from your account page.
				</p>
			</div>
			{failed && (
				<Alert>
					<InfoIcon aria-hidden="true" />
					<AlertTitle>No passkey was created</AlertTitle>
					<AlertDescription>
						You can still sign in with a code sent to your email. Try again, or continue without
						one.
					</AlertDescription>
				</Alert>
			)}
			<InviteActions>
				<Button type="button" variant="outline" onClick={onSkip}>
					Not now
				</Button>
				<Button type="button" disabled={pending} focusableWhenDisabled onClick={onCreate}>
					{pending ? (
						<Spinner data-icon="inline-start" />
					) : (
						<KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
					)}
					{pending ? 'Creating passkey' : 'Create a passkey'}
				</Button>
			</InviteActions>
		</InviteStep>
	);
}

function InviteDone({
	outcome,
	headingLevel,
}: {
	outcome: InviteOutcome;
	headingLevel: InviteHeadingLevel;
}) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>You’re all set</InviteStepHeading>
				<p>{inviteDoneMessages[outcome]}</p>
			</div>
			<InviteActions>
				<Link href={accountPath} className={buttonVariants({ variant: 'outline' })}>
					Go to your account
				</Link>
				<Link href={recipeListPath} className={buttonVariants()}>
					Browse recipes
				</Link>
			</InviteActions>
		</InviteStep>
	);
}

function InviteUnavailable({ headingLevel }: { headingLevel: InviteHeadingLevel }) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>This invite can’t be used</InviteStepHeading>
				<p>
					The link may have expired, been used already, or been copied only in part. Ask the person
					who invited you for a new one, or request access.
				</p>
			</div>
			<InviteActions>
				<Link href={requestAccessPath} className={buttonVariants({ variant: 'outline' })}>
					Request access
				</Link>
			</InviteActions>
		</InviteStep>
	);
}

function InviteLoadFailed({
	headingLevel,
	onRetry,
}: {
	headingLevel: InviteHeadingLevel;
	onRetry: () => void;
}) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>
					We couldn’t load your invite
				</InviteStepHeading>
				<p>Check your connection and try again.</p>
			</div>
			<InviteActions>
				<Button type="button" onClick={onRetry}>
					Try again
				</Button>
			</InviteActions>
		</InviteStep>
	);
}

// The code is spent once it signs the invitee in, so only the invite's check is tried again.
function InviteCompleteFailed({
	headingLevel,
	onRetry,
}: {
	headingLevel: InviteHeadingLevel;
	onRetry: () => void;
}) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>
					We couldn’t finish accepting your invite
				</InviteStepHeading>
				<p>You’re signed in. Check your connection and try again.</p>
			</div>
			<InviteActions>
				<Button type="button" onClick={onRetry}>
					Try again
				</Button>
			</InviteActions>
		</InviteStep>
	);
}

// An invite creates a new account, so a signed-in visitor signs out first.
function InviteSignedIn({
	displayName,
	headingLevel,
	signOutButton,
}: {
	displayName: string;
	headingLevel: InviteHeadingLevel;
	signOutButton: React.ReactNode;
}) {
	return (
		<InviteStep>
			<div className="flex flex-col gap-3">
				<InviteStepHeading headingLevel={headingLevel}>You’re already signed in</InviteStepHeading>
				<p>
					You’re signed in as {displayName}. This invite creates a new account, so sign out first to
					use it.
				</p>
			</div>
			<InviteActions>{signOutButton}</InviteActions>
		</InviteStep>
	);
}

function InviteFlowSkeleton() {
	return (
		<div role="status" aria-live="polite" className="flex flex-col gap-6">
			<span className="sr-only">Loading your invite</span>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-5 w-full" />
				<Skeleton className="h-5 w-48" />
			</div>
			<Skeleton className="h-9 w-28 self-end" />
		</div>
	);
}

export {
	InviteCodeStep,
	InviteCompleteFailed,
	InviteDone,
	InviteEmailStep,
	InviteFlowSkeleton,
	type InviteHeadingLevel,
	inviteStepHeadingId,
	InviteLoadFailed,
	type InviteOutcome,
	InvitePasskeyOffer,
	InviteSignedIn,
	InviteUnavailable,
	InviteWelcome,
};
