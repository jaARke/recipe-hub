import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
	declineRequest,
	issueInvite,
	makeAdmin,
	removeAdmin,
	removeMember,
	revokeInvite,
} from '@/app/(site)/admin/actions';
import type { AccessRequestDto, InviteDto } from '@/application/access/access-dtos';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { MemberDto } from '@/application/members/member-dtos';
import { AdminDashboardSkeleton } from '@/components/admin/admin-dashboard';
import type { AdminActions } from '@/components/admin/admin-forms';
import { AdminOnlyEmptyState } from '@/components/admin/admin-only-empty-state';
import { AdminPageDashboard } from '@/components/admin/admin-page-dashboard';
import { adminPath, requestedPageHref, signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import {
	getAccessRequestService,
	getInviteService,
	getMemberService,
} from '@/composition/services';

export const metadata: Metadata = {
	title: 'Admin',
};

const adminActions: AdminActions = {
	issueInvite,
	declineRequest,
	revokeInvite,
	makeAdmin,
	removeAdmin,
	removeMember,
};

type AdminData = {
	requests: AccessRequestDto[];
	invites: InviteDto[];
	members: MemberDto[];
};

type AdminSearchParams = Pick<PageProps<'/admin'>, 'searchParams'>;

// The authoritative check: every call authorizes the actor, and the proxy only looks for a cookie.
// Null for a member who is not an admin.
async function loadAdminData({ searchParams }: AdminSearchParams): Promise<AdminData | null> {
	try {
		const [requests, invites, members] = await Promise.all([
			getAccessRequestService().listPendingRequests(),
			getInviteService().listOpenInvites(),
			getMemberService().listMembers(),
		]);
		return { requests, invites, members };
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			// Only this branch reads the query, which holds the open tab, so no other render waits on it.
			redirect(signInHref(requestedPageHref(adminPath, await searchParams)));
		}
		if (error instanceof ForbiddenError) {
			return null;
		}
		throw error;
	}
}

// The dashboard reads its tab from the URL inside this boundary, at request time, so the server
// renders the open tab's panel first.
async function AdminContent({ searchParams }: AdminSearchParams) {
	const data = await loadAdminData({ searchParams });
	if (data === null) {
		return <AdminOnlyEmptyState />;
	}

	return <AdminPageDashboard {...data} actions={adminActions} headingLevel={2} />;
}

export default function AdminPage({ searchParams }: PageProps<'/admin'>) {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-semibold">Admin</h1>
			<Suspense fallback={<AdminDashboardSkeleton />}>
				<AdminContent searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
