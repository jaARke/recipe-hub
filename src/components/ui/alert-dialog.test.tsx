import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function popupParts(): Element[] {
	return Array.from(
		document.querySelectorAll(
			'[data-slot="alert-dialog-overlay"], [data-slot="alert-dialog-content"]'
		)
	);
}

describe('AlertDialog', () => {
	it('closes as its page hides, kept from drawing as the page shows, where it unmounts at once', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(
			<AlertDialog>
				<AlertDialogTrigger>Delete</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogTitle>Delete “Lemon bars”?</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>
		);

		await user.click(screen.getByRole('button', { name: 'Delete' }));
		expect(await screen.findByRole('alertdialog')).toBeDefined();
		await page.hide();

		expect(popupParts()).toHaveLength(2);
		for (const part of popupParts()) {
			expect(part.hasAttribute('data-closed')).toBe(true);
			expect(part.hasAttribute('data-closed-by-page-hide')).toBe(true);
		}
		await page.show();
		expect(popupParts()).toEqual([]);
	});
});
