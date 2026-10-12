import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { renameMember } from '@/app/(account)/account/actions';
import { AccountDetails, AccountDetailsSkeleton } from '@/components/account/account-details';
import { accountPath, signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { getMemberService } from '@/composition/services';

export const metadata: Metadata = {
	title: 'Account',
};

// The proxy sends a visitor without a session cookie to sign in first; this is the check that
// counts, since the cookie can be present but expired.
async function CurrentMemberAccount() {
	const member = await getMemberService().getCurrentMember();
	if (member === null) {
		redirect(signInHref(accountPath));
	}

	return (
		<AccountDetails
			displayName={member.displayName}
			email={member.email}
			renameAction={renameMember}
		/>
	);
}

export default function AccountPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Account</h1>
			<Suspense fallback={<AccountDetailsSkeleton />}>
				<CurrentMemberAccount />
			</Suspense>
		</PageContainer>
	);
}
