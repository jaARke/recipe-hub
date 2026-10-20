import { describe, expect, it } from 'vitest';
import { toFormError } from '@/app/_lib/form-errors';
import {
	SavedDraftDeleteConflictError,
	SavedDraftEditConflictError,
	SavedDraftGoneError,
} from '@/application/drafts/errors';
import { DeviceFavoritesFullError } from '@/application/favorites/errors';
import {
	ImportFailedError,
	ImportNoRecipeError,
	ImportPageRefusedError,
	ImportPageUnavailableError,
	ImportPausedError,
	ImportRateLimitedError,
	ImportTimedOutError,
	ImportUnavailableError,
} from '@/application/ingestion/errors';
import {
	MemberNotFoundError,
	MemberRoleConflictError,
	OwnerProtectedError,
	SelfRemovalError,
} from '@/application/members/errors';
import {
	InvalidImageUploadError,
	RecipeEditConflictError,
	RecipeNotFoundError,
} from '@/application/recipes/errors';
import { InvalidAccessRequestError } from '@/domain/member/errors';
import { settings } from '@/lib/settings';

describe('toFormError', () => {
	it('maps problems to the fields they name, keeping the first for each', () => {
		const error = new InvalidAccessRequestError([
			{ path: 'name', message: 'Enter some text.' },
			{ path: 'name', message: 'Use 60 characters or fewer.' },
			{ path: 'email', message: 'Enter an email address, like name@example.com.' },
		]);

		expect(toFormError(error)).toEqual({
			status: 'error',
			fieldErrors: {
				name: 'Enter some text.',
				email: 'Enter an email address, like name@example.com.',
			},
		});
	});

	it('says a recipe is gone when a write finds it deleted', () => {
		expect(toFormError(new RecipeNotFoundError())).toEqual({
			status: 'error',
			message:
				'That recipe was deleted, or this page is out of date. Reload the page and try again.',
			fieldErrors: {},
		});
	});

	it('says a recipe changed since the form loaded it, so the save was refused', () => {
		expect(toFormError(new RecipeEditConflictError())).toEqual({
			status: 'error',
			message:
				'This recipe changed after you opened it. Copy anything you want to keep, then reload the page and make your changes again.',
			fieldErrors: {},
		});
	});

	it('says a draft was saved elsewhere since the form loaded it, so the save was refused', () => {
		expect(toFormError(new SavedDraftEditConflictError())).toEqual({
			status: 'error',
			message:
				'This draft was saved somewhere else after you opened it here. Copy anything you want to keep, then reload the page to see that version.',
			fieldErrors: {},
		});
	});

	it('says a draft was added or deleted elsewhere, so it can be neither saved nor added', () => {
		expect(toFormError(new SavedDraftGoneError())).toEqual({
			status: 'error',
			message:
				'This draft was added to the cookbook or deleted somewhere else, so it can’t be saved or added here. Copy anything you want to keep.',
			fieldErrors: {},
		});
	});

	it('says a draft was saved elsewhere since the page showed it, so the delete was refused', () => {
		expect(toFormError(new SavedDraftDeleteConflictError())).toEqual({
			status: 'error',
			message:
				'This draft was saved somewhere else after this page showed it, so it wasn’t deleted. Reload the page to see that version.',
			fieldErrors: {},
		});
	});

	it.each([
		{
			error: new MemberNotFoundError(),
			message: 'That account was removed. Reload the page to see the latest.',
		},
		{
			error: new MemberRoleConflictError(),
			message: 'That member’s role already changed. Reload the page to see the latest.',
		},
		{
			error: new OwnerProtectedError(),
			message: 'The owner’s account always stays an admin and can’t be removed.',
		},
		{
			error: new SelfRemovalError(),
			message: 'You can’t remove yourself. Ask the owner to remove you.',
		},
		{
			error: new InvalidImageUploadError(),
			message: 'This photo didn’t upload. Remove it and add it again.',
		},
		{
			error: new DeviceFavoritesFullError(),
			message: `You’ve reached the limit of ${settings.favorites.maxPerDevice} favorites on this device. Remove one to add another.`,
		},
		{
			error: new ImportUnavailableError(),
			message: 'This import can’t be saved anymore. Import the recipe again.',
		},
		{
			error: new ImportPageRefusedError(403),
			message: 'This website doesn’t support importing recipes.',
		},
		{
			error: new ImportPageUnavailableError('timed-out'),
			message: 'We couldn’t open that page. Check the link and try again.',
		},
		{
			error: new ImportNoRecipeError(),
			message: 'We couldn’t find a recipe to import.',
		},
		{
			error: new ImportRateLimitedError(),
			message: `You’ve reached the limit of ${settings.imports.maxImportsPerDay} imports in 24 hours. Try again later, or enter the recipe manually.`,
		},
		{
			error: new ImportPausedError(),
			message: 'Imports are paused. You can still enter the recipe manually.',
		},
		{
			error: new ImportFailedError(),
			message: 'The import didn’t finish. Try again in a moment.',
		},
		{
			error: new ImportTimedOutError(),
			message: 'The import took too long. Try again in a moment.',
		},
	])('gives $error.code its copy', ({ error, message }) => {
		expect(toFormError(error)).toEqual({ status: 'error', message, fieldErrors: {} });
	});

	it('rethrows an unexpected error unchanged', () => {
		const error = new Error('Something broke');

		expect(() => toFormError(error)).toThrow(error);
	});
});
