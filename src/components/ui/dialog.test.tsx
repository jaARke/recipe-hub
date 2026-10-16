import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
		const user = userEvent.setup();
		const page = renderKeptPage(renamePasskey());

		await user.click(screen.getByRole('button', { name: 'Rename' }));
		expect(await screen.findByRole('dialog')).toBeDefined();
		await page.hide();

		expect(popupParts()).toHaveLength(2);
		for (const part of popupParts()) {
			expect(part.hasAttribute('data-closed')).toBe(true);
			expect(part.hasAttribute('data-closed-by-page-hide')).toBe(true);
		}
		await page.show();
		expect(popupParts()).toEqual([]);
	});

	it('gives focus back to what it opened from before its page hides', async () => {
		// Notes where focus is as React hides the page, after the dialog's cleanups and before Base UI's
		// own return of focus, which waits for a microtask.
		const focusedAsHidden = vi.fn<(element: Element | null) => void>();
		function FocusAsPageHides() {
			useOnKeptPageHide(() => focusedAsHidden(document.activeElement));
			return null;
		}
		const user = userEvent.setup();
		const page = renderKeptPage(
			<>
				{renamePasskey()}
				<FocusAsPageHides />
			</>
		);
		const trigger = screen.getByRole('button', { name: 'Rename' });

		await user.click(trigger);
		const dialog = await screen.findByRole('dialog');
		await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
		await page.hide();

		expect(focusedAsHidden).toHaveBeenCalledExactlyOnceWith(trigger);
	});

	it('opens as usual after its page hid it', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(renamePasskey());

		await user.click(screen.getByRole('button', { name: 'Rename' }));
		await screen.findByRole('dialog');
		await page.hide();
		await page.show();
		await user.click(screen.getByRole('button', { name: 'Rename' }));

		expect(await screen.findByRole('dialog')).toBeDefined();
		expect(popupParts().some((part) => part.hasAttribute('data-closed-by-page-hide'))).toBe(false);
	});

	it('tells its onOpenChange nothing when its page hides it closed', async () => {
		const onOpenChange = vi.fn();
		const page = renderKeptPage(renamePasskey(onOpenChange));

		await page.hide();
		await page.show();

		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

describe('DialogContent', () => {
	it('makes its close button 44 px under a finger', async () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Rename passkey</DialogTitle>
				</DialogContent>
			</Dialog>
		);

		const close = await screen.findByRole('button', { name: 'Close' });
		expect(close.className.split(' ')).toContain('pointer-coarse:size-11');
	});
});
