import { authClient } from '@/components/auth/auth-client';
import { codeRequestError, codeSignInError, settleAuthCall } from '@/components/auth/auth-errors';
import { authFieldNames } from '@/components/auth/auth-forms';
import type { FormState } from '@/components/forms/form-state';

// Better Auth answers the same whether or not the address has an account, and emails a code only
// when it has one, so the page never says which.
export async function requestSignInCode(email: string): Promise<FormState> {
	if (email === '') {
		return {
			status: 'error',
			fieldErrors: { [authFieldNames.email]: 'Enter your email address.' },
		};
	}

	const { error } = await settleAuthCall(
		authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
	);
	return error === null ? { status: 'success' } : codeRequestError(error);
}

// Spaces are dropped, since a code copied from an email can carry them.
export async function signInWithCode(email: string, code: string): Promise<FormState> {
	const otp = code.replace(/\s/g, '');
	if (otp === '') {
		return {
			status: 'error',
			fieldErrors: { [authFieldNames.code]: 'Enter the code from the email.' },
		};
	}

	const { error } = await settleAuthCall(authClient.signIn.emailOtp({ email, otp }));
	return error === null ? { status: 'success' } : codeSignInError(error);
}
