import type { FieldErrors } from '@/components/forms/form-state';
import type { Problem } from '@/domain/problem';

// The first problem for each field, since Zod reports the most basic one first.
export function fieldErrorsFrom(problems: readonly Problem[]): FieldErrors {
	const fieldErrors: FieldErrors = {};
	for (const { path, message } of problems) {
		fieldErrors[path] ??= message;
	}
	return fieldErrors;
}
