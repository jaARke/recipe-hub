'use client';

import * as React from 'react';
import type { MemberDto } from '@/application/members/member-dtos';
import { adminFieldNames } from '@/components/admin/admin-forms';
import { memberRowActions } from '@/components/admin/member-row-actions';
import { ConfirmActionDialog } from '@/components/forms/confirm-action-dialog';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';
import type { FormAction } from '@/components/forms/form-state';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';

type RoleActionProps = {
	member: MemberDto;
	makeAdmin: FormAction;
	removeAdmin: FormAction;
};

// Make admin for a member, and Remove admin for an admin, worded for the admin reading the list.
function RoleAction({ member, makeAdmin, removeAdmin }: RoleActionProps) {
	const memberIdInput = <input type="hidden" name={adminFieldNames.memberId} value={member.id} />;

	if (member.role === 'member') {
		return (
			<ConfirmActionDialog
				variant="default"
				trigger={
					<>
						Make admin<span className="sr-only"> for {member.displayName}</span>
					</>
				}
				title={`Make ${member.displayName} an admin?`}
				description="They can review access requests, invite people, change who is an admin, and edit any recipe."
				cancelLabel="Keep as member"
				confirmLabel="Make admin"
				pendingLabel="Making admin"
				successMessage={`${member.displayName} is now an admin`}
				failureMessage={`We couldn’t make ${member.displayName} an admin. Reload the page and try again.`}
				action={makeAdmin}
			>
				{memberIdInput}
			</ConfirmActionDialog>
		);
	}

	const removeCopy = member.isCurrentMember
		? {
				title: 'Remove your admin access?',
				description:
					'You stay a member but can no longer review access requests, invite people, change who is an admin, or edit other members’ recipes. Another admin can make you an admin again.',
				successMessage: 'You’re no longer an admin',
				failureMessage: 'We couldn’t remove your admin access. Reload the page and try again.',
			}
		: {
				title: `Remove admin from ${member.displayName}?`,
				description:
					'They stay a member but can no longer review access requests, invite people, change who is an admin, or edit other members’ recipes.',
				successMessage: `${member.displayName} is no longer an admin`,
				failureMessage: `We couldn’t remove admin from ${member.displayName}. Reload the page and try again.`,
			};

	return (
		<ConfirmActionDialog
			variant="destructive"
			trigger={
				<>
					Remove admin<span className="sr-only"> from {member.displayName}</span>
				</>
			}
			{...removeCopy}
			cancelLabel="Keep as admin"
			confirmLabel="Remove admin"
			pendingLabel="Removing admin"
			action={removeAdmin}
		>
			{memberIdInput}
		</ConfirmActionDialog>
	);
}

type RemoveMemberActionProps = {
	member: MemberDto;
	removeMember: FormAction;
};

function RemoveMemberAction({ member, removeMember }: RemoveMemberActionProps) {
	return (
		<ConfirmActionDialog
			variant="destructive"
			trigger={
				<>
					Remove member<span className="sr-only"> {member.displayName}</span>
				</>
			}
			title={`Remove ${member.displayName}?`}
			description="They’re signed out on every device and can’t sign in again unless you invite them again, as a new account. Their recipes stay, still credited to them."
			cancelLabel="Keep member"
			confirmLabel="Remove member"
			pendingLabel="Removing member"
			successMessage={`${member.displayName} is no longer a member`}
			failureMessage={`We couldn’t remove ${member.displayName}. Reload the page and try again.`}
			action={removeMember}
		>
			<input type="hidden" name={adminFieldNames.memberId} value={member.id} />
		</ConfirmActionDialog>
	);
}

type MemberRowProps = RoleActionProps & {
	removeMember: FormAction;
};

function MemberRow({ member, makeAdmin, removeAdmin, removeMember }: MemberRowProps) {
	const nameRef = React.useRef<HTMLParagraphElement>(null);
	const previousRole = React.useRef(member.role);
	const actions = memberRowActions(member);

	// A role change swaps the row's action, and focus in the dialog it unmounts drops to the page, so
	// the member's name takes it, with the new role's badge beside it.
	React.useEffect(() => {
		const roleChanged = member.role !== previousRole.current;
		previousRole.current = member.role;
		if (roleChanged && focusFellToPage()) {
			nameRef.current?.focus();
		}
	}, [member.role]);

	return (
		<li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 flex-col gap-1">
				<p ref={nameRef} tabIndex={-1} className="flex flex-wrap items-center gap-2 font-medium">
					{member.displayName}
					{member.role === 'admin' && <Badge variant="secondary">Admin</Badge>}
					{member.isOwner && <Badge variant="secondary">Owner</Badge>}
				</p>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
					<p className="wrap-anywhere">{member.email}</p>
					<p>
						Joined{' '}
						<time dateTime={member.createdAt.toISOString()}>{formatDate(member.createdAt)}</time>
					</p>
				</div>
			</div>
			{(actions.changeRole || actions.removeMember) && (
				<div className="flex flex-wrap gap-2 sm:shrink-0">
					{/* Keyed by role, so a change mounts the other dialog closed instead of reusing this one. */}
					{actions.changeRole && (
						<RoleAction
							key={member.role}
							member={member}
							makeAdmin={makeAdmin}
							removeAdmin={removeAdmin}
						/>
					)}
					{actions.removeMember && (
						<RemoveMemberAction member={member} removeMember={removeMember} />
					)}
				</div>
			)}
		</li>
	);
}

type MemberListProps = {
	// Oldest first.
	members: MemberDto[];
	makeAdmin: FormAction;
	removeAdmin: FormAction;
	removeMember: FormAction;
};

function MemberList({ members, makeAdmin, removeAdmin, removeMember }: MemberListProps) {
	return (
		<ul role="list" className="divide-y">
			{members.map((member) => (
				<MemberRow
					key={member.id}
					member={member}
					makeAdmin={makeAdmin}
					removeAdmin={removeAdmin}
					removeMember={removeMember}
				/>
			))}
		</ul>
	);
}

export { MemberList };
