import { describe, expect, it } from 'vitest';
import { toFormError } from '@/app/_lib/form-errors';
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

	it.each([
		{
			error: new MemberNotFoundError(),
			message: 'That account was removed. Reload the page to see the latest.',
		},
		{
			error: new MemberRoleConflictError(),
			message: "That member's role already changed. Reload the page to see the latest.",
		},
		{
			error: new OwnerProtectedError(),
			message: "The owner's account always stays an admin and can't be removed.",
		},
		{
			error: new SelfRemovalError(),
			message: "You can't remove yourself. Ask another admin to remove you.",
		},
		{
			error: new InvalidImageUploadError(),
			message: "This photo didn't upload. Remove it and add it again.",
		},
		{
			error: new ImportUnavailableError(),
			message: "This import can't be saved anymore. Import the recipe again.",
		},
		{
			error: new ImportPageRefusedError(403),
			message: "This website doesn't support importing recipes.",
		},
		{
			error: new ImportPageUnavailableError('timed-out'),
			message: "We couldn't open that page. Check the link and try again.",
		},
		{
			error: new ImportNoRecipeError(),
			message: "We couldn't find a recipe to import.",
		},
		{
			error: new ImportRateLimitedError(),
			message: `You've reached the limit of ${settings.imports.maxImportsPerDay} imports in 24 hours. Try again later, or enter the recipe manually.`,
		},
		{
			error: new ImportPausedError(),
			message: 'Imports are paused. You can still enter the recipe manually.',
		},
		{
			error: new ImportFailedError(),
			message: "The import didn't finish. Try again in a moment.",
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
