import * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type TextFieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
	id: string;
	label: string;
	description?: React.ReactNode;
	error?: string;
};

// A labeled input whose description and error, when it has them, are tied to it.
function TextField({ id, label, description, error, ...inputProps }: TextFieldProps) {
	const descriptionId = `${id}-description`;
	const errorId = `${id}-error`;
	const invalid = error !== undefined;

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy(
					description !== undefined && descriptionId,
					invalid && errorId
				)}
				{...inputProps}
			/>
			{description !== undefined && (
				<FieldDescription id={descriptionId}>{description}</FieldDescription>
			)}
			{invalid && <FieldError id={errorId}>{error}</FieldError>}
		</Field>
	);
}

export { TextField };
