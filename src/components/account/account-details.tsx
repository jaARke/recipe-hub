import { DisplayNameForm } from '@/components/account/display-name-form';
import { PasskeyManager } from '@/components/account/passkey-manager';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { FormActions } from '@/components/forms/form-actions';
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
			{/* Save ends its section, so it reads as the name's and not the address's. */}
			<PageSection id="account-profile" title="Profile">
				<dl className="flex flex-col gap-2">
					<dt className="text-sm font-medium">Email</dt>
					<dd>{email}</dd>
					<dd className="text-sm text-muted-foreground">Sign-in codes are sent to this address.</dd>
				</dl>
				<DisplayNameForm displayName={displayName} action={renameAction} />
			</PageSection>
			<PasskeyManager />
			<PageSection
				id="account-sign-out"
				title="Sign out"
				description="This signs you out on this device. You stay signed in on any others."
			>
				<FormActions>
					<SignOutButton destination={recipeListPath} />
				</FormActions>
			</PageSection>
		</>
	);
}

// Mirrors the first two sections, each ruled off like the page's.
function AccountDetailsSkeleton() {
	return (
		<div role="status" aria-live="polite" className="flex flex-col gap-8">
			<span className="sr-only">Loading your account</span>
			<div className="flex flex-col gap-4 border-t pt-8">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-5 w-12" />
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-5 w-28" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-28" />
			</div>
			<div className="flex flex-col gap-4 border-t pt-8">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-5 w-full" />
				<Skeleton className="h-14 w-full" />
			</div>
		</div>
	);
}

export { AccountDetails, AccountDetailsSkeleton };
