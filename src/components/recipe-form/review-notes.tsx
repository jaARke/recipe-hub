'use client';

import { ListChecksIcon } from 'lucide-react';
import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// Such as "3 things need a second look", and "1 thing needs" for one.
function countedThings(count: number, one: string, many: string): string {
	return count === 1 ? `1 thing ${one}` : `${count} things ${many}`;
}

// Said as "Looks right" clears a note: how many are left, so a screen reader follows along.
export function checkedAnnouncement(left: number): string {
	return left === 0 ? 'Checked. Nothing left to check.' : `Checked. ${left} left.`;
}

// Heads the form while anything is left to check against the original, and starts the member on
// the first. It takes focus as an import's review opens, and isn't announced as its count changes,
// since "Looks right" announces what is left.
function ReviewNotesIntro({
	id,
	count,
	onStart,
}: {
	id: string;
	count: number;
	onStart: () => void;
}) {
	return (
		<Alert id={id} tabIndex={-1} role={undefined} aria-live={undefined}>
			<ListChecksIcon aria-hidden="true" />
			<AlertTitle>{countedThings(count, 'needs a second look', 'need a second look')}</AlertTitle>
			<AlertDescription>
				Each has a note below. Compare it with the original, then fix it or choose Looks right.
			</AlertDescription>
			<Button
				type="button"
				size="sm"
				className="col-start-2 mt-2 justify-self-start"
				onClick={onStart}
			>
				Start checking
			</Button>
		</Alert>
	);
}

// Beside Save in the form's action bar while anything is left to check: how many, and Next, which
// goes to the next note. Its count isn't announced as it changes, as the intro's isn't.
function ReviewNotesNext({ id, count, onNext }: { id: string; count: number; onNext: () => void }) {
	return (
		<div className="flex shrink-0 items-center gap-3">
			<p id={id} className="text-sm text-muted-foreground">
				{count} to check
			</p>
			<Button type="button" variant="outline" aria-describedby={id} onClick={onNext}>
				Next
			</Button>
		</div>
	);
}

type UncheckedSaveDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// What is left to check, which the title counts.
	count: number;
	// Moves focus to the first thing to check, once the dialog has closed.
	onShow: () => void;
	onSaveAnyway: () => void;
};

// Asks before saving with things left to check. Saving anyway is the member's call: the warning
// never blocks a save.
function UncheckedSaveDialog({
	open,
	onOpenChange,
	count,
	onShow,
	onSaveAnyway,
}: UncheckedSaveDialogProps) {
	// Set by "Show me", whose focus goes to the first note rather than back to Save. It lasts until
	// the dialog next opens, since the dialog decides where focus returns after it has closed.
	const showing = React.useRef(false);

	return (
		<AlertDialog
			open={open}
			onOpenChange={onOpenChange}
			onOpenChangeComplete={(isOpen) => {
				if (isOpen) {
					showing.current = false;
				} else if (showing.current) {
					onShow();
				}
			}}
		>
			<AlertDialogContent finalFocus={() => !showing.current}>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{countedThings(count, 'hasn’t been checked', 'haven’t been checked')}
					</AlertDialogTitle>
					<AlertDialogDescription>
						Each has a note in the form. The notes aren’t kept once the recipe is saved.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel
						variant="default"
						onClick={() => {
							showing.current = true;
						}}
					>
						Show me
					</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						variant="outline"
						onClick={() => {
							onOpenChange(false);
							onSaveAnyway();
						}}
					>
						Save anyway
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export { ReviewNotesIntro, ReviewNotesNext, UncheckedSaveDialog };
