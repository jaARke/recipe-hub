import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';
import { Button } from '@/components/ui/button';
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { displayAsPageShows } from '@/components/ui/testing/kept-page-popup';

function chapterPicker(onOpenChange?: (open: boolean) => void) {
	return (
		<Sheet onOpenChange={onOpenChange}>
			<SheetTrigger>All Recipes</SheetTrigger>
			<SheetContent side="bottom">
				<SheetTitle>Chapters</SheetTitle>
			</SheetContent>
		</Sheet>
	);
}

function popupParts(): Element[] {
	return Array.from(
		document.querySelectorAll('[data-slot="sheet-overlay"], [data-slot="sheet-content"]')
	);
}

// Taller than any phone's screen.
const manyRows = Array.from({ length: 40 }, (_, index) => `Row ${index + 1}`);

describe('Sheet', () => {
	it('closes as its page hides, kept from drawing as the page shows, where it unmounts at once', async () => {
		const keptPage = await renderKeptPage(chapterPicker());
		await page.getByRole('button', { name: 'All Recipes' }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none', 'none']);
		await expect.poll(popupParts).toEqual([]);
	});

	it('gives focus back to what it opened from before its page hides', async () => {
		// Notes where focus is as React hides the page, after the sheet's cleanups and before Base UI's
		// own return of focus, which waits for a microtask.
		const focusedAsHidden = vi.fn<(element: Element | null) => void>();
		function FocusAsPageHides() {
			useOnKeptPageHide(() => focusedAsHidden(document.activeElement));
			return null;
		}
		const keptPage = await renderKeptPage(
			<>
				{chapterPicker()}
				<FocusAsPageHides />
			</>
		);
		// Read while shown: the hidden page's trigger leaves the accessibility tree locators search.
		const trigger = page.getByRole('button', { name: 'All Recipes' }).element();

		await page.getByRole('button', { name: 'All Recipes' }).click();
		await expect
			.poll(() => page.getByRole('dialog').query()?.contains(document.activeElement))
			.toBe(true);
		await keptPage.hide();

		expect(focusedAsHidden).toHaveBeenCalledExactlyOnceWith(trigger);
	});

	it('opens as usual after its page hid it', async () => {
		const keptPage = await renderKeptPage(chapterPicker());
		await page.getByRole('button', { name: 'All Recipes' }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await page.getByRole('button', { name: 'All Recipes' }).click();

		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByRole('dialog')).not.toHaveAttribute('data-closed-by-page-hide');
	});

	it('tells its onOpenChange nothing when its page hides it closed', async () => {
		const onOpenChange = vi.fn();
		const keptPage = await renderKeptPage(chapterPicker(onOpenChange));

		await keptPage.hide();
		await keptPage.show();

		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

describe('SheetContent', () => {
	it('makes its close button 44 px under a finger', async () => {
		await render(
			<Sheet open>
				<SheetContent side="bottom">
					<SheetTitle>Chapters</SheetTitle>
				</SheetContent>
			</Sheet>
		);

		await expect
			.element(page.getByRole('button', { name: 'Close' }))
			.toHaveClass('pointer-coarse:size-11');
	});

	it('keeps a bottom sheet’s header and footer in view, below a strip of the page, while its body scrolls between them', async () => {
		await render(
			<Sheet open>
				<SheetContent side="bottom">
					<SheetHeader>
						<SheetTitle>Filter and sort</SheetTitle>
					</SheetHeader>
					<ol role="list" className="overflow-y-auto p-4">
						{manyRows.map((row) => (
							<li key={row}>{row}</li>
						))}
					</ol>
					<SheetFooter>
						<Button>Show 6 recipes</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		);
		const sheet = page.getByRole('dialog');
		await expect.element(sheet).toBeVisible();

		const lastRow = sheet.getByText('Row 40');
		expect(sheet.element().getBoundingClientRect().height).toBeLessThan(window.innerHeight);
		await expect.element(lastRow).not.toBeInViewport();

		lastRow.element().scrollIntoView();

		await expect.element(lastRow).toBeInViewport();
		await expect.element(sheet.getByRole('heading', { name: 'Filter and sort' })).toBeInViewport();
		await expect.element(sheet.getByRole('button', { name: 'Show 6 recipes' })).toBeInViewport();
	});

	it('scrolls a bottom sheet whole when nothing inside it scrolls', async () => {
		await render(
			<Sheet open>
				<SheetContent side="bottom">
					<SheetHeader>
						<SheetTitle>Chapters</SheetTitle>
					</SheetHeader>
					<ol role="list">
						{manyRows.map((row) => (
							<li key={row}>{row}</li>
						))}
					</ol>
				</SheetContent>
			</Sheet>
		);
		const sheet = page.getByRole('dialog');
		await expect.element(sheet).toBeVisible();

		const lastRow = sheet.getByText('Row 40');
		expect(sheet.element().getBoundingClientRect().height).toBeLessThan(window.innerHeight);
		await expect.element(lastRow).not.toBeInViewport();

		lastRow.element().scrollIntoView();

		await expect.element(lastRow).toBeInViewport();
	});
});
