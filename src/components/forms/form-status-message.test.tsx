import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormStatusMessage } from '@/components/forms/form-status-message';

describe('FormStatusMessage', () => {
	it('marks a confirmation with a check', () => {
		render(<FormStatusMessage kind="confirmation" message="Saved." />);

		const status = screen.getByRole('status');
		expect(status.textContent).toBe('Saved.');
		expect(status.querySelector('svg')).not.toBeNull();
	});

	it('shows progress without a check', () => {
		render(<FormStatusMessage kind="progress" message="Reading the page…" />);

		const status = screen.getByRole('status');
		expect(status.textContent).toBe('Reading the page…');
		expect(status.querySelector('svg')).toBeNull();
	});

	it('keeps an empty live region, with no check, until there is a message', () => {
		render(<FormStatusMessage kind="confirmation" message={undefined} />);

		const status = screen.getByRole('status');
		expect(status.textContent).toBe('');
		expect(status.querySelector('svg')).toBeNull();
	});
});
