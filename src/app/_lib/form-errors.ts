import 'server-only';
import { fieldErrorsFrom } from '@/components/forms/field-errors';
import type { FormError } from '@/components/forms/form-state';
import { InvalidInputError } from '@/domain/problem';
import { AppError, findQueryError, withoutQueryParameters } from '@/lib/errors';

// The copy for each expected failure a form can meet, keyed by error code.
const errorMessages: Partial<Record<string, string>> = {
	'access.sign-in-required': 'Your session has ended. Sign in again to continue.',
	'access.forbidden': "Your account can't do that.",
	'access.invite-unavailable':
		"Your invite can't be used anymore. Ask the person who invited you for a new one.",
	'access.invite-not-found': 'That invite was already used, revoked, or has expired.',
	'access.request-not-found':
		'That request was already handled. Reload the page to see the latest.',
	'recipe.not-found':
		'That recipe was deleted, or this page is out of date. Reload the page and try again.',
	'recipe.edit-conflict':
		'This recipe changed after you opened it. Copy anything you want to keep, then reload the page and make your changes again.',
};

// Next logs a rethrown error in full, causes included, so a database error is replaced by one that
// names the failed query without its parameters, which hold what the visitor typed.
function withoutPersonalData(error: unknown): unknown {
	const queryError = findQueryError(error);
	return queryError === undefined ? error : new Error(withoutQueryParameters(queryError.message));
}

// Turns an expected failure into the form's error state. Anything else is rethrown: Next logs it, and
// the form shows its failure message.
export function toFormError(error: unknown): FormError {
	if (error instanceof InvalidInputError) {
		return { status: 'error', fieldErrors: fieldErrorsFrom(error.problems) };
	}

	const message = error instanceof AppError ? errorMessages[error.code] : undefined;
	if (message === undefined) {
		throw withoutPersonalData(error);
	}

	return { status: 'error', message, fieldErrors: {} };
}
