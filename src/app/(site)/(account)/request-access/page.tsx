import type { Metadata } from 'next';
import { requestAccess } from '@/app/(site)/(account)/request-access/actions';
import { RequestAccessForm } from '@/components/account/request-access-form';
import { PageContainer } from '@/components/layout/page-container';
import { PrivacyNote } from '@/components/layout/privacy-note';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: 'Request access',
	// Kept out of search results, which would send strangers here; its links are followed.
	robots: { index: false, follow: true },
};

export default function RequestAccessPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<div className="flex flex-col gap-3">
				<h1 className="font-heading text-4xl font-semibold">Request access</h1>
				<p className="text-lg text-muted-foreground">
					Anyone can browse and search recipes. To add your own, ask for an account. An admin reads
					every request.
				</p>
			</div>
			<RequestAccessForm
				action={requestAccess}
				nextSteps={`An admin will review it. If it’s approved, you’ll get an invite link to create your account, by email if you gave an address. The link works for ${settings.accounts.inviteLifetimeDays} days.`}
			/>
			<PrivacyNote />
		</PageContainer>
	);
}
