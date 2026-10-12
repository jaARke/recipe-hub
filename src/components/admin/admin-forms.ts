import type { IssuedInviteDto } from '@/application/access/access-dtos';
import type { FormAction } from '@/components/forms/form-state';

// The fields the admin forms submit and their actions read. Each is named for the service input it
// fills, so a validation problem's path names its field.
export const adminFieldNames = {
	displayName: 'displayName',
	sendTo: 'sendTo',
	requestId: 'requestId',
	inviteId: 'inviteId',
} as const;

// Shown once, right after the invite is issued; the link is never shown again.
export type IssuedInvite = Pick<IssuedInviteDto, 'displayName' | 'link' | 'delivery'>;

// Passed to the forms as props, so the design reference can show them with stand-in actions.
export type AdminActions = {
	issueInvite: FormAction<IssuedInvite>;
	declineRequest: FormAction;
	revokeInvite: FormAction;
};
