import { authClient } from '@/components/auth/auth-client';
import { codeRequestError, codeSignInError, settleAuthCall } from '@/components/auth/auth-errors';
import { authFieldNames, codeBlankMessages } from '@/components/auth/auth-forms';
import type { FormState } from '@/components/forms/form-state';
import { emailBlankMessages } from '@/domain/member/member';

// Better Auth answers the same whether or not the address has an account, and emails a code only
// when it has one, so the page never says which. A blank address, which a submit made before the
// page hydrated can still send, gets the message the browser's check gives.
export async function requestSignInCode(email: string): Promise<FormState> {
	if (email === '') {
		return {
			status: 'error',
			fieldErrors: { [authFieldNames.email]: emailBlankMessages.email },
		};
	}

	const { error } = await settleAuthCall(
		authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
	);
	return error === null ? { status: 'success' } : codeRequestError(error);
}

// Spaces are dropped, since a code copied from an email can carry them. A blank code is refused as a
// blank address is.
export async function signInWithCode(email: string, code: string): Promise<FormState> {
	const otp = code.replace(/\s/g, '');
	if (otp === '') {
		return {
			status: 'error',
			fieldErrors: { [authFieldNames.code]: codeBlankMessages.code },
		};
	}

	const { error } = await settleAuthCall(authClient.signIn.emailOtp({ email, otp }));
	return error === null ? { status: 'success' } : codeSignInError(error);
}
