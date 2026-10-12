import { describe, expect, it } from 'vitest';
import { toFormError } from '@/app/_lib/form-errors';
import { RecipeEditConflictError, RecipeNotFoundError } from '@/application/recipes/errors';
import { InvalidAccessRequestError } from '@/domain/member/errors';

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

	it('rethrows an unexpected error unchanged', () => {
		const error = new Error('Something broke');

		expect(() => toFormError(error)).toThrow(error);
	});

	it('rethrows a database error without its parameters or cause', () => {
		const queryError = new Error(
			'Failed query: insert into "access_requests" values ($1, $2)\nparams: Ada,ada@example.com',
			{ cause: new Error('connection refused') }
		);

		let thrown: unknown;
		try {
			toFormError(new Error('Wrapped', { cause: queryError }));
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toBe(
			'Failed query: insert into "access_requests" values ($1, $2)'
		);
		expect((thrown as Error).cause).toBeUndefined();
		expect(String((thrown as Error).stack)).not.toContain('ada@example.com');
	});
});
