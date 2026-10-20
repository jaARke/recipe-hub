'use client';

import { CircleCheckIcon, ListChecksIcon } from 'lucide-react';
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
// the first; once nothing is left, it stays to say everything's checked and what comes next. It takes
// focus as a form opens with notes to check, as an import's draft does, and as the last note looks
// right. It isn't announced as its count changes, since "Looks right" announces what is left.
function ReviewNotesIntro({
	id,
	count,
	whenChecked,
	onStart,
}: {
	id: string;
	// What is left to check; none once everything is checked.
	count: number;
	// What to do once everything is checked, such as "Add it to the cookbook when you’re ready."
	whenChecked: string;
	onStart: () => void;
}) {
	if (count === 0) {
		return (
			<Alert id={id} tabIndex={-1} role={undefined} aria-live={undefined}>
				<CircleCheckIcon aria-hidden="true" />
				<AlertTitle>Everything’s checked</AlertTitle>
				<AlertDescription>{whenChecked}</AlertDescription>
			</Alert>
		);
	}

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

// At the right of the form's action bar while anything is left to check: how many, and Next, which
// goes to the next note. Its count isn't announced as it changes, as the intro's isn't. Phones show
// "3 left", so the row fits beside Save; Next's description stays "3 to check".
function ReviewNotesNext({ id, count, onNext }: { id: string; count: number; onNext: () => void }) {
	return (
		<div className="flex shrink-0 items-center gap-3">
			<p id={id} className="text-sm text-muted-foreground">
				{count} <span className="max-sm:sr-only">to check</span>
				<span aria-hidden="true" className="sm:hidden">
					left
				</span>
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
	// What saving anyway is called, such as "Add anyway".
	saveAnywayLabel: string;
	// When the notes go, which ends the description, such as "it’s added to the cookbook".
	notesKeptUntil: string;
	onSaveAnyway: () => void;
};

// Asks before saving with things left to check. Saving anyway is the member's call: the warning
// never blocks a save.
function UncheckedSaveDialog({
	open,
	onOpenChange,
	count,
	onShow,
	saveAnywayLabel,
	notesKeptUntil,
	onSaveAnyway,
}: UncheckedSaveDialogProps) {
	// Set by "Show me", whose focus goes to the first note rather than back to Save. It lasts until
	// the dialog next opens, since the dialog decides where focus returns after it has closed.
	const showing = React.useRef(false);
	const popup = React.useRef<HTMLDivElement>(null);

	// Back to Save as the dialog closes, unless "Show me" sends focus to a note, or the save it started
	// has already moved focus outside it, as a failed save does to the problem summary.
	function returnFocus(): boolean {
		if (showing.current) {
			return false;
		}
		const active = document.activeElement;
		return (
			active === null || active === document.body || (popup.current?.contains(active) ?? false)
		);
	}

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
			<AlertDialogContent ref={popup} finalFocus={returnFocus}>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{countedThings(count, 'hasn’t been checked', 'haven’t been checked')}
					</AlertDialogTitle>
					<AlertDialogDescription>
						Each has a note in the form. The notes aren’t kept once {notesKeptUntil}.
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
						{saveAnywayLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export { ReviewNotesIntro, ReviewNotesNext, UncheckedSaveDialog };
