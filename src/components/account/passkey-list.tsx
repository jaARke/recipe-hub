'use client';

import { KeyRoundIcon } from 'lucide-react';
import * as React from 'react';
import { passkeyFieldNames } from '@/components/account/account-forms';
import { ConfirmActionDialog } from '@/components/forms/confirm-action-dialog';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { TextField } from '@/components/forms/text-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/dates';

// What the account page shows of a passkey: the server keeps only its public key.
type PasskeySummary = {
	id: string;
	name?: string | null;
	createdAt?: Date | null;
};

type PasskeyListProps = {
	passkeys: readonly PasskeySummary[];
	renamePasskey: FormAction;
	removePasskey: FormAction;
};

type RenamePasskeyDialogProps = {
	passkeyId: string;
	name: string;
	// The trigger's screen-reader-only name of the passkey it renames.
	label: string;
	action: FormAction;
};

// Closes once the name is saved, and focus returns to the passkey's Rename button.
function RenamePasskeyDialog({ passkeyId, name, label, action }: RenamePasskeyDialogProps) {
	const [open, setOpen] = React.useState(false);
	const [state, formAction, pending] = useFormAction(async (previous, formData) => {
		const next = await action(previous, formData);
		if (next.status === 'success') {
			setOpen(false);
		}
		return next;
	}, "We couldn't rename that passkey. Check your connection and try again.");
	const failure = state.status === 'error' ? state : undefined;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" />}>
				Rename<span className="sr-only">{label}</span>
			</DialogTrigger>
			<DialogContent>
				<form action={formAction} noValidate className="grid gap-6">
					<input type="hidden" name={passkeyFieldNames.id} value={passkeyId} />
					<DialogHeader>
						<DialogTitle>Rename passkey</DialogTitle>
						<DialogDescription>
							A name helps you tell your passkeys apart. Only you see it.
						</DialogDescription>
					</DialogHeader>
					<FormErrorAlert message={failure?.message} />
					<TextField
						id={`passkey-name-${passkeyId}`}
						name={passkeyFieldNames.name}
						label="Name"
						required
						autoComplete="off"
						error={failure?.fieldErrors[passkeyFieldNames.name]}
						defaultValue={failure?.values?.[passkeyFieldNames.name] ?? name}
					/>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
						<Button type="submit" disabled={pending} focusableWhenDisabled>
							{pending && <Spinner data-icon="inline-start" />}
							{pending ? 'Saving name' : 'Save name'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function PasskeyList({ passkeys, renamePasskey, removePasskey }: PasskeyListProps) {
	if (passkeys.length === 0) {
		return <p className="text-muted-foreground">You haven&apos;t added a passkey yet.</p>;
	}

	return (
		<ul className="flex flex-col divide-y border-y">
			{passkeys.map((passkey) => {
				const name = passkey.name || 'Passkey';
				const added = passkey.createdAt ? formatDate(passkey.createdAt) : undefined;
				const label = added === undefined ? ` ${name}` : ` ${name}, added ${added}`;

				return (
					<li
						key={passkey.id}
						className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="flex min-w-0 items-center gap-3">
							<KeyRoundIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
							<div className="min-w-0">
								<p className="font-medium wrap-anywhere">{name}</p>
								{added !== undefined && (
									<p className="text-sm text-muted-foreground">Added {added}</p>
								)}
							</div>
						</div>
						<div className="flex flex-wrap gap-2 sm:shrink-0">
							<RenamePasskeyDialog
								passkeyId={passkey.id}
								name={name}
								label={label}
								action={renamePasskey}
							/>
							{/* A password manager told of the removal may delete the passkey from the device too. */}
							<ConfirmActionDialog
								variant="destructive"
								trigger={
									<>
										Remove<span className="sr-only">{label}</span>
									</>
								}
								title={`Remove “${name}”?`}
								description="You can't sign in with it anymore, and your password manager may delete it from your devices too."
								cancelLabel="Keep passkey"
								confirmLabel="Remove passkey"
								pendingLabel="Removing"
								successMessage="Passkey removed"
								failureMessage="We couldn't remove that passkey. Reload the page and try again."
								action={removePasskey}
							>
								<input type="hidden" name={passkeyFieldNames.id} value={passkey.id} />
							</ConfirmActionDialog>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function PasskeyListSkeleton() {
	return (
		<div role="status" aria-live="polite" className="flex flex-col divide-y border-y">
			<span className="sr-only">Loading passkeys</span>
			<div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-4 w-36" />
				</div>
				<div className="flex flex-wrap gap-2 sm:shrink-0">
					<Skeleton className="h-9 w-20" />
					<Skeleton className="h-9 w-20" />
				</div>
			</div>
		</div>
	);
}

export { PasskeyList, PasskeyListSkeleton };
