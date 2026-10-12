// What a form's Server Action returns. Expected failures are values, so the form shows them in place.

// Keyed by the field's name, which is the path of its problem.
export type FieldErrors = Partial<Record<string, string>>;

// The text a form submitted, keyed by field name.
export type FieldValues = Partial<Record<string, string>>;

export type FormError = {
	status: 'error';
	// About the whole form, such as an expired link; absent when only fields have problems.
	message?: string;
	fieldErrors: FieldErrors;
	// What was submitted, added by useFormAction: React resets a form after its action, so fields
	// take these as default values to keep what was typed. Actions leave it out.
	values?: FieldValues;
};

export type FormState<Success extends object = object> =
	{ status: 'idle' } | ({ status: 'success' } & Success) | FormError;

// A form's action as useFormAction calls it: a Server Action, or a client function that calls one
// or the auth client.
export type FormAction<Success extends object = object> = (
	state: FormState<Success>,
	formData: FormData
) => Promise<FormState<Success>>;
