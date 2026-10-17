import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { FormActions } from '@/components/forms/form-actions';
import { FormStatusMessage } from '@/components/forms/form-status-message';

describe('FormActions', () => {
	it('reads its buttons in order, then their status', async () => {
		await render(
			<FormActions status={<FormStatusMessage kind="confirmation" message="Saved." />}>
				<button type="submit">Save</button>
				<button type="button">Cancel</button>
			</FormActions>
		);

		const row = page.getByRole('status').element().parentElement;
		expect(Array.from(row?.children ?? [], (child) => child.textContent)).toEqual([
			'Save',
			'Cancel',
			'Saved.',
		]);
	});
});
