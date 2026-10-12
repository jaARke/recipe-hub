import * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

type TextareaFieldProps = Omit<React.ComponentProps<typeof Textarea>, 'id'> & {
	id: string;
	label: string;
	description?: React.ReactNode;
	error?: string;
};

// A labeled textarea whose description and error, when it has them, are tied to it, as TextField does
// for one line.
function TextareaField({ id, label, description, error, ...textareaProps }: TextareaFieldProps) {
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
			{invalid && <FieldError id={errorId}>{error}</FieldError>}
		</Field>
	);
}

export { TextareaField };
