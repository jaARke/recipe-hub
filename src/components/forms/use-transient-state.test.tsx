import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useTransientState } from '@/components/forms/use-transient-state';

// Confirms once the passkey it asks for is added.
function ProbePasskeyButton({ added }: { added: Promise<void> }) {
	const [confirmation, setConfirmation] = useTransientState<string>();

	return (
		<>
			<button
				type="button"
				onClick={() => void added.then(() => setConfirmation('Passkey added.'))}
			>
				Add a passkey
			</button>
			{confirmation !== undefined && <p>{confirmation}</p>}
		</>
	);
}

describe('useTransientState', () => {
	it('drops its value before its page shows again', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbePasskeyButton added={Promise.resolve()} />);

		await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
		expect(await screen.findByText('Passkey added.')).toBeDefined();
		await page.hide();

		expect(document.body.textContent).not.toContain('Passkey added.');
		await page.show();
		expect(screen.queryByText('Passkey added.')).toBeNull();
	});

	it('keeps a value set while its page is hidden', async () => {
		const user = userEvent.setup();
		const { promise, resolve } = Promise.withResolvers<void>();
		const page = renderKeptPage(<ProbePasskeyButton added={promise} />);

		await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
		await page.hide();
		await act(async () => resolve());
		await page.show();

		expect(screen.getByText('Passkey added.')).toBeDefined();
	});
});
