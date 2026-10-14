import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasskeyList } from '@/components/account/passkey-list';
import type { FormAction } from '@/components/forms/form-state';
import { toast } from '@/components/ui/toast';

const passkeys = [{ id: 'passkey-1', name: 'Work laptop', createdAt: null }];

const succeed: FormAction = async () => ({ status: 'success' });

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PasskeyList', () => {
	it('confirms a rename in a toast, as a removal is, once its dialog closes', async () => {
		const add = vi.spyOn(toast, 'add');
		const user = userEvent.setup();
		render(<PasskeyList passkeys={passkeys} renamePasskey={succeed} removePasskey={succeed} />);

		await user.click(screen.getByRole('button', { name: 'Rename Work laptop' }));
		await user.click(await screen.findByRole('button', { name: 'Save name' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(add).toHaveBeenCalledWith({ type: 'success', title: 'Passkey renamed' });
	});

	it('keeps the dialog open, with no toast, when the rename is refused', async () => {
		const add = vi.spyOn(toast, 'add');
		const refuse: FormAction = async () => ({
			status: 'error',
			message: 'Use 60 characters or fewer.',
			fieldErrors: {},
		});
		const user = userEvent.setup();
		render(<PasskeyList passkeys={passkeys} renamePasskey={refuse} removePasskey={succeed} />);

		await user.click(screen.getByRole('button', { name: 'Rename Work laptop' }));
		await user.click(await screen.findByRole('button', { name: 'Save name' }));

		expect(await screen.findByText('Use 60 characters or fewer.')).toBeDefined();
		expect(screen.getByRole('dialog')).toBeDefined();
		expect(add).not.toHaveBeenCalled();
	});

	it('opens the rename dialog again without the refusal it closed on', async () => {
		const refuse: FormAction = async () => ({
			status: 'error',
			message: 'Use 60 characters or fewer.',
			fieldErrors: {},
		});
		const user = userEvent.setup();
		render(<PasskeyList passkeys={passkeys} renamePasskey={refuse} removePasskey={succeed} />);

		await user.click(screen.getByRole('button', { name: 'Rename Work laptop' }));
		await user.click(await screen.findByRole('button', { name: 'Save name' }));
		expect(await screen.findByText('Use 60 characters or fewer.')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		await user.click(screen.getByRole('button', { name: 'Rename Work laptop' }));

		expect(await screen.findByRole('dialog')).toBeDefined();
		expect(screen.queryByText('Use 60 characters or fewer.')).toBeNull();
	});

	it('closes the removal dialog once the passkey is removed', async () => {
		const add = vi.spyOn(toast, 'add');
		const user = userEvent.setup();
		render(<PasskeyList passkeys={passkeys} renamePasskey={succeed} removePasskey={succeed} />);

		await user.click(screen.getByRole('button', { name: 'Remove Work laptop' }));
		await user.click(await screen.findByRole('button', { name: 'Remove passkey' }));

		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		expect(add).toHaveBeenCalledWith({ type: 'success', title: 'Passkey removed' });
	});
});
