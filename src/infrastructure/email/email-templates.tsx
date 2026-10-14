import 'server-only';
import type { EmailData, EmailKind } from '@/application/ports/email-sender';
import {
	EmailAction,
	EmailCode,
	EmailText,
	type EmailParts,
} from '@/infrastructure/email/email-layout';
import { formatDate } from '@/lib/dates';
import { siteName } from '@/lib/site';

type EmailTemplate<Data> = (data: Data) => EmailParts;

// One template for each kind, so a new kind does not compile until it has one.
export const emailTemplates: { [Kind in EmailKind]: EmailTemplate<EmailData[Kind]> } = {
	'sign-in-code': ({ code, lifetimeMinutes }) => ({
		subject: `${code} is your ${siteName} sign-in code`,
		preview: `It expires in ${lifetimeMinutes} minutes.`,
		heading: 'Your sign-in code',
		body: (
			<>
				<EmailText>Enter this code to sign in to {siteName}:</EmailText>
				<EmailCode code={code} />
				<EmailText>It expires in {lifetimeMinutes} minutes.</EmailText>
			</>
		),
		footer: `You’re getting this email because someone asked to sign in to ${siteName} with this address. If you didn’t ask for a code, you can ignore this email.`,
	}),
	invite: ({ inviteeName, inviterName, link, expiresAt }) => ({
		subject: `${inviterName} invited you to ${siteName}`,
		preview: 'Create your account to add recipes to the shared collection.',
		heading: 'You’re invited',
		body: (
			<>
				<EmailText>Hi {inviteeName},</EmailText>
				<EmailText>
					{inviterName} invited you to {siteName}, where you can add recipes to the shared
					collection.
				</EmailText>
				<EmailAction href={link} label="Create your account" />
				<EmailText>
					The link works once and expires on {formatDate(expiresAt)}. To reach {inviterName}, reply
					to this email.
				</EmailText>
			</>
		),
		footer: `You’re getting this email because ${inviterName} invited this address to ${siteName}.`,
	}),
	'access-request': ({ requesterName, reviewLink }) => ({
		subject: 'New access request',
		preview: `${requesterName} asked for access to ${siteName}.`,
		heading: 'New access request',
		body: (
			<>
				<EmailText>
					{requesterName} asked for access to {siteName}.
				</EmailText>
				<EmailAction href={reviewLink} label="Review the request" />
			</>
		),
		footer: `You’re getting this email because you’re an admin of ${siteName}.`,
	}),
};
