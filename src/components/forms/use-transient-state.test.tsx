import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
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
		const keptPage = await renderKeptPage(<ProbePasskeyButton added={Promise.resolve()} />);

		await page.getByRole('button', { name: 'Add a passkey' }).click();
		await expect.element(page.getByText('Passkey added.')).toBeVisible();
		await keptPage.hide();

		expect(document.body.textContent).not.toContain('Passkey added.');
		await keptPage.show();
		await expect.element(page.getByText('Passkey added.')).not.toBeInTheDocument();
	});

	it('keeps a value set while its page is hidden', async () => {
		const { promise, resolve } = Promise.withResolvers<void>();
		const keptPage = await renderKeptPage(<ProbePasskeyButton added={promise} />);

		await page.getByRole('button', { name: 'Add a passkey' }).click();
		await keptPage.hide();
		resolve();
		await expect.poll(() => document.body.textContent).toContain('Passkey added.');
		await keptPage.show();

		await expect.element(page.getByText('Passkey added.')).toBeVisible();
	});
});
