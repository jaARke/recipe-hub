import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
	const user = userEvent.setup();
	await user.clear(screen.getByLabelText('Display name'));
	await user.type(screen.getByLabelText('Display name'), name);
	await user.click(screen.getByRole('button', { name: 'Save name' }));
}

function nameField(): HTMLInputElement {
	return screen.getByLabelText<HTMLInputElement>('Display name');
}

describe('DisplayNameForm', () => {
	it('asks for a name at once when it is blank, before any request, with focus on the field', async () => {
		const action = vi.fn<FormAction>();
		render(<DisplayNameForm displayName="Ada" action={action} />);

		await saveName('  ');

		expect(screen.getByText('Enter your display name.')).toBeDefined();
		expect(document.activeElement).toBe(nameField());
		expect(action).not.toHaveBeenCalled();
	});

	it('no longer says “Saved.” once its page has been left and shown again', async () => {
		const page = renderKeptPage(
			<DisplayNameForm displayName="Ada" action={async () => ({ status: 'success' })} />
		);

		await saveName('Ada L.');
		expect(await screen.findByText('Saved.')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText('Saved.')).toBeNull();
	});

	it('keeps the typed name and its error once its page has been left and shown again', async () => {
		const page = renderKeptPage(<DisplayNameForm displayName="Ada" action={tooLong} />);

		await saveName('Ada the Countess of Lovelace');
		expect(await screen.findByText('Use 60 characters or fewer.')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.getByText('Use 60 characters or fewer.')).toBeDefined();
		expect(nameField().value).toBe('Ada the Countess of Lovelace');
	});

	it('drops the form’s message, keeping the typed name, once its page has been left and shown again', async () => {
		const page = renderKeptPage(<DisplayNameForm displayName="Ada" action={lostConnection} />);
		const message = 'We couldn’t save your name. Check your connection and try again.';

		await saveName('Ada L.');
		expect(await screen.findByText(message)).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText(message)).toBeNull();
		expect(nameField().value).toBe('Ada L.');
	});
});
