import { AccountDetailsSkeleton } from '@/components/account/account-details';
import { PasskeyListSkeleton } from '@/components/account/passkey-list';
import { StaleSessionAlert } from '@/components/account/passkey-manager';
import { AdminDashboardSkeleton } from '@/components/admin/admin-dashboard';
import type { IssuedInvite } from '@/components/admin/admin-forms';
import { AdminOnlyEmptyState } from '@/components/admin/admin-only-empty-state';
import { IssuedInviteNotice } from '@/components/admin/issued-invite-notice';
import { SignInFormSkeleton } from '@/components/auth/sign-in-form';
import { sampleInviteLink } from '@/components/design-reference/fixtures';
import { PendingSiteMenu } from '@/components/design-reference/pending-site-menu';
import {
	ReferenceSubsection,
	ReferenceSubsectionNav,
	Specimen,
} from '@/components/design-reference/reference-section';
import {
	sampleAccessRequests,
	sampleHeaderAdmin,
	sampleHeaderMember,
	sampleInviteeEmail,
	sampleInvitePreview,
	sampleMembers,
	sampleOpenInvites,
	samplePasskeys,
} from '@/components/design-reference/sample-access-dtos';
import {
	SampleDisplayNameForm,
	SamplePasskeyList,
	SampleRequestAccessForm,
} from '@/components/design-reference/sample-account-forms';
import { SampleAdminDashboard } from '@/components/design-reference/sample-admin-dashboard';
import { SampleInviteSteps, SampleSignIn } from '@/components/design-reference/sample-auth-flows';
import { sampleContributor } from '@/components/design-reference/sample-recipe-dtos';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { TextField } from '@/components/forms/text-field';
import { HeaderAccountGroup } from '@/components/layout/header-account';
import { PageContainer } from '@/components/layout/page-container';
import { SiteMenu } from '@/components/layout/site-menu';

// The notice an admin sees once after issuing an invite, in each delivery state.
const issuedInviteStates: readonly { label: string; invite: IssuedInvite }[] = [
	{
		label: 'Not emailed',
		invite: { displayName: 'Theo', link: sampleInviteLink, delivery: { status: 'not-requested' } },
	},
	{
		label: 'Emailed',
		invite: {
			displayName: 'Casey',
			link: sampleInviteLink,
			delivery: { status: 'sent', to: 'casey@example.com' },
		},
	},
	{
		label: 'Email failed',
		invite: {
			displayName: 'Casey',
			link: sampleInviteLink,
			delivery: { status: 'failed', to: 'casey@example.com' },
		},
	},
];

// One entry per page or control that accounts and admin added, in the order a visitor meets them.
const subsections = [
	{
		id: 'form-feedback',
		title: 'Form fields and feedback',
		description:
			'What every account and admin form is built from: a labeled field tied to its description and error, an alert for a problem with the whole form, and a status line for a confirmation.',
		Content: FormFeedbackSpecimen,
	},
	{
		id: 'header-account',
		title: 'Header account controls',
		description:
			'From md, the theme menu beside Sign in or the account menu, 8 px apart in a box as wide as they are with Sign in, so a member’s spare width falls to the theme menu’s left. The account menu’s button shows the member’s initial, and the menu holds only the account. Below md, one menu holds the sections (Admin last, for admins), the account items, and the theme. Sign out in these menus is real: it signs this browser out.',
		Content: HeaderAccountSpecimen,
	},
	{
		id: 'request-access',
		title: 'Request access',
		description:
			'The public form for asking for an account. Sent empty, it shows the field errors; with a name and how you know us, it shows the sent notice. Reload the page to see the form again.',
		Content: RequestAccessSpecimen,
	},
	{
		id: 'sign-in',
		title: 'Sign in',
		description:
			'An email code first, with a passkey below. Here any well-formed address gets a code, no code signs in, Send a new code shows its notice, and a passkey sign-in always ends as if its dialog were closed.',
		Content: SignInSpecimen,
	},
	{
		id: 'invite',
		title: 'Accept an invite',
		description:
			'One step at a time. Choose a step, or move through them with each step’s buttons: here any well-formed address gets a code, any code creates the account, and creating a passkey succeeds. Each step’s heading is an h4 here.',
		Content: InviteStepsSpecimen,
	},
	{
		id: 'account',
		title: 'Account',
		description:
			'Parts of the account page. A name is checked as the account page checks it, and removing a passkey shows its waiting state but removes nothing.',
		Content: AccountDetailsSpecimen,
	},
	{
		id: 'admin',
		title: 'Admin',
		description:
			'The admin page as Avery sees it, in three tabs with their counts, its headings from h4 here. Approving, declining, revoking, inviting, and making or removing admins change the lists and counts as the page does, and reloading restores them. Each new invite shows its notice once; below are the notices for each delivery state.',
		Content: AdminSpecimen,
	},
] as const;

function FormFeedbackSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="TextField with a description">
				<TextField
					id="design-text-field"
					label="Display name"
					defaultValue={sampleContributor.displayName}
					description="Shown beside recipes you add."
				/>
			</Specimen>
			<Specimen label="TextField with an error">
				<TextField id="design-text-field-invalid" label="Name" required error="Enter some text." />
			</Specimen>
			<Specimen label="FormErrorAlert: a problem with the whole form">
				<FormErrorAlert message="That request was already handled. Reload the page to see the latest." />
			</Specimen>
			<Specimen label="FormStatusMessage: a confirmation, announced as it appears">
				<FormStatusMessage kind="confirmation" message="Saved." />
			</Specimen>
			<Specimen label="FormStatusMessage: progress, with no check">
				<FormStatusMessage kind="progress" message="Reading the page…" />
			</Specimen>
		</div>
	);
}

function HeaderAccountSpecimen() {
	return (
		<div className="grid gap-6 lg:grid-cols-3">
			<Specimen label="From md, signed out" figureClassName="max-md:hidden">
				<HeaderAccountGroup member={Promise.resolve(null)} />
			</Specimen>
			<Specimen label="From md, member" figureClassName="max-md:hidden">
				<HeaderAccountGroup member={Promise.resolve(sampleHeaderMember)} />
			</Specimen>
			<Specimen label="From md, admin" figureClassName="max-md:hidden">
				<HeaderAccountGroup member={Promise.resolve(sampleHeaderAdmin)} />
			</Specimen>
			<Specimen
				label="Below md, the phone menu: signed out, member, admin, and before the session resolves"
				figureClassName="lg:col-span-3"
			>
				<div className="flex gap-3">
					<SiteMenu member={Promise.resolve(null)} />
					<SiteMenu member={Promise.resolve(sampleHeaderMember)} />
					<SiteMenu member={Promise.resolve(sampleHeaderAdmin)} />
					<PendingSiteMenu />
				</div>
			</Specimen>
		</div>
	);
}

function RequestAccessSpecimen() {
	return (
		<Specimen className="px-0 py-10 sm:py-14">
			<PageContainer width="reading">
				<SampleRequestAccessForm />
			</PageContainer>
		</Specimen>
	);
}

function SignInSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="Email step" className="px-0 py-10 sm:py-14">
				<PageContainer width="reading">
					<SampleSignIn idPrefix="design-sign-in" />
				</PageContainer>
			</Specimen>
			<Specimen
				label="Code step, after the passkey dialog was closed"
				className="px-0 py-10 sm:py-14"
			>
				<PageContainer width="reading">
					<SampleSignIn
						idPrefix="design-sign-in-code-step"
						codeSentTo={sampleContributor.email}
						passkeyDialogClosed
					/>
				</PageContainer>
			</Specimen>
			<Specimen label="Loading" className="px-0 py-10 sm:py-14">
				<PageContainer width="reading">
					<SignInFormSkeleton />
				</PageContainer>
			</Specimen>
		</div>
	);
}

function InviteStepsSpecimen() {
	return (
		<SampleInviteSteps
			preview={sampleInvitePreview}
			inviteeEmail={sampleInviteeEmail}
			signedInAs={sampleContributor.displayName}
		/>
	);
}

function AccountDetailsSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="Display name">
				<SampleDisplayNameForm displayName={sampleContributor.displayName} />
			</Specimen>
			<Specimen label="Passkeys">
				<SamplePasskeyList passkeys={samplePasskeys} />
			</Specimen>
			<Specimen label="No passkeys yet">
				<SamplePasskeyList passkeys={[]} />
			</Specimen>
			<Specimen label="Adding a passkey a day or more after signing in">
				<StaleSessionAlert />
			</Specimen>
			<Specimen label="Passkeys, loading">
				<PasskeyListSkeleton />
			</Specimen>
			<Specimen label="The account page, loading">
				<AccountDetailsSkeleton />
			</Specimen>
		</div>
	);
}

function AdminSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen className="px-0 py-10 sm:py-14">
				<PageContainer width="reading">
					<SampleAdminDashboard
						requests={sampleAccessRequests}
						invites={sampleOpenInvites}
						members={sampleMembers}
					/>
				</PageContainer>
			</Specimen>
			<div className="grid gap-6 lg:grid-cols-3">
				{issuedInviteStates.map(({ label, invite }) => (
					<Specimen key={label} label={`Issued invite: ${label}`} frame="bare">
						<IssuedInviteNotice invite={invite} />
					</Specimen>
				))}
			</div>
			<div className="grid gap-6 md:grid-cols-2">
				<Specimen label="For a member who isn’t an admin" frame="bare">
					<AdminOnlyEmptyState />
				</Specimen>
				<Specimen label="Loading">
					<AdminDashboardSkeleton />
				</Specimen>
			</div>
		</div>
	);
}

function AccountSpecimens() {
	return (
		<div className="flex flex-col gap-16">
			<ReferenceSubsectionNav label="Accounts and admin" subsections={subsections} />
			{subsections.map(({ id, title, description, Content }) => (
				<ReferenceSubsection key={id} id={id} title={title} description={description}>
					<Content />
				</ReferenceSubsection>
			))}
		</div>
	);
}

export { AccountSpecimens };
