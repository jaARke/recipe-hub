'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
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
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

type ConfirmActionDialogProps = {
	// The trigger's content, such as "Decline" with a screen-reader-only name of what it declines.
	trigger: React.ReactNode;
	title: string;
	description: string;
	cancelLabel: string;
	confirmLabel: string;
	pendingLabel: string;
	// Said in a toast, because the item the action removes takes this dialog with it.
	successMessage: string;
	failureMessage: string;
	action: FormAction;
	// Hidden inputs naming what the action acts on.
	children: React.ReactNode;
};

// Asks before a destructive action, and shows a refused one's reason in place.
function ConfirmActionDialog({
	trigger,
	title,
	description,
	cancelLabel,
	confirmLabel,
	pendingLabel,
	successMessage,
	failureMessage,
	action,
	children,
}: ConfirmActionDialogProps) {
	const [state, formAction, pending] = useFormAction(async (previous, formData) => {
		const next = await action(previous, formData);
		if (next.status === 'success') {
			toast.add({ type: 'success', title: successMessage });
		}
		return next;
	}, failureMessage);

	return (
		<Dialog>
			<DialogTrigger render={<Button variant="destructive" />}>{trigger}</DialogTrigger>
			<DialogContent showCloseButton={false}>
				<form action={formAction} className="grid gap-6">
					{children}
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<FormErrorAlert message={state.status === 'error' ? state.message : undefined} />
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
						<Button type="submit" variant="destructive" disabled={pending} focusableWhenDisabled>
							{pending && <Spinner data-icon="inline-start" />}
							{pending ? pendingLabel : confirmLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export { ConfirmActionDialog };
