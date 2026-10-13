import { LinkIcon } from 'lucide-react';
import type { InviteDto } from '@/application/access/access-dtos';
import { adminFieldNames } from '@/components/admin/admin-forms';
import { ConfirmActionDialog } from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { formatDate } from '@/lib/dates';

function OpenInvitesEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LinkIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No open invites</EmptyTitle>
				<EmptyDescription>
					Invites show up here until they&apos;re used, revoked, or expire.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

// Newest first. The email is the one the invitee entered, once they have.
function OpenInviteList({
	invites,
	revokeInvite,
}: {
	invites: InviteDto[];
	revokeInvite: FormAction;
}) {
	if (invites.length === 0) {
		return <OpenInvitesEmptyState />;
	}

	return (
		<ul className="divide-y">
			{invites.map((invite) => (
				<li
					key={invite.id}
					className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="flex min-w-0 flex-col gap-1">
						<p className="font-medium">{invite.displayName}</p>
						<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
							{invite.email !== undefined && <p className="wrap-anywhere">{invite.email}</p>}
							<p>
								Expires{' '}
								<time dateTime={invite.expiresAt.toISOString()}>
									{formatDate(invite.expiresAt)}
								</time>
							</p>
						</div>
					</div>
					<ConfirmActionDialog
						variant="destructive"
						trigger={
							<>
								Revoke<span className="sr-only"> the invite for {invite.displayName}</span>
							</>
						}
						title={`Revoke the invite for ${invite.displayName}?`}
						description="The invite link stops working right away."
						cancelLabel="Keep invite"
						confirmLabel="Revoke invite"
						pendingLabel="Revoking"
						successMessage="Invite revoked"
						failureMessage="We couldn't revoke the invite. Reload the page and try again."
						action={revokeInvite}
					>
						<input type="hidden" name={adminFieldNames.inviteId} value={invite.id} />
					</ConfirmActionDialog>
				</li>
			))}
		</ul>
	);
}

export { OpenInviteList };
