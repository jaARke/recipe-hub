import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { displayAsPageShows } from '@/components/ui/testing/kept-page-popup';

function popupParts(): Element[] {
	return Array.from(document.querySelectorAll('[data-slot="dropdown-menu-content"]'));
}

describe('DropdownMenu', () => {
	it('closes as its page hides, kept from drawing as the page shows again', async () => {
		const keptPage = await renderKeptPage(
			<DropdownMenu>
				<DropdownMenuTrigger>Recipe actions</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Edit recipe</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await expect.element(page.getByRole('menu')).toBeVisible();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none']);
		await expect.poll(popupParts).toEqual([]);
	});

	it('still closes as its page hides after a submenu opened and closed', async () => {
		const keptPage = await renderKeptPage(
			<DropdownMenu>
				<DropdownMenuTrigger>Recipe actions</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>Desserts</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuContent>
			</DropdownMenu>
		);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await expect.element(page.getByRole('menu')).toBeVisible();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(page.getByRole('menuitem', { name: 'Move to' })).toHaveFocus();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(page.getByRole('menuitem', { name: 'Desserts' })).toHaveFocus();
		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(page.getByRole('menuitem', { name: 'Desserts' })).not.toBeInTheDocument();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none']);
		await expect.poll(popupParts).toEqual([]);
	});
});
