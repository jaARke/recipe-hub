import * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import {
	FieldNote,
	fieldNoteMessageId,
	type FieldNoteContent,
} from '@/components/forms/field-note';
import { FieldProblem } from '@/components/forms/problem-summary';
import { textFieldIds } from '@/components/forms/text-field';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

type TextareaFieldProps = Omit<React.ComponentProps<typeof Textarea>, 'id'> & {
	id: string;
	label: string;
	description?: React.ReactNode;
	error?: string;
	// Something to check against the original, as when reviewing a draft. It is no error.
	note?: FieldNoteContent;
};

// A labeled textarea whose description, error, and note, when it has them, are tied to it, as
// TextField does for one line.
function TextareaField({
	id,
	label,
	description,
	error,
	note,
	...textareaProps
}: TextareaFieldProps) {
	const ids = textFieldIds(id);
	const invalid = error !== undefined;

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea
				id={id}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy(
					description !== undefined && ids.description,
					invalid && ids.error,
					note !== undefined && fieldNoteMessageId(ids.note)
				)}
				{...textareaProps}
			/>
			{description !== undefined && (
				<FieldDescription id={ids.description}>{description}</FieldDescription>
			)}
			{invalid && <FieldProblem id={ids.error}>{error}</FieldProblem>}
			{note !== undefined && <FieldNote id={ids.note} name={label} {...note} />}
		</Field>
	);
}

export { TextareaField };
