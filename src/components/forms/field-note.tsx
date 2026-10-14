import { CheckIcon, ScanEyeIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// What a review note says, and how the member clears it when what it is about can stay as it is.
export type FieldNoteContent = {
	message: string;
	// Absent where the field has to change first.
	onConfirm?: () => void;
};

type FieldNoteProps = FieldNoteContent & {
	id: string;
	// Names what the note is about in its button's accessible name, such as "Step 2".
	name?: string;
};

// The note's message, which the field it is about names in aria-describedby.
export function fieldNoteMessageId(noteId: string): string {
	return `${noteId}-message`;
}

// A note under a field asking the member to check it against the original, as when reviewing an
// import. It is no error: the field stays valid, and nothing announces the note as it appears. It
// takes focus as the member moves from one note to the next.
function FieldNote({ id, name, message, onConfirm }: FieldNoteProps) {
	return (
		<Alert id={id} tabIndex={-1} role={undefined} aria-live={undefined}>
			<ScanEyeIcon aria-hidden="true" />
			<AlertTitle>Check</AlertTitle>
			<AlertDescription id={fieldNoteMessageId(id)}>{message}</AlertDescription>
			{onConfirm !== undefined && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="col-start-2 mt-2 justify-self-start"
					aria-label={name === undefined ? undefined : `Looks right: ${name}`}
					onClick={onConfirm}
				>
					<CheckIcon data-icon="inline-start" aria-hidden="true" />
					Looks right
				</Button>
			)}
		</Alert>
	);
}

export { FieldNote };
