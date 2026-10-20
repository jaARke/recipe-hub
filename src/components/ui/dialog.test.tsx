import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { displayAsPageShows, expectPopupUnmounted } from '@/components/ui/testing/kept-page-popup';

function renamePasskey(onOpenChange?: (open: boolean) => void) {
	return (
		<Dialog onOpenChange={onOpenChange}>
			<DialogTrigger>Rename</DialogTrigger>
			<DialogContent>
				<DialogTitle>Rename passkey</DialogTitle>
			</DialogContent>
		</Dialog>
	);
}

function popupParts(): Element[] {
	return Array.from(
		document.querySelectorAll('[data-slot="dialog-overlay"], [data-slot="dialog-content"]')
	);
}

describe('Dialog', () => {
	it('closes as its page hides, kept from drawing as the page shows, where it unmounts at once', async () => {
		const keptPage = await renderKeptPage(renamePasskey());
		await page.getByRole('button', { name: 'Rename' }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none', 'none']);
		await expectPopupUnmounted(popupParts);
	});

	it('gives focus back to what it opened from before its page hides', async () => {
		// Notes where focus is as React hides the page, after the dialog's cleanups and before Base UI's
		// own return of focus, which waits for a microtask.
		const focusedAsHidden = vi.fn<(element: Element | null) => void>();
		function FocusAsPageHides() {
			useOnKeptPageHide(() => focusedAsHidden(document.activeElement));
			return null;
		}
		const keptPage = await renderKeptPage(
			<>
				{renamePasskey()}
				<FocusAsPageHides />
			</>
		);
		// Read while shown: the hidden page's trigger leaves the accessibility tree locators search.
		const trigger = page.getByRole('button', { name: 'Rename' }).element();

		await page.getByRole('button', { name: 'Rename' }).click();
		await expect
			.poll(() => page.getByRole('dialog').query()?.contains(document.activeElement))
			.toBe(true);
		await keptPage.hide();

		expect(focusedAsHidden).toHaveBeenCalledExactlyOnceWith(trigger);
	});

	it('opens as usual after its page hid it', async () => {
		const keptPage = await renderKeptPage(renamePasskey());
		await page.getByRole('button', { name: 'Rename' }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await page.getByRole('button', { name: 'Rename' }).click();

		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByRole('dialog')).not.toHaveAttribute('data-closed-by-page-hide');
	});

	it('tells its onOpenChange nothing when its page hides it closed', async () => {
		const onOpenChange = vi.fn();
		const keptPage = await renderKeptPage(renamePasskey(onOpenChange));

		await keptPage.hide();
		await keptPage.show();

		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

describe('DialogContent', () => {
	it('makes its close button 44 px under a finger', async () => {
		await render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Rename passkey</DialogTitle>
				</DialogContent>
			</Dialog>
		);

		await expect
			.element(page.getByRole('button', { name: 'Close' }))
			.toHaveClass('pointer-coarse:size-11');
	});
});
