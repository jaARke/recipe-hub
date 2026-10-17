import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { FormAction } from '@/components/forms/form-state';
import { UrlImportForm } from '@/components/recipe-import/url-import-form';

const fieldDescription =
	'Paste the address of the page with the recipe. You’ll check what’s read before saving it.';

function linkField() {
	return page.getByRole('textbox', { name: 'Recipe link' });
}

describe('UrlImportForm', () => {
	it('asks for a link at once when none is given, before any request, with focus on the field', async () => {
		const action = vi.fn<FormAction>();
		await render(<UrlImportForm action={action} />);

		await page.getByRole('button', { name: 'Import recipe' }).click();

		await expect.element(linkField()).toHaveFocus();
		await expect.element(linkField()).toHaveAttribute('aria-invalid', 'true');
		await expect
			.element(linkField())
			.toHaveAccessibleDescription(`${fieldDescription} Enter a link to the recipe.`);
		expect(action).not.toHaveBeenCalled();
	});

	it('sends a link to the server, which checks how it’s written', async () => {
		const action = vi.fn<FormAction>(async () => ({
			status: 'error',
			fieldErrors: { url: 'Enter a web address that starts with http:// or https://.' },
		}));
		await render(<UrlImportForm action={action} />);

		await linkField().fill('recipes.example.com/lemonade');
		await page.getByRole('button', { name: 'Import recipe' }).click();

		await expect
			.element(linkField())
			.toHaveAccessibleDescription(
				`${fieldDescription} Enter a web address that starts with http:// or https://.`
			);
		await expect.element(linkField()).toHaveFocus();
		await expect.element(linkField()).toHaveValue('recipes.example.com/lemonade');
		expect(action).toHaveBeenCalledOnce();
	});
});
