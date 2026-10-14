import type { Metadata } from 'next';
import { Suspense } from 'react';
import { bindInviteEmail, completeInvite, getInvitePreview } from '@/app/(account)/invite/actions';
import { InviteFlow } from '@/components/auth/invite-flow';
import { InviteFlowSkeleton } from '@/components/auth/invite-steps';
import { Mascot } from '@/components/brand/mascot';
import { PageContainer } from '@/components/layout/page-container';
import { getMemberService } from '@/composition/services';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: 'Accept your invite',
};

// The token is in the URL's fragment, which only the browser reads, so the flow runs there.
async function InviteForVisitor() {
	const member = await getMemberService().getCurrentMember();
	return (
		<InviteFlow
			signedInAs={member?.displayName ?? null}
			codeLifetimeMinutes={settings.accounts.signInCodeLifetimeMinutes}
			headingLevel={2}
			getPreview={getInvitePreview}
			bindEmail={bindInviteEmail}
			complete={completeInvite}
		/>
	);
}

export default function InvitePage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<div className="flex items-center gap-4">
				<Mascot size="md" />
				<h1 className="font-heading text-4xl font-semibold">Accept your invite</h1>
			</div>
			<Suspense fallback={<InviteFlowSkeleton />}>
				<InviteForVisitor />
			</Suspense>
		</PageContainer>
	);
}
