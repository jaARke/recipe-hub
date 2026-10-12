import type { ComponentProps } from 'react';
import {
	toAccessRequestDto,
	toInviteDto,
	toInvitePreviewDto,
	type AccessRequestDto,
	type InviteDto,
} from '@/application/access/access-dtos';
import { toMemberDto, type MemberDto } from '@/application/members/member-dtos';
import type { PasskeyList } from '@/components/account/passkey-list';
import {
	sampleContributor,
	sampleJordan,
	sampleSam,
} from '@/components/design-reference/sample-recipe-dtos';
import type { HeaderMember } from '@/components/layout/header-member';
import { accessRequestSchema } from '@/domain/member/access-request';
import { inviteExpiry, inviteSchema } from '@/domain/member/invite';
import { memberSchema } from '@/domain/member/member';

// Members, access requests, and invites for the account and admin samples, shaped by the same
// mappers as the pages. Never real user data: names are invented and addresses use example.com.

const sampleAdmin = memberSchema.parse({
	id: 'b8e2d4f6-1a3c-4e5b-9d7f-2c4e6a8b0d1f',
	displayName: 'Avery',
	email: 'avery@example.com',
	role: 'admin',
	createdAt: new Date('2026-10-01T15:00:00.000Z'),
});

// An open invite from the sample admin, with the usual lifetime.
function sampleInvite({
	createdAt,
	...fields
}: {
	id: string;
	displayName: string;
	email?: string;
	createdAt: Date;
}) {
	return inviteSchema.parse({
		...fields,
		role: 'member',
		createdBy: sampleAdmin.id,
		createdAt,
		expiresAt: inviteExpiry(createdAt),
	});
}

// Oldest first, as the admin page lists them.
export const sampleMembers: MemberDto[] = [
	sampleAdmin,
	memberSchema.parse({
		id: sampleSam.memberId,
		displayName: sampleSam.displayName,
		email: 'sam@example.com',
		role: 'member',
		createdAt: new Date('2026-10-05T17:30:00.000Z'),
	}),
	memberSchema.parse({
		id: sampleJordan.memberId,
		displayName: sampleJordan.displayName,
		email: 'jordan@example.com',
		role: 'member',
		createdAt: new Date('2026-10-08T12:15:00.000Z'),
	}),
	sampleContributor,
].map(toMemberDto);

// The header's view of a member and of an admin.
export const sampleHeaderMember: HeaderMember = {
	displayName: sampleContributor.displayName,
	role: sampleContributor.role,
};
export const sampleHeaderAdmin: HeaderMember = {
	displayName: sampleAdmin.displayName,
	role: sampleAdmin.role,
};

// Oldest first. One left an address for the invite and one did not, and the second note runs to
// two lines.
export const sampleAccessRequests: AccessRequestDto[] = [
	{
		id: '0199d0a1-6e2f-7a3b-9c00-000000000001',
		name: 'Casey',
		relationship: "Sam's neighbor. We trade recipes at the block party every summer.",
		email: 'casey@example.com',
		createdAt: new Date('2026-10-09T18:20:00.000Z'),
	},
	{
		id: '0199d0a1-6e2f-7a3b-9c00-000000000002',
		name: 'Theo',
		relationship:
			"Jordan's cousin.\nI'd like to add the bread recipes I learned from my grandmother.",
		createdAt: new Date('2026-10-11T22:05:00.000Z'),
	},
].map((request) =>
	toAccessRequestDto(accessRequestSchema.parse({ ...request, status: 'pending' }))
);

// Pat's invite, which the invite steps open, before Pat has entered an address.
const samplePatInvite = sampleInvite({
	id: '0199d0a1-6e2f-7a3b-9d00-000000000001',
	displayName: 'Pat',
	createdAt: new Date('2026-10-07T13:30:00.000Z'),
});

// Newest first. Jamie has entered an address and Pat has not.
export const sampleOpenInvites: InviteDto[] = [
	sampleInvite({
		id: '0199d0a1-6e2f-7a3b-9d00-000000000002',
		displayName: 'Jamie',
		email: 'jamie@example.com',
		createdAt: new Date('2026-10-10T16:00:00.000Z'),
	}),
	samplePatInvite,
].map(toInviteDto);

export const sampleInvitePreview = toInvitePreviewDto(samplePatInvite);

// The address Pat confirms on the invite steps.
export const sampleInviteeEmail = 'pat@example.com';

type SamplePasskey = ComponentProps<typeof PasskeyList>['passkeys'][number];

// Unnamed, as every passkey added on the account page is, so the list shows each as Passkey.
export const samplePasskeys: readonly SamplePasskey[] = [
	{ id: 'sample-passkey-1', name: null, createdAt: new Date('2026-10-11T14:05:00.000Z') },
	{ id: 'sample-passkey-2', name: null, createdAt: new Date('2026-10-12T09:40:00.000Z') },
];
