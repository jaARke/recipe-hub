import type { AccessRequestDto, InviteDto } from '@/application/access/access-dtos';
import type { MemberDto } from '@/application/members/member-dtos';
import { AccessRequestList } from '@/components/admin/access-request-list';
import type { AdminActions } from '@/components/admin/admin-forms';
import { adminTabs, type AdminTab } from '@/components/admin/admin-tabs';
import { InviteForm } from '@/components/admin/invite-form';
import { MemberList } from '@/components/admin/member-list';
import { OpenInviteList } from '@/components/admin/open-invite-list';
import { CountBadge } from '@/components/layout/count-badge';
import { PageSection } from '@/components/layout/page-section';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { settings } from '@/lib/settings';

// Keyed by the sections' level; level 4 nests the page under the design reference's own headings.
const adminHeadingLevels = {
	2: { section: 'h2', request: 3 },
	4: { section: 'h4', request: 5 },
} as const;

type AdminHeadingLevel = keyof typeof adminHeadingLevels;

const adminTabLabels: Record<AdminTab, string> = {
	requests: 'Requests',
	invites: 'Invites',
	members: 'Members',
};

type AdminDashboardProps = {
	requests: AccessRequestDto[];
	invites: InviteDto[];
	members: MemberDto[];
	actions: AdminActions;
	headingLevel: AdminHeadingLevel;
	// The open tab, which its owner keeps: the admin page in its URL, the design reference in state.
	tab: AdminTab;
	onTabChange: (tab: AdminTab) => void;
};

// Requests, invites, and members, one tab each. Hidden panels stay mounted, so an approval's invite
// notice and a half-typed invite outlast a switch of tab.
function AdminDashboard({
	requests,
	invites,
	members,
	actions,
	headingLevel,
	tab,
	onTabChange,
}: AdminDashboardProps) {
	const { section, request } = adminHeadingLevels[headingLevel];
	const counts: Record<AdminTab, number> = {
		requests: requests.length,
		invites: invites.length,
		members: members.length,
	};

	return (
		<Tabs value={tab} onValueChange={onTabChange} className="gap-8">
			<TabsList activateOnFocus className="w-full sm:w-fit">
				{adminTabs.map((value) => (
					// Tighter on phones, so the three tabs fit a 320 px screen with two-digit counts.
					<TabsTrigger key={value} value={value} className="max-sm:px-1">
						{adminTabLabels[value]}
						<CountBadge count={counts[value]} />
					</TabsTrigger>
				))}
			</TabsList>
			<TabsContent value="requests" keepMounted>
				<PageSection
					id="admin-requests"
					headingTag={section}
					title="Access requests"
					itemCount={requests.length}
				>
					<AccessRequestList
						requests={requests}
						headingLevel={request}
						issueInvite={actions.issueInvite}
						declineRequest={actions.declineRequest}
					/>
				</PageSection>
			</TabsContent>
			<TabsContent value="invites" keepMounted className="flex flex-col gap-8">
				<PageSection
					id="admin-invite"
					headingTag={section}
					title="Invite someone"
					description={`For someone who hasn’t requested access. Each link works once and expires after ${settings.accounts.inviteLifetimeDays} days.`}
				>
					<InviteForm issueInvite={actions.issueInvite} />
				</PageSection>
				<PageSection
					id="admin-invites"
					headingTag={section}
					title="Open invites"
					// The tab's count belongs to this section, the panel's second, so it shows here too.
					count={invites.length}
					itemCount={invites.length}
				>
					<OpenInviteList invites={invites} revokeInvite={actions.revokeInvite} />
				</PageSection>
			</TabsContent>
			<TabsContent value="members" keepMounted>
				<PageSection
					id="admin-members"
					headingTag={section}
					title="Members"
					itemCount={members.length}
				>
					<MemberList
						members={members}
						makeAdmin={actions.makeAdmin}
						removeAdmin={actions.removeAdmin}
						removeMember={actions.removeMember}
					/>
				</PageSection>
			</TabsContent>
		</Tabs>
	);
}

// Mirrors the tabs over the first tab's section.
function AdminDashboardSkeleton() {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading requests, invites, and members</span>
			<div aria-hidden="true" className="flex flex-col gap-8">
				<Skeleton className="h-9 w-full sm:w-72" />
				<div className="flex flex-col gap-4">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-96 rounded-xl" />
				</div>
			</div>
		</div>
	);
}

export { AdminDashboard, AdminDashboardSkeleton };
