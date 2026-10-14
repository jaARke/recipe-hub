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
import { Input } from '@/components/ui/input';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@/components/ui/input-group';

// A field in a FieldRow and what it says below the row. Its parts take TextField's ids.
type RowField = {
	id: string;
	// Shown above the control, and naming the field in its error and note.
	label: string;
	description?: React.ReactNode;
	error?: string;
	// Something to check against the original, as when reviewing a draft. It is no error.
	note?: FieldNoteContent;
};

type RowTextFieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
	field: RowField;
	// Said after the label to assistive technology, such as ", in minutes" where the unit shows. The
	// control's name carries it, since a visually hidden span in the label is named with a space before.
	hiddenLabel?: string;
	// Shown at the input's end, such as "min".
	unit?: string;
};

// A labeled input in a FieldRow, tied to its description, error, and note below the row.
function RowTextField({ field, hiddenLabel, unit, ...inputProps }: RowTextFieldProps) {
	const { id, label, description, error, note } = field;
	const ids = textFieldIds(id);
	const invalid = error !== undefined;
	const controlProps = {
		id,
		'aria-label': hiddenLabel === undefined ? undefined : `${label}${hiddenLabel}`,
		'aria-invalid': invalid ? ('true' as const) : undefined,
		'aria-describedby': describedBy(
			description !== undefined && ids.description,
			invalid && ids.error,
			note !== undefined && fieldNoteMessageId(ids.note)
		),
		...inputProps,
	};

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{unit === undefined ? (
				<Input {...controlProps} />
			) : (
				<InputGroup>
					<InputGroupInput {...controlProps} />
					<InputGroupAddon align="inline-end">
						{/* The label says the unit to assistive technology. */}
						<InputGroupText aria-hidden="true">{unit}</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			)}
		</Field>
	);
}

// Short fields side by side at every width, such as the times. A column is too narrow for a note,
// so each field's description, error, and note follow the row, the error and note named for it.
function FieldRow({
	fields,
	children,
}: {
	fields: readonly RowField[];
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-3 gap-4">{children}</div>
			{fields.map(({ id, label, description, error, note }) => {
				const ids = textFieldIds(id);
				return (
					<React.Fragment key={id}>
						{description !== undefined && (
							<FieldDescription id={ids.description}>{description}</FieldDescription>
						)}
						{error !== undefined && (
							<FieldProblem id={ids.error}>
								{label}: {error}
							</FieldProblem>
						)}
						{note !== undefined && (
							<FieldNote
								id={ids.note}
								name={label}
								{...note}
								message={`${label}: ${note.message}`}
							/>
						)}
					</React.Fragment>
				);
			})}
		</div>
	);
}

export { FieldRow, RowTextField };
