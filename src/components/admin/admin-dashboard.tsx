import * as React from 'react';
import type { AccessRequestDto, InviteDto } from '@/application/access/access-dtos';
import type { MemberDto } from '@/application/members/member-dtos';
import { AccessRequestList } from '@/components/admin/access-request-list';
import type { AdminActions } from '@/components/admin/admin-forms';
import { AdminSectionHeading } from '@/components/admin/admin-section-heading';
import { InviteForm } from '@/components/admin/invite-form';
import { MemberList } from '@/components/admin/member-list';
import { OpenInviteList } from '@/components/admin/open-invite-list';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { inviteLifetimeDays } from '@/domain/member/invite';

// Keyed by the sections' level; level 4 nests the page under the design reference's own headings.
const adminHeadingLevels = {
	2: { section: 'h2', request: 3 },
	4: { section: 'h4', request: 5 },
} as const;

type AdminHeadingLevel = keyof typeof adminHeadingLevels;

type AdminSectionProps = {
	id: string;
	headingTag: (typeof adminHeadingLevels)[AdminHeadingLevel]['section'];
	title: React.ReactNode;
	description?: string;
	// Lets the heading take focus when an item leaves the section with focus on it.
	itemCount?: number;
	children: React.ReactNode;
};

function AdminSection({
	id,
	headingTag,
	title,
	description,
	itemCount,
	children,
}: AdminSectionProps) {
	const headingId = `${id}-heading`;

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<AdminSectionHeading as={headingTag} id={headingId} itemCount={itemCount}>
					{title}
				</AdminSectionHeading>
				{description !== undefined && <p className="text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}

type AdminDashboardProps = {
	requests: AccessRequestDto[];
	invites: InviteDto[];
	members: MemberDto[];
	actions: AdminActions;
	headingLevel: AdminHeadingLevel;
};

function AdminDashboard({
	requests,
	invites,
	members,
	actions,
	headingLevel,
}: AdminDashboardProps) {
	const { section, request } = adminHeadingLevels[headingLevel];

	return (
		<div className="flex flex-col gap-12">
			<AdminSection
				id="admin-requests"
				headingTag={section}
				title={
					<>
						Access requests
						{requests.length > 0 && <Badge variant="secondary">{requests.length} pending</Badge>}
					</>
				}
				itemCount={requests.length}
			>
				<AccessRequestList
					requests={requests}
					headingLevel={request}
					issueInvite={actions.issueInvite}
					declineRequest={actions.declineRequest}
				/>
			</AdminSection>
			<AdminSection
				id="admin-invite"
				headingTag={section}
				title="Invite someone"
				description={`For someone who hasn't requested access. Each link works once and expires after ${inviteLifetimeDays} days.`}
			>
				<InviteForm issueInvite={actions.issueInvite} />
			</AdminSection>
			<AdminSection
				id="admin-invites"
				headingTag={section}
				title="Open invites"
				itemCount={invites.length}
			>
				<OpenInviteList invites={invites} revokeInvite={actions.revokeInvite} />
			</AdminSection>
			<AdminSection id="admin-members" headingTag={section} title="Members">
				<MemberList
					members={members}
					makeAdmin={actions.makeAdmin}
					removeAdmin={actions.removeAdmin}
				/>
			</AdminSection>
		</div>
	);
}

function AdminSectionSkeleton({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-6">
			<Skeleton className="h-8 w-48" />
			{children}
		</div>
	);
}

function AdminDashboardSkeleton() {
	return (
		<div role="status">
			<span className="sr-only">Loading requests, invites, and members</span>
			<div aria-hidden="true" className="flex flex-col gap-12">
				<AdminSectionSkeleton>
					<Skeleton className="h-96 rounded-xl" />
				</AdminSectionSkeleton>
				<AdminSectionSkeleton>
					<div className="flex flex-col gap-7">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				</AdminSectionSkeleton>
				<AdminSectionSkeleton>
					<div className="flex flex-col gap-4">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				</AdminSectionSkeleton>
			</div>
		</div>
	);
}

export { AdminDashboard, AdminDashboardSkeleton };
