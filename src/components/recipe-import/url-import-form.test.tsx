import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/components/forms/form-state';
import { UrlImportForm } from '@/components/recipe-import/url-import-form';

describe('UrlImportForm', () => {
	it('asks for a link at once when none is given, before any request, with focus on the field', async () => {
		const action = vi.fn<FormAction>();
		const user = userEvent.setup();
		render(<UrlImportForm action={action} />);

		await user.click(screen.getByRole('button', { name: 'Import recipe' }));

		const field = screen.getByLabelText('Recipe link');
		expect(screen.getByText('Enter a link to the recipe.')).toBeDefined();
		expect(field.getAttribute('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(field);
		expect(action).not.toHaveBeenCalled();
	});

	it('sends a link to the server, which checks how it’s written', async () => {
		const action = vi.fn<FormAction>(async () => ({
			status: 'error',
			fieldErrors: { url: 'Enter a web address that starts with http:// or https://.' },
		}));
		const user = userEvent.setup();
		render(<UrlImportForm action={action} />);

		await user.type(screen.getByLabelText('Recipe link'), 'recipes.example.com/lemonade');
		await user.click(screen.getByRole('button', { name: 'Import recipe' }));

		expect(
			await screen.findByText('Enter a web address that starts with http:// or https://.')
		).toBeDefined();
		expect(action).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(screen.getByLabelText('Recipe link'));
	});
});
