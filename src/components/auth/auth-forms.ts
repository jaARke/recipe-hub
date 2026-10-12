// The fields the email code forms submit, on the sign-in and invite pages alike. The email field is
// named for the service input it fills, so a validation problem's path names it.
export const authFieldNames = {
	email: 'email',
	code: 'code',
} as const;
