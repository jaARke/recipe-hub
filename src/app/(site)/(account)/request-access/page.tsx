import type { Metadata } from 'next';
import { requestAccess } from '@/app/(site)/(account)/request-access/actions';
import { RequestAccessForm } from '@/components/account/request-access-form';
import { privacyPath } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { TextLink } from '@/components/layout/text-link';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: 'Request access',
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
			<p className="text-sm text-muted-foreground">
				Read <TextLink href={privacyPath}>what we store and why</TextLink>.
			</p>
		</PageContainer>
	);
}
