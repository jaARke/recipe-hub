import { describe, expect, it } from 'vitest';
import {
	codeRequestError,
	codeSignInError,
	isPasskeyCancellation,
	isStaleSessionError,
	isUnknownPasskeyError,
	passkeyRegistrationErrorMessage,
	passkeyRemovalErrorMessage,
	passkeyRenameError,
	passkeySignInErrorMessage,
	settleAuthCall,
} from '@/components/auth/auth-errors';

const rateLimited = { status: 429 };

describe('settleAuthCall', () => {
	it('passes a returned result through', async () => {
		const result = { data: { status: true }, error: null };

		await expect(settleAuthCall(Promise.resolve(result))).resolves.toBe(result);
	});

	it('turns a call that never got a response into an error with status 0', async () => {
		await expect(settleAuthCall(Promise.reject(new TypeError('Failed to fetch')))).resolves.toEqual(
			{
				data: null,
				error: { status: 0 },
			}
		);
	});
});

describe('codeRequestError', () => {
	it('puts an invalid address on the email field', () => {
		expect(codeRequestError({ code: 'INVALID_EMAIL', status: 400 })).toEqual({
			status: 'error',
			fieldErrors: { email: 'Enter an email address, like name@example.com.' },
		});
	});

	it('asks a rate-limited visitor to wait', () => {
		expect(codeRequestError(rateLimited)).toMatchObject({
			message: 'Too many tries in a short time. Wait a minute, then try again.',
			fieldErrors: {},
		});
	});

	it('falls back to a general message', () => {
		expect(codeRequestError({ status: 500 })).toMatchObject({
			message: 'We couldn’t send a code. Try again in a moment.',
		});
	});
});

describe('codeSignInError', () => {
	it.each([
		[
			'INVALID_OTP',
			400,
			'That code didn’t work. Check the email and try again, or send a new code.',
		],
		['OTP_EXPIRED', 400, 'That code has expired. Send a new code.'],
		['TOO_MANY_ATTEMPTS', 403, 'That code was entered wrong too many times. Send a new code.'],
	])('puts %s on the code field', (code, status, message) => {
		expect(codeSignInError({ code, status })).toEqual({
			status: 'error',
			fieldErrors: { code: message },
		});
	});

	it('tells an invitee whose invite closed to ask for a new one', () => {
		expect(codeSignInError({ status: 403 })).toMatchObject({
			message: 'Your invite can’t be used anymore. Ask the person who invited you for a new one.',
		});
	});

	it('asks a rate-limited visitor to wait, and falls back to a general message', () => {
		expect(codeSignInError(rateLimited).message).toMatch(/^Too many tries/);
		expect(codeSignInError({ status: 500 }).message).toBe('We couldn’t sign you in. Try again.');
	});
});

describe('isPasskeyCancellation', () => {
	it.each(['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'])(
		'recognizes %s',
		(code) => {
			expect(isPasskeyCancellation({ code, status: 400 })).toBe(true);
		}
	);

	it('refuses a server failure or a missing code', () => {
		expect(isPasskeyCancellation({ code: 'PASSKEY_NOT_FOUND', status: 401 })).toBe(false);
		expect(isPasskeyCancellation({ status: 500 })).toBe(false);
	});
});

describe('isUnknownPasskeyError', () => {
	it('recognizes only a passkey the site does not know', () => {
		expect(isUnknownPasskeyError({ code: 'PASSKEY_NOT_FOUND', status: 401 })).toBe(true);
		expect(isUnknownPasskeyError({ code: 'AUTHENTICATION_FAILED', status: 401 })).toBe(false);
		expect(isUnknownPasskeyError({ status: 0 })).toBe(false);
	});
});

describe('passkeySignInErrorMessage', () => {
	it('offers the email code after a cancelled dialog', () => {
		expect(passkeySignInErrorMessage({ code: 'AUTH_CANCELLED', status: 400 })).toBe(
			'No passkey was used. Try again, or sign in with an email code.'
		);
	});

	it('explains a passkey the site no longer knows', () => {
		expect(passkeySignInErrorMessage({ code: 'PASSKEY_NOT_FOUND', status: 401 })).toMatch(
			/^That passkey isn’t set up for an account here\./
		);
	});

	it('asks a rate-limited visitor to wait, and falls back to a general message', () => {
		expect(passkeySignInErrorMessage(rateLimited)).toMatch(/^Too many tries/);
		expect(passkeySignInErrorMessage({ code: 'AUTHENTICATION_FAILED', status: 401 })).toBe(
			'We couldn’t sign you in with that passkey. Try again, or sign in with an email code.'
		);
	});
});

describe('isStaleSessionError', () => {
	it('recognizes only the fresh-session refusal', () => {
		expect(isStaleSessionError({ code: 'SESSION_NOT_FRESH', status: 403 })).toBe(true);
		expect(isStaleSessionError({ code: 'UNAUTHORIZED', status: 401 })).toBe(false);
	});
});

describe('passkeyRegistrationErrorMessage', () => {
	it.each([
		[{ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', status: 400 }, 'No passkey was added.'],
		[
			{ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', status: 400 },
			'This device already has a passkey for your account.',
		],
		[
			{ code: 'UNAUTHORIZED', status: 401 },
			'Your session has ended. Sign in again to add a passkey.',
		],
		[{ code: 'UNKNOWN_ERROR', status: 500 }, 'We couldn’t add a passkey. Try again.'],
	])('maps %j', (error, message) => {
		expect(passkeyRegistrationErrorMessage(error)).toBe(message);
	});
});

describe('passkeyRemovalErrorMessage', () => {
	it.each([
		[{ code: 'PASSKEY_NOT_FOUND', status: 404 }, 'That passkey was already removed.'],
		[{ status: 401 }, 'Your session has ended. Sign in again to remove a passkey.'],
		[{ status: 500 }, 'We couldn’t remove that passkey. Try again.'],
	])('maps %j', (error, message) => {
		expect(passkeyRemovalErrorMessage(error)).toBe(message);
	});
});

describe('passkeyRenameError', () => {
	it("puts the server's reason for refusing the name on the name field", () => {
		expect(
			passkeyRenameError({
				code: 'VALIDATION_ERROR',
				message: 'Use 60 characters or fewer.',
				status: 400,
			})
		).toEqual({ status: 'error', fieldErrors: { name: 'Use 60 characters or fewer.' } });
	});

	it.each([
		[
			{ code: 'PASSKEY_NOT_FOUND', status: 404 },
			'That passkey was removed. Reload the page to see your passkeys.',
		],
		[rateLimited, 'Too many tries in a short time. Wait a minute, then try again.'],
		[{ status: 401 }, 'Your session has ended. Sign in again to rename a passkey.'],
		[{ code: 'VALIDATION_ERROR', status: 400 }, 'We couldn’t rename that passkey. Try again.'],
		[{ status: 500 }, 'We couldn’t rename that passkey. Try again.'],
	])('maps %j to a message about the form', (error, message) => {
		expect(passkeyRenameError(error)).toEqual({ status: 'error', message, fieldErrors: {} });
	});
});
