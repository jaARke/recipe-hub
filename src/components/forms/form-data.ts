// Reads a text field, trimmed. A missing field reads as empty, so the service reports it as blank.
export function formText(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

// Reads an optional text field. Forms submit a blank field as empty text, which the domain expects
// to be omitted.
export function optionalFormText(formData: FormData, name: string): string | undefined {
	const value = formText(formData, name);
	return value === '' ? undefined : value;
}
