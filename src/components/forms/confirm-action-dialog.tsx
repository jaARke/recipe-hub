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
	createAlertDialogHandle,
	type AlertDialogHandle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

// Opens the dialog from another control, such as a menu's item, which is gone once the menu closes:
// the handle the control opens it with, and the element focus returns to, such as the menu's button.
export type ConfirmActionDialogOpener = {
	handle: AlertDialogHandle;
	returnFocusTo: React.RefObject<HTMLElement | null>;
};

// An opener that lasts as long as the component holding it. The control calls handle.open(null).
function useConfirmActionDialogOpener(
	returnFocusTo: React.RefObject<HTMLElement | null>
): ConfirmActionDialogOpener {
	const [handle] = React.useState(() => createAlertDialogHandle());
	return React.useMemo(() => ({ handle, returnFocusTo }), [handle, returnFocusTo]);
}

// What opens the dialog: its own button, or another control through an opener.
type ConfirmActionDialogTrigger =
	| {
			// The button's content, such as "Decline" with a screen-reader-only name of what it declines.
			trigger: React.ReactNode;
			opener?: never;
	  }
	| { trigger?: never; opener: ConfirmActionDialogOpener };

type ConfirmActionDialogProps = ConfirmActionDialogTrigger & {
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
	'trigger' | 'opener' | 'successMessage' | 'onSuccess'
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
	opener,
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
	const returnFocusTo = opener?.returnFocusTo ?? triggerRef;
	// Focus returns to the trigger, or to the opener's element. When the action removed it with its
	// item, Base UI would fall back to an element focused earlier, so focus is left for the page to
	// place.
	const returnFocus = () => {
		const element = returnFocusTo.current;
		return element?.isConnected === true ? element : false;
	};

	return (
		<AlertDialog {...dialogProps} handle={opener?.handle}>
			{opener === undefined && (
				<AlertDialogTrigger
					ref={triggerRef}
					render={<Button variant={variant === 'destructive' ? 'destructive' : 'outline'} />}
				>
					{trigger}
				</AlertDialogTrigger>
			)}
			<AlertDialogContent finalFocus={returnFocus}>
				<ConfirmActionForm {...formProps} action={confirm} variant={variant} />
			</AlertDialogContent>
		</AlertDialog>
	);
}

export { ConfirmActionDialog, useConfirmActionDialogOpener };
