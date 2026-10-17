import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { FormStatusMessage } from '@/components/forms/form-status-message';

describe('FormStatusMessage', () => {
	it('marks a confirmation with a check', async () => {
		await render(<FormStatusMessage kind="confirmation" message="Saved." />);

		await expect.element(page.getByRole('status')).toHaveTextContent('Saved.');
		expect(page.getByRole('status').element().querySelector('svg')).not.toBeNull();
	});

	it('shows progress without a check', async () => {
		await render(<FormStatusMessage kind="progress" message="Reading the page…" />);

		await expect.element(page.getByRole('status')).toHaveTextContent('Reading the page…');
		expect(page.getByRole('status').element().querySelector('svg')).toBeNull();
	});

	it('keeps an empty live region, with no check, until there is a message', async () => {
		await render(<FormStatusMessage kind="confirmation" message={undefined} />);

		await expect.element(page.getByRole('status')).toBeEmptyDOMElement();
	});
});
