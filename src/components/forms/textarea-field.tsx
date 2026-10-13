import * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import { FieldProblem, type ProblemCheck } from '@/components/forms/problem-summary';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

type TextareaFieldProps = Omit<React.ComponentProps<typeof Textarea>, 'id'> & {
	id: string;
	label: string;
	description?: React.ReactNode;
	error?: string;
	// Lets the member mark the error as checked, as when reviewing a draft's problems.
	errorCheck?: ProblemCheck;
};

// A labeled textarea whose description and error, when it has them, are tied to it, as TextField does
// for one line.
function TextareaField({
	id,
	label,
	description,
	error,
	errorCheck,
	...textareaProps
}: TextareaFieldProps) {
	const descriptionId = `${id}-description`;
	const errorId = `${id}-error`;
	const invalid = error !== undefined;

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea
				id={id}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy(
					description !== undefined && descriptionId,
					invalid && errorId
				)}
				{...textareaProps}
			/>
			{description !== undefined && (
				<FieldDescription id={descriptionId}>{description}</FieldDescription>
			)}
			{invalid && (
				<FieldProblem id={errorId} check={errorCheck}>
					{error}
				</FieldProblem>
			)}
		</Field>
	);
}

export { TextareaField };
