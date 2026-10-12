import type { FieldErrors, FormError } from '@/components/forms/form-state';
import { InvalidInputError } from '@/domain/problem';

// Helpers for the stand-ins that take the place of Server Actions and auth calls in the account and
// admin samples, so nothing leaves the page.

// Long enough to show each control's pending state.
const standInDelayMilliseconds = 800;

// Settles after a moment, as a request would.
export function standIn<Result>(result: Result): Promise<Result> {
	return new Promise((resolve) => setTimeout(() => resolve(result), standInDelayMilliseconds));
}

// Checks input with the domain's parser, as the services do, so field errors carry their real copy:
// the first problem for each field. Undefined when the input is valid.
export function inputProblems(parse: () => unknown): FormError | undefined {
	try {
		parse();
	} catch (error) {
		if (!(error instanceof InvalidInputError)) {
			throw error;
		}
		const fieldErrors: FieldErrors = {};
		for (const { path, message } of error.problems) {
			fieldErrors[path] ??= message;
		}
		return { status: 'error', fieldErrors };
	}
	return undefined;
}
