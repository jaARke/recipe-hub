import * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import {
	FieldNote,
	fieldNoteMessageId,
	type FieldNoteContent,
} from '@/components/forms/field-note';
import { FieldProblem } from '@/components/forms/problem-summary';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type TextFieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
	id: string;
	label: string;
	description?: React.ReactNode;
	error?: string;
	// Something to check against the original, as when reviewing a draft. It is no error.
	note?: FieldNoteContent;
};

// The ids of a text field's parts, which TextareaField shares and a form moves focus to.
function textFieldIds(id: string) {
	return {
		description: `${id}-description`,
		error: `${id}-error`,
		note: `${id}-note`,
	};
}

// A labeled input whose description, error, and note, when it has them, are tied to it.
function TextField({ id, label, description, error, note, ...inputProps }: TextFieldProps) {
	const ids = textFieldIds(id);
	const invalid = error !== undefined;

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy(
					description !== undefined && ids.description,
					invalid && ids.error,
					note !== undefined && fieldNoteMessageId(ids.note)
				)}
				{...inputProps}
			/>
			{description !== undefined && (
				<FieldDescription id={ids.description}>{description}</FieldDescription>
			)}
			{invalid && <FieldProblem id={ids.error}>{error}</FieldProblem>}
			{note !== undefined && <FieldNote id={ids.note} name={label} {...note} />}
		</Field>
	);
}

export { TextField, textFieldIds };
