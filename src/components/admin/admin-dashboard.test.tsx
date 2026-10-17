import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { AccessRequestDto, InviteDto } from '@/application/access/access-dtos';
import type { MemberDto } from '@/application/members/member-dtos';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { adminFieldNames, type AdminActions } from '@/components/admin/admin-forms';
import type { AdminTab } from '@/components/admin/admin-tabs';
import { formText } from '@/components/forms/form-data';
import type { FormAction } from '@/components/forms/form-state';
import { accessRequestIdSchema } from '@/domain/member/access-request';
import { inviteIdSchema } from '@/domain/member/invite';
import { memberIdSchema } from '@/domain/member/member';

const createdAt = new Date('2026-10-01T12:00:00.000Z');
const expiresAt = new Date('2026-10-08T12:00:00.000Z');

const sampleRequests: AccessRequestDto[] = [
	{
		id: accessRequestIdSchema.parse('0199d0a1-6e2f-7a3b-9c00-000000000001'),
		name: 'Casey',
		relationship: "Sam's neighbor.",
		email: 'casey@example.com',
		createdAt,
	},
	{
		id: accessRequestIdSchema.parse('0199d0a1-6e2f-7a3b-9c00-000000000002'),
		name: 'Theo',
		relationship: "Jordan's cousin.",
		createdAt,
	},
];

const sampleInvites: InviteDto[] = [
	{
		id: inviteIdSchema.parse('0199d0a1-6e2f-7a3b-9d00-000000000001'),
		displayName: 'Jamie',
		createdAt,
		expiresAt,
	},
];

function member(id: string, displayName: string, standing: Partial<MemberDto>): MemberDto {
	return {
		id: memberIdSchema.parse(id),
		displayName,
		email: `${displayName.toLowerCase()}@example.com`,
		role: 'member',
		createdAt,
		isCurrentMember: false,
		isOwner: false,
		...standing,
	};
}

const sampleMembers: MemberDto[] = [
	member('0199d0a1-6e2f-7a3b-9e00-000000000001', 'Avery', {
		role: 'admin',
		isCurrentMember: true,
		isOwner: true,
	}),
	member('0199d0a1-6e2f-7a3b-9e00-000000000002', 'Sam', {}),
	member('0199d0a1-6e2f-7a3b-9e00-000000000003', 'Jordan', {}),
];

const succeed: FormAction = async () => ({ status: 'success' });

type DashboardProps = {
	initialTab?: AdminTab;
	requests?: AccessRequestDto[];
};

// The dashboard with its tab in state, and actions that change its lists as the page's refresh would.
function Dashboard({
	initialTab = 'requests',
	requests: initialRequests = sampleRequests,
}: DashboardProps) {
	const [tab, setTab] = React.useState(initialTab);
	const [requests, setRequests] = React.useState(initialRequests);
	const [invites, setInvites] = React.useState(sampleInvites);
	const actions: AdminActions = {
		issueInvite: async (_state, formData) => {
			const requestId = formText(formData, adminFieldNames.requestId);
			const displayName = formText(formData, adminFieldNames.displayName);
			setRequests((current) => current.filter((request) => request.id !== requestId));
			setInvites((current) => [
				{
					id: inviteIdSchema.parse('0199d0a1-6e2f-7a3b-9d00-000000000002'),
					displayName,
					createdAt,
					expiresAt,
				},
				...current,
			]);
			return {
				status: 'success',
				displayName,
				link: 'https://recipes.example/invite#token',
				delivery: { status: 'not-requested' },
			};
		},
		declineRequest: async (_state, formData) => {
			const requestId = formText(formData, adminFieldNames.requestId);
			setRequests((current) => current.filter((request) => request.id !== requestId));
			return { status: 'success' };
		},
		revokeInvite: succeed,
		makeAdmin: succeed,
		removeAdmin: succeed,
		removeMember: succeed,
	};

	return (
		<AdminDashboard
			requests={requests}
			invites={invites}
			members={sampleMembers}
			actions={actions}
			headingLevel={2}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

function tabNames(): (string | null)[] {
	return page
		.getByRole('tab')
		.elements()
		.map((tab) => tab.textContent);
}

function selectedTab() {
	return page.getByRole('tab', { selected: true });
}

describe('AdminDashboard', () => {
	it('opens the tab its owner names', async () => {
		await render(<Dashboard initialTab="members" />);

		await expect.element(selectedTab()).toHaveTextContent('Members, 3');
		await expect
			.element(page.getByRole('tabpanel').getByRole('heading', { name: 'Members' }))
			.toBeVisible();
		expect(page.getByRole('heading', { name: 'Access requests' }).query()).toBeNull();
	});

	it('hands a change of tab to its owner, from a click or an arrow key', async () => {
		await render(<Dashboard />);

		await page.getByRole('tab', { name: /^Invites/ }).click();
		await expect.element(selectedTab()).toHaveTextContent('Invites, 1');
		await expect.element(page.getByRole('heading', { name: 'Invite someone' })).toBeVisible();

		await userEvent.keyboard('{ArrowRight}');
		await expect.element(selectedTab()).toHaveTextContent('Members, 3');
		await expect.element(page.getByRole('heading', { name: 'Members' })).toBeVisible();
	});

	it("shows each tab's count in its label, read after a comma, and none for an empty list", async () => {
		await render(<Dashboard requests={[]} />);

		expect(tabNames()).toEqual(['Requests', 'Invites, 1', 'Members, 3']);
	});

	it("moves focus to the Requests panel's heading after declining a request", async () => {
		await render(<Dashboard />);

		await page.getByRole('button', { name: 'Decline the request from Casey' }).click();
		await page.getByRole('button', { name: 'Decline request' }).click();

		await expect.element(page.getByRole('heading', { name: 'Access requests' })).toHaveFocus();
		expect(tabNames()).toEqual(['Requests, 1', 'Invites, 1', 'Members, 3']);
	});

	it('keeps the issued invite in view on Requests after an approval and counts the new invite', async () => {
		await render(<Dashboard />);

		await page.getByRole('button', { name: 'Approve the request from Casey' }).click();

		await expect.element(page.getByRole('tabpanel').getByText('Invite for Casey')).toBeVisible();
		// The lists can commit a render after the notice.
		await expect.poll(tabNames).toEqual(['Requests, 1', 'Invites, 2', 'Members, 3']);
		await expect.element(selectedTab()).toHaveTextContent('Requests, 1');
	});
});
