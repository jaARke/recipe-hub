import { CircleCheckIcon } from 'lucide-react';

// A confirmation, such as "Saved.", carries a check; progress, such as an import's stage, does not.
type FormStatusKind = 'confirmation' | 'progress';

type FormStatusMessageProps = {
	kind: FormStatusKind;
	message: string | undefined;
};

// A form's confirmation or progress. Always rendered, so screen readers announce the message when it
// appears, and out of the layout while empty. The explicit aria-live, which the role implies, keeps it
// announced while a Base UI popup hides everything else from screen readers.
function FormStatusMessage({ kind, message }: FormStatusMessageProps) {
	if (message === undefined) {
		return <p role="status" aria-live="polite" className="sr-only" />;
	}

	return (
		<p role="status" aria-live="polite" className="flex gap-1.5 text-sm text-muted-foreground">
			{/* Centered on the first line, so a message that wraps keeps its check at the start. */}
			{kind === 'confirmation' && (
				<CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			)}
			{message}
		</p>
	);
}

export { FormStatusMessage };
