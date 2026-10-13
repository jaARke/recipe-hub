'use client';

import * as React from 'react';
import { Specimen } from '@/components/design-reference/reference-section';
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

type SampleAlertDialogProps = {
	variant: 'destructive' | 'default';
	size: 'default' | 'sm';
	trigger: string;
	title: string;
	description: string;
	cancelLabel: string;
	confirmLabel: string;
};

// The confirming button stands in for an action, so it closes the dialog itself.
function SampleAlertDialog({
	variant,
	size,
	trigger,
	title,
	description,
	cancelLabel,
	confirmLabel,
}: SampleAlertDialogProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={<Button variant={variant === 'destructive' ? 'destructive' : 'outline'} />}
			>
				{trigger}
			</AlertDialogTrigger>
			<AlertDialogContent size={size}>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction variant={variant} onClick={() => setOpen(false)}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function AlertDialogSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="Escape or the cancel button dismisses, a click outside does not; focus returns to the trigger">
				<SampleAlertDialog
					variant="destructive"
					size="default"
					trigger="Delete recipe"
					title="Delete “Buttermilk biscuits”?"
					description="The recipe and its photos are deleted. This can't be undone."
					cancelLabel="Keep recipe"
					confirmLabel="Delete recipe"
				/>
			</Specimen>
			<Specimen label='size="sm", for an action that takes nothing away'>
				<SampleAlertDialog
					variant="default"
					size="sm"
					trigger="Make admin"
					title="Make Jordan an admin?"
					description="They can review access requests, invite people, change who is an admin, and edit any recipe."
					cancelLabel="Keep as member"
					confirmLabel="Make admin"
				/>
			</Specimen>
		</div>
	);
}

export { AlertDialogSpecimen };
