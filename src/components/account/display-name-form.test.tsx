import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { DisplayNameForm } from '@/components/account/display-name-form';
import type { FormAction } from '@/components/forms/form-state';
import { renderKeptPage } from '@/components/forms/testing/kept-page';

const tooLong: FormAction = async () => ({
	status: 'error',
	fieldErrors: { displayName: 'Use 60 characters or fewer.' },
});

const lostConnection: FormAction = () => Promise.reject(new TypeError('Failed to fetch'));

// Replaces the saved name with what the member types, then saves it.
async function saveName(name: string) {
	await nameField().fill(name);
	await page.getByRole('button', { name: 'Save name' }).click();
}

function nameField() {
	return page.getByLabelText('Display name');
}

describe('DisplayNameForm', () => {
	it('asks for a name at once when it is blank, before any request, with focus on the field', async () => {
		const action = vi.fn<FormAction>();
		await render(<DisplayNameForm displayName="Ada" action={action} />);

		await saveName('  ');

		await expect.element(page.getByText('Enter your display name.')).toBeVisible();
		await expect.element(nameField()).toHaveFocus();
		expect(action).not.toHaveBeenCalled();
	});

	it('no longer says “Saved.” once its page has been left and shown again', async () => {
		const keptPage = await renderKeptPage(
			<DisplayNameForm displayName="Ada" action={async () => ({ status: 'success' })} />
		);

		await saveName('Ada L.');
		await expect.element(page.getByText('Saved.')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		expect(page.getByText('Saved.').query()).toBeNull();
	});

	it('keeps the typed name and its error once its page has been left and shown again', async () => {
		const keptPage = await renderKeptPage(<DisplayNameForm displayName="Ada" action={tooLong} />);

		await saveName('Ada the Countess of Lovelace');
		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await expect.element(nameField()).toHaveValue('Ada the Countess of Lovelace');
	});

	it('drops the form’s message, keeping the typed name, once its page has been left and shown again', async () => {
		const keptPage = await renderKeptPage(
			<DisplayNameForm displayName="Ada" action={lostConnection} />
		);
		const message = 'We couldn’t save your name. Check your connection and try again.';

		await saveName('Ada L.');
		await expect.element(page.getByText(message)).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		expect(page.getByText(message).query()).toBeNull();
		await expect.element(nameField()).toHaveValue('Ada L.');
	});
});
