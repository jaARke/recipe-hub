import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { declineRequest, issueInvite, revokeInvite } from '@/app/admin/actions';
import type { AccessRequestDto, InviteDto } from '@/application/access/access-dtos';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { MemberDto } from '@/application/members/member-dtos';
import { AdminDashboard, AdminDashboardSkeleton } from '@/components/admin/admin-dashboard';
import type { AdminActions } from '@/components/admin/admin-forms';
import { AdminOnlyEmptyState } from '@/components/admin/admin-only-empty-state';
import { adminPath, signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import {
	getAccessRequestService,
	getInviteService,
	getMemberService,
} from '@/composition/services';

export const metadata: Metadata = {
	title: 'Admin',
};

const adminActions: AdminActions = { issueInvite, declineRequest, revokeInvite };

type AdminData = {
	requests: AccessRequestDto[];
	invites: InviteDto[];
	members: MemberDto[];
};

// The authoritative check: every call authorizes the actor, and the proxy only looks for a cookie.
// Null for a member who is not an admin.
async function loadAdminData(): Promise<AdminData | null> {
	try {
		const [requests, invites, members] = await Promise.all([
			getAccessRequestService().listPendingRequests(),
			getInviteService().listOpenInvites(),
			getMemberService().listMembers(),
		]);
		return { requests, invites, members };
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(adminPath));
		}
		if (error instanceof ForbiddenError) {
			return null;
		}
		throw error;
	}
}

async function AdminContent() {
	const data = await loadAdminData();
	if (data === null) {
		return <AdminOnlyEmptyState />;
	}

	return <AdminDashboard {...data} actions={adminActions} headingLevel={2} />;
}

export default function AdminPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Admin</h1>
			<Suspense fallback={<AdminDashboardSkeleton />}>
				<AdminContent />
			</Suspense>
		</PageContainer>
	);
}
