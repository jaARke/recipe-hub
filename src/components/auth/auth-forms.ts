import { blankTextMessage } from '@/domain/text';

// The fields the email code forms submit, on the sign-in and invite pages alike. The email field is
// named for the service input it fills, so a validation problem's path names it.
export const authFieldNames = {
	email: 'email',
	code: 'code',
} as const;

// What a blank code says, keyed by the field. The browser checks for one before sending.
export const codeBlankMessages = { code: blankTextMessage('the code from the email') };
