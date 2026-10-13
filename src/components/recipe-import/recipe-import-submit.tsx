'use client';

import * as React from 'react';
import { FormStatusMessage } from '@/components/forms/form-status-message';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

type RecipeImportSubmitProps = {
	pending: boolean;
	label: string;
	pendingLabel: string;
	// What the import is doing while it runs, such as "Reading the page…".
	stage: string;
	// Why the button waits, such as photos still uploading. It waits while there is one.
	waitNote?: string;
};

function countSeconds(seconds: number): string {
	return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

// Whole seconds since the component mounted. The start survives a hidden page, so the count picks up
// where it was when the page shows again.
function useElapsedSeconds(): number {
	const [seconds, setSeconds] = React.useState(0);
	const startRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		const start = (startRef.current ??= Date.now());
		const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
		return () => clearInterval(timer);
	}, []);

	return seconds;
}

// Shown and not announced, since a live region would speak every second.
function ElapsedSeconds() {
	const seconds = useElapsedSeconds();

	return (
		<p className="font-mono text-xs tracking-wide text-muted-foreground uppercase tabular-nums">
			{countSeconds(seconds)}
		</p>
	);
}

// The import's button, and while the import runs, what it is doing and for how long. An import takes
// up to a minute or two, so the stage is announced once as it starts.
function RecipeImportSubmit({
	pending,
	label,
	pendingLabel,
	stage,
	waitNote,
}: RecipeImportSubmitProps) {
	const waitNoteId = React.useId();

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
				{waitNote !== undefined && (
					<p id={waitNoteId} className="text-sm text-muted-foreground">
						{waitNote}
					</p>
				)}
				<Button
					type="submit"
					disabled={pending || waitNote !== undefined}
					focusableWhenDisabled
					aria-describedby={waitNote === undefined ? undefined : waitNoteId}
				>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? pendingLabel : label}
				</Button>
			</div>
			{pending && <Progress value={null} aria-label={stage} />}
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:justify-end">
				<FormStatusMessage message={pending ? stage : undefined} />
				{pending && <ElapsedSeconds />}
			</div>
		</div>
	);
}

export { RecipeImportSubmit };
