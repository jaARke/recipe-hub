import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { displayAsPageShows, expectPopupUnmounted } from '@/components/ui/testing/kept-page-popup';

function popupParts(): Element[] {
	return Array.from(
		document.querySelectorAll(
			'[data-slot="alert-dialog-overlay"], [data-slot="alert-dialog-content"]'
		)
	);
}

describe('AlertDialog', () => {
	it('closes as its page hides, kept from drawing as the page shows, where it unmounts at once', async () => {
		const keptPage = await renderKeptPage(
			<AlertDialog>
				<AlertDialogTrigger>Delete</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogTitle>Delete “Lemon bars”?</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>
		);
		await page.getByRole('button', { name: 'Delete' }).click();
		await expect.element(page.getByRole('alertdialog')).toBeVisible();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none', 'none']);
		await expectPopupUnmounted(popupParts);
	});
});
