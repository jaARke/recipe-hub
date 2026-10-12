'use client';

import { InboxIcon } from 'lucide-react';
import * as React from 'react';
import type { AccessRequestDto } from '@/application/access/access-dtos';
import { adminFieldNames, type IssuedInvite } from '@/components/admin/admin-forms';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { DisplayNameField } from '@/components/admin/display-name-field';
import { IssuedInviteNotice } from '@/components/admin/issued-invite-notice';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { useFormAction } from '@/components/forms/use-form-action';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/dates';

// Level 5 nests a request under the design reference's own headings.
type RequestHeadingLevel = 3 | 5;

type AccessRequestCardProps = {
	request: AccessRequestDto;
	headingLevel: RequestHeadingLevel;
	issueInvite: FormAction<IssuedInvite>;
	declineRequest: FormAction;
	onIssued: (invite: IssuedInvite) => void;
};

function AccessRequestCard({
	request,
	headingLevel,
	issueInvite,
	declineRequest,
	onIssued,
}: AccessRequestCardProps) {
	const idPrefix = `request-${request.id}`;
	const [state, formAction, pending] = useFormAction<IssuedInvite>(async (previous, formData) => {
		const next = await issueInvite(previous, formData);
		if (next.status === 'success') {
			onIssued(next);
		}
		return next;
	}, "We couldn't approve the request. Reload the page and try again.");
	const failed = state.status === 'error' ? state : undefined;
	// React resets the form after every submit, returning the checkbox's hidden input to the state it
	// mounted with. Remounting it with the submitted choice keeps what it shows and sends in step.
	const sendsInvite = failed === undefined || failed.values?.[adminFieldNames.sendTo] !== undefined;
	const whichRequest = <span className="sr-only"> the request from {request.name}</span>;

	return (
		<Card>
			<CardHeader>
				<CardTitle role="heading" aria-level={headingLevel}>
					{request.name}
				</CardTitle>
				<CardDescription>
					Requested{' '}
					<time dateTime={request.createdAt.toISOString()}>{formatDate(request.createdAt)}</time>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">How they know us</dt>
						<dd className="whitespace-pre-line">{request.relationship}</dd>
					</div>
					{request.email !== undefined && (
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="wrap-anywhere">{request.email}</dd>
						</div>
					)}
				</dl>
			</CardContent>
			<CardContent>
				<form action={formAction} noValidate className="flex flex-col gap-6">
					<input type="hidden" name={adminFieldNames.requestId} value={request.id} />
					<FieldGroup>
						<DisplayNameField
							id={`${idPrefix}-name`}
							defaultValue={failed?.values?.[adminFieldNames.displayName] ?? request.name}
							error={failed?.fieldErrors[adminFieldNames.displayName]}
						/>
						{request.email !== undefined && (
							<Field orientation="horizontal">
								<Checkbox
									key={String(sendsInvite)}
									id={`${idPrefix}-send`}
									name={adminFieldNames.sendTo}
									value={request.email}
									defaultChecked={sendsInvite}
								/>
								<FieldLabel htmlFor={`${idPrefix}-send`} className="wrap-anywhere">
									Email the invite to {request.email}
								</FieldLabel>
							</Field>
						)}
					</FieldGroup>
					<FormErrorAlert message={failed?.message} />
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<ConfirmActionDialog
							trigger={<>Decline{whichRequest}</>}
							title={`Decline the request from ${request.name}?`}
							description="The request is deleted."
							cancelLabel="Keep request"
							confirmLabel="Decline request"
							pendingLabel="Declining"
							successMessage="Request declined"
							failureMessage="We couldn't decline the request. Reload the page and try again."
							action={declineRequest}
						>
							<input type="hidden" name={adminFieldNames.requestId} value={request.id} />
						</ConfirmActionDialog>
						<Button type="submit" disabled={pending} focusableWhenDisabled>
							{pending && <Spinner data-icon="inline-start" />}
							{pending ? 'Approving' : 'Approve'}
							{whichRequest}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function AccessRequestsEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<InboxIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No pending requests</EmptyTitle>
				<EmptyDescription>
					New requests show up here, and admins get an email when one arrives.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

type AccessRequestListProps = {
	// Oldest first.
	requests: AccessRequestDto[];
	headingLevel: RequestHeadingLevel;
	issueInvite: FormAction<IssuedInvite>;
	declineRequest: FormAction;
};

// Holds the invite issued from a request, because approving it removes the request's card.
function AccessRequestList({
	requests,
	headingLevel,
	issueInvite,
	declineRequest,
}: AccessRequestListProps) {
	const [issued, setIssued] = React.useState<IssuedInvite | null>(null);

	return (
		<div>
			<div role="status">
				{issued !== null && <IssuedInviteNotice invite={issued} className="mb-6" />}
			</div>
			{requests.length === 0 ? (
				<AccessRequestsEmptyState />
			) : (
				<ul className="flex flex-col gap-6">
					{requests.map((request) => (
						<li key={request.id}>
							<AccessRequestCard
								request={request}
								headingLevel={headingLevel}
								issueInvite={issueInvite}
								declineRequest={declineRequest}
								onIssued={setIssued}
							/>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export { AccessRequestList };
