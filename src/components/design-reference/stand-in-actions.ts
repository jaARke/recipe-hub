import { fieldErrorsFrom } from '@/components/forms/field-errors';
import type { FormError } from '@/components/forms/form-state';
import { InvalidInputError } from '@/domain/problem';

// Helpers for the stand-ins that take the place of Server Actions and auth calls in the account and
// admin samples, so nothing leaves the page.

// Long enough to show each control's pending state.
const standInDelayMilliseconds = 800;

// Settles after a moment, as a request would.
export function standIn<Result>(result: Result): Promise<Result> {
	return new Promise((resolve) => setTimeout(() => resolve(result), standInDelayMilliseconds));
}

// Checks input with the domain's parser, as the services do, so field errors carry their real copy.
// Undefined when the input is valid.
export function inputProblems(parse: () => unknown): FormError | undefined {
	try {
		parse();
	} catch (error) {
		if (!(error instanceof InvalidInputError)) {
			throw error;
		}
		return { status: 'error', fieldErrors: fieldErrorsFrom(error.problems) };
	}
	return undefined;
}
