'use client';

import { CopyIcon } from 'lucide-react';
import * as React from 'react';
import type { IssuedInvite } from '@/components/admin/admin-forms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

function deliveryMessage({ delivery }: IssuedInvite): string {
	switch (delivery.status) {
		case 'not-requested':
			return 'Copy the link and send it to them yourself.';
		case 'sent':
			return `We emailed the invite to ${delivery.to}.`;
		case 'failed':
			return `We couldn't email the invite to ${delivery.to}. Copy the link and send it to them yourself.`;
	}
}

async function copyLink(link: string) {
	try {
		await navigator.clipboard.writeText(link);
		toast.add({ title: 'Link copied' });
	} catch {
		toast.add({
			type: 'error',
			title: "Couldn't copy the link",
			description: 'Select the link and copy it yourself.',
		});
	}
}

// The only time the link is shown: only its hash is stored.
function IssuedInviteNotice({ invite, className }: { invite: IssuedInvite; className?: string }) {
	const linkId = React.useId();
	const noteId = `${linkId}-note`;

	return (
		<Card size="sm" className={className}>
			<CardHeader>
				<CardTitle>Invite for {invite.displayName}</CardTitle>
				<CardDescription>{deliveryMessage(invite)}</CardDescription>
			</CardHeader>
			<CardContent>
				<Field>
					<FieldLabel htmlFor={linkId}>Invite link</FieldLabel>
					<div className="flex gap-2">
						<Input
							id={linkId}
							readOnly
							value={invite.link}
							aria-describedby={noteId}
							onFocus={(event) => event.currentTarget.select()}
						/>
						<Button type="button" variant="outline" onClick={() => copyLink(invite.link)}>
							<CopyIcon data-icon="inline-start" aria-hidden="true" />
							Copy link
						</Button>
					</div>
					<FieldDescription id={noteId}>
						This link won&apos;t be shown again. If it&apos;s lost, revoke the invite and create a
						new one.
					</FieldDescription>
				</Field>
			</CardContent>
		</Card>
	);
}

export { IssuedInviteNotice };
