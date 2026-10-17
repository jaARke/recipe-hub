import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { PasskeyList } from '@/components/account/passkey-list';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { toast } from '@/components/ui/toast';

const passkeys = [{ id: 'passkey-1', name: 'Work laptop', createdAt: null }];

const succeed: FormAction = async () => ({ status: 'success' });

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PasskeyList', () => {
	it('confirms a rename in a toast, as a removal is, once its dialog closes', async () => {
		const add = vi.spyOn(toast, 'add');
		await render(
			<PasskeyList passkeys={passkeys} renamePasskey={succeed} removePasskey={succeed} />
		);

		await page.getByRole('button', { name: 'Rename Work laptop' }).click();
		await page.getByRole('button', { name: 'Save name' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(add).toHaveBeenCalledWith({ type: 'success', title: 'Passkey renamed' });
	});

	it('asks for a name at once when the new one is blank, and never sends it', async () => {
		const rename = vi.fn(succeed);
		await render(
			<PasskeyList passkeys={passkeys} renamePasskey={rename} removePasskey={succeed} />
		);

		await page.getByRole('button', { name: 'Rename Work laptop' }).click();
		await page.getByLabelText('Name').clear();
		await page.getByRole('button', { name: 'Save name' }).click();

		await expect.element(page.getByText('Enter a name for the passkey.')).toBeVisible();
		await expect.element(page.getByLabelText('Name')).toHaveFocus();
		expect(rename).not.toHaveBeenCalled();
	});

	it('keeps the dialog open, with no toast, when the rename is refused', async () => {
		const add = vi.spyOn(toast, 'add');
		const refuse: FormAction = async () => ({
			status: 'error',
			message: 'Use 60 characters or fewer.',
			fieldErrors: {},
		});
		await render(
			<PasskeyList passkeys={passkeys} renamePasskey={refuse} removePasskey={succeed} />
		);

		await page.getByRole('button', { name: 'Rename Work laptop' }).click();
		await page.getByRole('button', { name: 'Save name' }).click();

		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		expect(add).not.toHaveBeenCalled();
	});

	it('opens the rename dialog again without the refusal it closed on', async () => {
		const refuse: FormAction = async () => ({
			status: 'error',
			message: 'Use 60 characters or fewer.',
			fieldErrors: {},
		});
		await render(
			<PasskeyList passkeys={passkeys} renamePasskey={refuse} removePasskey={succeed} />
		);

		await page.getByRole('button', { name: 'Rename Work laptop' }).click();
		await page.getByRole('button', { name: 'Save name' }).click();
		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Rename Work laptop' }).click();

		await expect.element(page.getByRole('dialog')).toBeVisible();
		expect(page.getByText('Use 60 characters or fewer.').query()).toBeNull();
	});

	it('keeps the rename dialog open while the name saves, so it cannot be sent twice', async () => {
		const { promise, resolve } = Promise.withResolvers<FormState>();
		const rename = vi.fn<FormAction>(() => promise);
		await render(
			<PasskeyList passkeys={passkeys} renamePasskey={rename} removePasskey={succeed} />
		);
		// Read before it opens: the open dialog takes the page from the accessibility tree.
		const trigger = page.getByRole('button', { name: 'Rename Work laptop' }).element();

		await page.elementLocator(trigger).click();
		await page.getByRole('button', { name: 'Save name' }).click();
		await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
		await userEvent.keyboard('{Escape}');
		await page.getByRole('button', { name: 'Close' }).click();
		await page.getByLabelText('Name').click();
		await userEvent.keyboard('{Enter}');

		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		// A second send would wait for the first, so the count is read once it ends.
		resolve({ status: 'success' });
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(rename).toHaveBeenCalledOnce();
	});

	it('closes the removal dialog once the passkey is removed', async () => {
		const add = vi.spyOn(toast, 'add');
		await render(
			<PasskeyList passkeys={passkeys} renamePasskey={succeed} removePasskey={succeed} />
		);

		await page.getByRole('button', { name: 'Remove Work laptop' }).click();
		await page.getByRole('button', { name: 'Remove passkey' }).click();

		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(add).toHaveBeenCalledWith({ type: 'success', title: 'Passkey removed' });
	});
});
