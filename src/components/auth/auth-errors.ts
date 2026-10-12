import { authFieldNames } from '@/components/auth/auth-forms';
import type { FormError } from '@/components/forms/form-state';

// The failure the auth client returns: Better Auth's code when it names one, and the HTTP status,
// which is 429 when a rate limit refuses the request.
export type AuthClientError = {
	code?: string;
	status: number;
};

const tooManyTriesMessage = 'Too many tries in a short time. Wait a minute, then try again.';

// Reported when the passkey dialog is closed or times out (the browser doesn't say which), or when a
// newer passkey request replaces it.
const passkeyCancellationCodes: ReadonlySet<string> = new Set([
	'AUTH_CANCELLED',
	'ERROR_CEREMONY_ABORTED',
	'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
]);

// The auth client throws, rather than returning an error, when no response arrives, as with a lost
// connection. Its calls go through this, so every failure arrives the same way: status 0 is what
// fetch reports for a network error.
export async function settleAuthCall<Result extends { error: AuthClientError | null }>(
	call: Promise<Result>
): Promise<Result | { data: null; error: AuthClientError }> {
	try {
		return await call;
	} catch {
		return { data: null, error: { status: 0 } };
	}
}

function formError(message: string): FormError {
	return { status: 'error', message, fieldErrors: {} };
}

function fieldError(name: string, message: string): FormError {
	return { status: 'error', fieldErrors: { [name]: message } };
}

export function codeRequestError(error: AuthClientError): FormError {
	if (error.status === 429) {
		return formError(tooManyTriesMessage);
	}
	if (error.code === 'INVALID_EMAIL') {
		return fieldError(authFieldNames.email, 'Enter an email address, like name@example.com.');
	}
	return formError("We couldn't send a code. Try again in a moment.");
}

// A first sign-in creates an invitee's account, which the server refuses with a bare 403 once the
// invite is no longer open.
export function codeSignInError(error: AuthClientError): FormError {
	if (error.status === 429) {
		return formError(tooManyTriesMessage);
	}
	switch (error.code) {
		case 'INVALID_OTP':
			return fieldError(
				authFieldNames.code,
				"That code didn't work. Check the email and try again, or send a new code."
			);
		case 'OTP_EXPIRED':
			return fieldError(authFieldNames.code, 'That code has expired. Send a new code.');
		case 'TOO_MANY_ATTEMPTS':
			return fieldError(
				authFieldNames.code,
				'That code was entered wrong too many times. Send a new code.'
			);
	}
	if (error.status === 403) {
		return formError(
			"Your invite can't be used anymore. Ask the person who invited you for a new one."
		);
	}
	return formError("We couldn't sign you in. Try again.");
}

export function isPasskeyCancellation(error: AuthClientError): boolean {
	return error.code !== undefined && passkeyCancellationCodes.has(error.code);
}

export function passkeySignInErrorMessage(error: AuthClientError): string {
	if (isPasskeyCancellation(error)) {
		return 'No passkey was used. Try again, or sign in with an email code.';
	}
	if (error.status === 429) {
		return tooManyTriesMessage;
	}
	if (error.code === 'PASSKEY_NOT_FOUND') {
		return "That passkey isn't set up for an account here. Sign in with an email code, then add a new passkey on your account page.";
	}
	return "We couldn't sign you in with that passkey. Try again, or sign in with an email code.";
}

// Adding a passkey needs a sign-in from the last day, so an older session must sign in again first.
export function isStaleSessionError(error: AuthClientError): boolean {
	return error.code === 'SESSION_NOT_FRESH';
}

export function passkeyRegistrationErrorMessage(error: AuthClientError): string {
	if (isPasskeyCancellation(error)) {
		return 'No passkey was added.';
	}
	if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
		return 'This device already has a passkey for your account.';
	}
	if (error.status === 429) {
		return tooManyTriesMessage;
	}
	if (error.status === 401) {
		return 'Your session has ended. Sign in again to add a passkey.';
	}
	return "We couldn't add a passkey. Try again.";
}

export function passkeyRemovalErrorMessage(error: AuthClientError): string {
	if (error.code === 'PASSKEY_NOT_FOUND') {
		return 'That passkey was already removed.';
	}
	if (error.status === 429) {
		return tooManyTriesMessage;
	}
	if (error.status === 401) {
		return 'Your session has ended. Sign in again to remove a passkey.';
	}
	return "We couldn't remove that passkey. Try again.";
}
