'use client';

import { useState } from 'react';
import type { AccessRequestDto, InviteDto } from '@/application/access/access-dtos';
import type { MemberDto } from '@/application/members/member-dtos';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { adminFieldNames, type AdminActions } from '@/components/admin/admin-forms';
import { sampleInviteLink } from '@/components/design-reference/fixtures';
import { inputProblems, standIn } from '@/components/design-reference/stand-in-actions';
import { formText, optionalFormText } from '@/components/forms/form-data';
import { accessRequestIdSchema } from '@/domain/member/access-request';
import { inviteExpiry, inviteIdSchema, parseInviteFields } from '@/domain/member/invite';

type SampleAdminDashboardProps = {
	requests: AccessRequestDto[];
	invites: InviteDto[];
	members: MemberDto[];
};

// The admin page with stand-ins for its Server Actions. They check input as the services do, email
// every invite that has an address, and change the lists as the page's refresh would; reloading
// restores them.
function SampleAdminDashboard({
	requests: initialRequests,
	invites: initialInvites,
	members,
}: SampleAdminDashboardProps) {
	const [requests, setRequests] = useState(initialRequests);
	const [invites, setInvites] = useState(initialInvites);

	const actions: AdminActions = {
		issueInvite: async (_state, formData) => {
			const fields = {
				displayName: formText(formData, adminFieldNames.displayName),
				sendTo: optionalFormText(formData, adminFieldNames.sendTo),
			};
			const problems = inputProblems(() => parseInviteFields(fields));
			if (problems !== undefined) {
				return standIn(problems);
			}

			await standIn(null);
			const requestId = optionalFormText(formData, adminFieldNames.requestId);
			const createdAt = new Date();
			const invite: InviteDto = {
				id: inviteIdSchema.parse(crypto.randomUUID()),
				requestId: requestId === undefined ? undefined : accessRequestIdSchema.parse(requestId),
				displayName: fields.displayName,
				createdAt,
				expiresAt: inviteExpiry(createdAt),
			};
			setRequests((current) => current.filter((request) => request.id !== requestId));
			setInvites((current) => [invite, ...current]);
			return {
				status: 'success',
				displayName: fields.displayName,
				link: sampleInviteLink,
				delivery:
					fields.sendTo === undefined
						? { status: 'not-requested' }
						: { status: 'sent', to: fields.sendTo },
			};
		},
		declineRequest: async (_state, formData) => {
			const requestId = formText(formData, adminFieldNames.requestId);
			await standIn(null);
			setRequests((current) => current.filter((request) => request.id !== requestId));
			return { status: 'success' };
		},
		revokeInvite: async (_state, formData) => {
			const inviteId = formText(formData, adminFieldNames.inviteId);
			await standIn(null);
			setInvites((current) => current.filter((invite) => invite.id !== inviteId));
			return { status: 'success' };
		},
	};

	return (
		<AdminDashboard
			requests={requests}
			invites={invites}
			members={members}
			actions={actions}
			headingLevel={4}
		/>
	);
}

export { SampleAdminDashboard };
