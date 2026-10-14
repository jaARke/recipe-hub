'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { useActionDialog } from '@/components/forms/use-action-dialog';
import { useFormAction } from '@/components/forms/use-form-action';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
	// Said in a toast, because the dialog closes once the action succeeds, often with the item it
	// changes or removes, or the page it leaves.
	successMessage: string;
	failureMessage: string;
	action: FormAction;
	// Runs after the success toast, such as to leave a page whose subject the action deleted.
	onSuccess?: () => void;
	// Default for an action that takes nothing away, such as making someone an admin.
	variant: 'destructive' | 'default';
	// Hidden inputs naming what the action acts on.
	children: React.ReactNode;
};

type ConfirmActionFormProps = Omit<
	ConfirmActionDialogProps,
	'trigger' | 'successMessage' | 'onSuccess'
>;

// Rendered inside the popup, so closing the dialog clears a refusal's reason.
function ConfirmActionForm({
	title,
	description,
	cancelLabel,
	confirmLabel,
	pendingLabel,
	failureMessage,
	action,
	variant,
	children,
}: ConfirmActionFormProps) {
	const [state, formProps, pending] = useFormAction(action, failureMessage);

	return (
		<form {...formProps} className="grid gap-6">
			{children}
			<AlertDialogHeader>
				<AlertDialogTitle>{title}</AlertDialogTitle>
				<AlertDialogDescription>{description}</AlertDialogDescription>
			</AlertDialogHeader>
			<FormErrorAlert message={state.status === 'error' ? state.message : undefined} />
			<AlertDialogFooter>
				<AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
				<AlertDialogAction type="submit" variant={variant} disabled={pending} focusableWhenDisabled>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? pendingLabel : confirmLabel}
				</AlertDialogAction>
			</AlertDialogFooter>
		</form>
	);
}

// Asks before a destructive or consequential action, stays open while it runs, shows a refused
// one's reason in place, and closes once it succeeds.
function ConfirmActionDialog({
	trigger,
	successMessage,
	action,
	onSuccess,
	variant,
	...formProps
}: ConfirmActionDialogProps) {
	const [dialogProps, confirm] = useActionDialog(action, () => {
		toast.add({ type: 'success', title: successMessage });
		onSuccess?.();
	});
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	// Focus returns to the trigger. When the action removed it with its item, Base UI would fall back
	// to an element focused earlier, so focus is left for the page to place.
	const returnFocusToTrigger = () => triggerRef.current?.isConnected === true;

	return (
		<AlertDialog {...dialogProps}>
			<AlertDialogTrigger
				ref={triggerRef}
				render={<Button variant={variant === 'destructive' ? 'destructive' : 'outline'} />}
			>
				{trigger}
			</AlertDialogTrigger>
			<AlertDialogContent finalFocus={returnFocusToTrigger}>
				<ConfirmActionForm {...formProps} action={confirm} variant={variant} />
			</AlertDialogContent>
		</AlertDialog>
	);
}

export { ConfirmActionDialog };
