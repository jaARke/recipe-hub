import { describe, expect, it } from 'vitest';
import { formText, optionalFormText } from '@/components/forms/form-data';

function formDataOf(entries: Record<string, string | Blob>): FormData {
	const formData = new FormData();
	for (const [name, value] of Object.entries(entries)) {
		formData.append(name, value);
	}
	return formData;
}

describe('formText', () => {
	it('reads a field trimmed', () => {
		expect(formText(formDataOf({ name: '  Ada Lovelace  ' }), 'name')).toBe('Ada Lovelace');
	});

	it('reads a missing field or a file as empty', () => {
		const formData = formDataOf({ photo: new Blob(['x']) });

		expect(formText(formData, 'name')).toBe('');
		expect(formText(formData, 'photo')).toBe('');
	});
});

describe('optionalFormText', () => {
	it('omits a blank, whitespace-only, or missing field', () => {
		const formData = formDataOf({ email: '', relationship: '   ' });

		expect(optionalFormText(formData, 'email')).toBeUndefined();
		expect(optionalFormText(formData, 'relationship')).toBeUndefined();
		expect(optionalFormText(formData, 'name')).toBeUndefined();
	});

	it('reads a filled field trimmed', () => {
		expect(optionalFormText(formDataOf({ email: ' ada@example.com ' }), 'email')).toBe(
			'ada@example.com'
		);
	});
});
