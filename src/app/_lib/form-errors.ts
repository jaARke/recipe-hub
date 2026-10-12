import 'server-only';
import type { FieldErrors, FormError } from '@/components/forms/form-state';
import { InvalidInputError, type Problem } from '@/domain/problem';
import { AppError } from '@/lib/errors';

// The copy for each expected failure a form can meet, keyed by error code.
const errorMessages: Partial<Record<string, string>> = {
	'access.sign-in-required': 'Your session has ended. Sign in again to continue.',
	'access.forbidden': "Your account can't do that.",
	'access.invite-unavailable':
		"Your invite can't be used anymore. Ask the person who invited you for a new one.",
	'access.invite-not-found': 'That invite was already used, revoked, or has expired.',
	'access.request-not-found':
		'That request was already handled. Reload the page to see the latest.',
};

// The first problem for each field, since Zod reports the most basic one first.
function fieldErrorsFrom(problems: readonly Problem[]): FieldErrors {
	const fieldErrors: FieldErrors = {};
	for (const { path, message } of problems) {
		fieldErrors[path] ??= message;
	}
	return fieldErrors;
}

// Turns an expected failure into the form's error state. Anything else is rethrown: Next logs it, and
// the form shows its failure message.
export function toFormError(error: unknown): FormError {
	if (error instanceof InvalidInputError) {
		return { status: 'error', fieldErrors: fieldErrorsFrom(error.problems) };
	}

	const message = error instanceof AppError ? errorMessages[error.code] : undefined;
	if (message === undefined) {
		throw error;
	}

	return { status: 'error', message, fieldErrors: {} };
}
