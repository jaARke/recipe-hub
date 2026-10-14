'use client';

import { TriangleAlertIcon } from 'lucide-react';
import * as React from 'react';
import { focusCentered } from '@/components/forms/focus-centered';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FieldError } from '@/components/ui/field';

export type SummarizedProblem = {
	message: string;
	// Names where the problem is, such as "Step 2, For the glaze"; absent for the whole form.
	label?: string;
	// The field, or the error shown in place of one, that the problem's link moves focus to.
	targetId?: string;
};

// Takes the alert role and its aria-live off a FieldError, so its text is read only when focus
// reaches the field it describes.
const unannounced = { role: undefined, 'aria-live': undefined } as const;

// True inside a form whose ProblemSummary lists every problem and takes focus after a failed save.
const SummarizedProblemsContext = React.createContext(false);

function countThings(count: number): string {
	return `${count} ${count === 1 ? 'thing' : 'things'}`;
}

// A fragment link alone scrolls without focusing the field in every browser, so this focuses it.
function focusTarget(event: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
	if (focusCentered(targetId)) {
		event.preventDefault();
	}
}

// A problem beside its field, as FieldError shows one. Where the form's summary lists it, it isn't
// announced as it appears, so a failed save reads as the summary rather than every problem at once.
function FieldProblem(props: React.ComponentProps<typeof FieldError>) {
	const summarized = React.useContext(SummarizedProblemsContext);
	return <FieldError {...props} {...(summarized ? unannounced : undefined)} />;
}

// A save's problems in one list, each linking to where it shows, so a long form can be fixed from
// the top. It takes focus after a failed save, ahead of the fields it lists (useFormAction).
function ProblemSummary({ problems }: { problems: readonly SummarizedProblem[] }) {
	if (problems.length === 0) {
		return null;
	}

	return (
		<Alert variant="destructive" tabIndex={-1}>
			<TriangleAlertIcon aria-hidden="true" />
			<AlertTitle>Fix {countThings(problems.length)} to save</AlertTitle>
			<AlertDescription>
				<ul className="flex list-disc flex-col gap-1 pl-4">
					{problems.map(({ message, label, targetId }, index) => {
						const text = label === undefined ? message : `${label}: ${message}`;
						return (
							<li key={index}>
								{targetId === undefined ? (
									text
								) : (
									<a href={`#${targetId}`} onClick={(event) => focusTarget(event, targetId)}>
										{text}
									</a>
								)}
							</li>
						);
					})}
				</ul>
			</AlertDescription>
		</Alert>
	);
}

// Wraps a form's fields when its ProblemSummary lists their problems, which then stay quiet beside
// the fields.
function SummarizedProblems({ children }: { children: React.ReactNode }) {
	return (
		<SummarizedProblemsContext.Provider value={true}>{children}</SummarizedProblemsContext.Provider>
	);
}

export { FieldProblem, ProblemSummary, SummarizedProblems };
