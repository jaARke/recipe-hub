import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
	bindInviteEmail,
	completeInvite,
	getInvitePreview,
} from '@/app/(site)/(account)/invite/actions';
import { completedInviteAccounts } from '@/application/access/access-dtos';
import { inviteAccountParamName } from '@/components/auth/auth-paths';
import { InviteFlow } from '@/components/auth/invite-flow';
import { InviteFlowSkeleton } from '@/components/auth/invite-steps';
import { PageContainer } from '@/components/layout/page-container';
import { parseOptionParam } from '@/components/recipe/recipe-list-params';
import { getMemberService } from '@/composition/services';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: 'Accept your invite',
};

type InviteSearchParams = Pick<PageProps<'/invite'>, 'searchParams'>;

// The token is in the URL's fragment, which only the browser reads, so the flow runs there.
async function InviteForVisitor({ searchParams }: InviteSearchParams) {
	const member = await getMemberService().getCurrentMember();
	const account = parseOptionParam(
		(await searchParams)[inviteAccountParamName],
		completedInviteAccounts
	);
	return (
		<InviteFlow
			signedInAs={member?.displayName ?? null}
			joined={member === null ? null : (account ?? null)}
			codeLifetimeMinutes={settings.accounts.signInCodeLifetimeMinutes}
			headingLevel={2}
			getPreview={getInvitePreview}
			bindEmail={bindInviteEmail}
			complete={completeInvite}
		/>
	);
}

export default function InvitePage({ searchParams }: PageProps<'/invite'>) {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-semibold">Accept your invite</h1>
			<Suspense fallback={<InviteFlowSkeleton />}>
				<InviteForVisitor searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
