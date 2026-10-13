'use client';

import { cn } from 'cn';
import { CircleCheckIcon, CircleIcon, TriangleAlertIcon } from 'lucide-react';
import type * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';

// Lets the member mark a problem as checked while reviewing it, as a checklist does. Checking it
// changes nothing else: the problem stays, and saving never waits for it.
export type ProblemCheck = {
	// Names the problem in the toggle's accessible name, such as "Step 2, For the glaze".
	name: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

export type SummarizedProblem = {
	message: string;
	// Names where the problem is, such as "Step 2, For the glaze"; absent for the whole form.
	label?: string;
	// The field, or the error shown in place of one, that the problem's link moves focus to.
	targetId?: string;
	check?: ProblemCheck;
};

function countThings(count: number): string {
	return `${count} ${count === 1 ? 'thing' : 'things'}`;
}

// Such as "1 of 3 checked", which the summary shows and the form announces as it changes.
export function countChecked(checked: number, total: number): string {
	return `${checked} of ${total} checked`;
}

// A fragment link alone scrolls without focusing the field in every browser, so the link focuses
// it, and centers it so its label shows too.
function focusTarget(event: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
	const target = document.getElementById(targetId);
	if (target === null) {
		return;
	}
	event.preventDefault();
	target.focus({ preventScroll: true });
	target.scrollIntoView({ block: 'center' });
}

// A pressed button rather than a checkbox, since it marks progress and sends nothing with the form.
// Its accessible name stays the same as it's pressed, and its text shows the state.
function ProblemCheckToggle({
	check: { name, checked, onCheckedChange },
}: {
	check: ProblemCheck;
}) {
	const Icon = checked ? CircleCheckIcon : CircleIcon;

	return (
		<Button
			type="button"
			variant="secondary"
			size="sm"
			aria-pressed={checked}
			aria-label={`Mark as checked: ${name}`}
			onClick={() => onCheckedChange(!checked)}
		>
			<Icon data-icon="inline-start" aria-hidden="true" />
			{checked ? 'Checked' : 'Mark as checked'}
		</Button>
	);
}

// A problem beside its field, as FieldError shows one, with its toggle while the member reviews it.
// A checked problem dims. Only a class changes, since any change to an alert's text reads it again.
function FieldProblem({
	check,
	children,
	...errorProps
}: React.ComponentProps<typeof FieldError> & { check?: ProblemCheck }) {
	if (check === undefined) {
		return <FieldError {...errorProps}>{children}</FieldError>;
	}

	return (
		<div className="flex flex-col items-start gap-2">
			<FieldError {...errorProps}>
				<span className={check.checked ? 'text-muted-foreground' : undefined}>{children}</span>
			</FieldError>
			<ProblemCheckToggle check={check} />
		</div>
	);
}

// A form's problems in one list, each linking to where it shows, so a long form can be checked from
// the top. With toggles it's no alert, since an alert reads all its text again whenever one changes.
function ProblemSummary({ problems }: { problems: readonly SummarizedProblem[] }) {
	if (problems.length === 0) {
		return null;
	}
	const checkable = problems.some(({ check }) => check !== undefined);
	const checkedCount = problems.filter(({ check }) => check?.checked === true).length;

	return (
		<Alert variant="destructive" role={checkable ? undefined : 'alert'}>
			<TriangleAlertIcon aria-hidden="true" />
			<AlertTitle>Check {countThings(problems.length)}</AlertTitle>
			<AlertDescription>
				{checkable && <p>{countChecked(checkedCount, problems.length)}</p>}
				<ul className={cn('flex list-disc flex-col pl-4', checkable ? 'gap-3' : 'gap-1')}>
					{problems.map(({ message, label, targetId, check }, index) => {
						const text = label === undefined ? message : `${label}: ${message}`;
						return (
							<li key={index}>
								<div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
									<span className={check?.checked === true ? 'text-muted-foreground' : undefined}>
										{targetId === undefined ? (
											text
										) : (
											<a href={`#${targetId}`} onClick={(event) => focusTarget(event, targetId)}>
												{text}
											</a>
										)}
									</span>
									{check !== undefined && <ProblemCheckToggle check={check} />}
								</div>
							</li>
						);
					})}
				</ul>
			</AlertDescription>
		</Alert>
	);
}

export { FieldProblem, ProblemSummary };
