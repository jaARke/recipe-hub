import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

describe('DropdownMenu', () => {
	it('closes as its page hides, kept from drawing as the page shows again', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(
			<DropdownMenu>
				<DropdownMenuTrigger>Recipe actions</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Edit recipe</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
		const trigger = screen.getByRole('button', { name: 'Recipe actions' });

		await user.click(trigger);
		expect(await screen.findByRole('menu')).toBeDefined();
		await page.hide();
		expect(
			document
				.querySelector('[data-slot="dropdown-menu-content"]')
				?.hasAttribute('data-closed-by-page-hide')
		).toBe(true);
		await page.show();

		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
	});

	it('still closes as its page hides after a submenu opened and closed', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(
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
		const trigger = screen.getByRole('button', { name: 'Recipe actions' });

		await user.click(trigger);
		(await screen.findByRole('menuitem', { name: 'Move to' })).focus();
		await user.keyboard('{ArrowRight}');
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Desserts' }))
		);
		await user.keyboard('{ArrowLeft}');
		await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Desserts' })).toBeNull());
		await page.hide();
		expect(
			document
				.querySelector('[data-slot="dropdown-menu-content"]')
				?.hasAttribute('data-closed-by-page-hide')
		).toBe(true);
		await page.show();

		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
	});
});
