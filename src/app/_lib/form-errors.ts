import 'server-only';
import { fieldErrorsFrom } from '@/components/forms/field-errors';
import type { FormError } from '@/components/forms/form-state';
import { InvalidInputError } from '@/domain/problem';
import { unstoredImageMessage } from '@/domain/recipe/recipe-image';
import { AppError } from '@/lib/errors';
import { settings } from '@/lib/settings';

// The copy for each expected failure a form can meet, keyed by error code.
const errorMessages: Partial<Record<string, string>> = {
	'access.sign-in-required': 'Your session has ended. Sign in again to continue.',
	'access.forbidden': 'Your account can’t do that.',
	'access.invite-unavailable':
		'Your invite can’t be used anymore. Ask the person who invited you for a new one.',
	'access.invite-not-found': 'That invite was already used, revoked, or has expired.',
	'access.request-not-found':
		'That request was already handled. Reload the page to see the latest.',
	'member.not-found': 'That account was removed. Reload the page to see the latest.',
	'member.role-conflict': 'That member’s role already changed. Reload the page to see the latest.',
	'member.owner': 'The owner’s account always stays an admin and can’t be removed.',
	'member.owner-only': 'Only the owner can remove another admin’s role or account.',
	'member.self-removal': 'You can’t remove yourself. Ask the owner to remove you.',
	'recipe.not-found':
		'That recipe was deleted, or this page is out of date. Reload the page and try again.',
	'recipe.edit-conflict':
		'This recipe changed after you opened it. Copy anything you want to keep, then reload the page and make your changes again.',
	'draft.edit-conflict':
		'This draft was saved somewhere else after you opened it here. Copy anything you want to keep, then reload the page to see that version.',
	'image.invalid-upload': unstoredImageMessage,
	'favorite.device-full': `You’ve reached the limit of ${settings.favorites.maxPerDevice} favorites on this device. Remove one to add another.`,
	'import.unavailable': 'This import can’t be saved anymore. Import the recipe again.',
	'import.page-refused': 'This website doesn’t support importing recipes.',
	'import.page-unavailable': 'We couldn’t open that page. Check the link and try again.',
	'import.no-recipe': 'We couldn’t find a recipe to import.',
	'import.rate-limited': `You’ve reached the limit of ${settings.imports.maxImportsPerDay} imports in 24 hours. Try again later, or enter the recipe manually.`,
	'import.paused': 'Imports are paused. You can still enter the recipe manually.',
	'import.failed': 'The import didn’t finish. Try again in a moment.',
	'import.timed-out': 'The import took too long. Try again in a moment.',
};

// Turns an expected failure into the form's error state. Anything else is rethrown: Next logs it, which
// prints a failed query without its parameters, and the form shows its failure message.
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
