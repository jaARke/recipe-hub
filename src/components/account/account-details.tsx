import { DisplayNameForm } from '@/components/account/display-name-form';
import { PasskeyManager } from '@/components/account/passkey-manager';
import { SignOutButton } from '@/components/auth/sign-out-button';
import type { FormAction } from '@/components/forms/form-state';
import { PageSection } from '@/components/layout/page-section';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { Skeleton } from '@/components/ui/skeleton';

type AccountDetailsProps = {
	displayName: string;
	email: string;
	renameAction: FormAction;
};

function AccountDetails({ displayName, email, renameAction }: AccountDetailsProps) {
	return (
		<>
			<PageSection id="account-profile" title="Profile">
				<DisplayNameForm displayName={displayName} action={renameAction} />
				<dl className="flex flex-col gap-2">
					<dt className="text-sm font-medium">Email</dt>
					<dd>{email}</dd>
					<dd className="text-sm text-muted-foreground">Sign-in codes are sent to this address.</dd>
				</dl>
			</PageSection>
			<PageSection id="account-passkeys" title="Passkeys">
				<p className="text-muted-foreground">
					A passkey lets you sign in with your face, fingerprint, or screen lock instead of an email
					code. Don&apos;t add one on a device other people use.
				</p>
				<PasskeyManager />
			</PageSection>
			<PageSection id="account-sign-out" title="Sign out">
				<p className="text-muted-foreground">
					This signs you out on this device. You stay signed in on any others.
				</p>
				<div>
					<SignOutButton destination={recipeListPath} />
				</div>
			</PageSection>
		</>
	);
}

function AccountDetailsSkeleton() {
	return (
		<div role="status" className="flex flex-col gap-8">
			<span className="sr-only">Loading your account</span>
			<div className="flex flex-col gap-4">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-5 w-28" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-28 self-end" />
			</div>
			<div className="flex flex-col gap-4">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-5 w-full" />
				<Skeleton className="h-14 w-full" />
			</div>
		</div>
	);
}

export { AccountDetails, AccountDetailsSkeleton };
