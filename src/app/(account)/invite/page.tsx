import type { Metadata } from 'next';
import { Suspense } from 'react';
import { bindInviteEmail, getInvitePreview } from '@/app/(account)/invite/actions';
import { InviteFlow } from '@/components/auth/invite-flow';
import { InviteFlowSkeleton } from '@/components/auth/invite-steps';
import { PageContainer } from '@/components/layout/page-container';
import { getMemberService } from '@/composition/services';
import { signInCodeLifetimeMinutes } from '@/domain/member/member';

export const metadata: Metadata = {
	title: 'Accept your invite',
};

// The token is in the URL's fragment, which only the browser reads, so the flow runs there.
async function InviteForVisitor() {
	const member = await getMemberService().getCurrentMember();
	return (
		<InviteFlow
			signedInAs={member?.displayName ?? null}
			codeLifetimeMinutes={signInCodeLifetimeMinutes}
			getPreview={getInvitePreview}
			bindEmail={bindInviteEmail}
		/>
	);
}

export default function InvitePage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Accept your invite</h1>
			<Suspense fallback={<InviteFlowSkeleton />}>
				<InviteForVisitor />
			</Suspense>
		</PageContainer>
	);
}
