import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

describe('DropdownMenu', () => {
	it('closes as its page hides, so a return through history finds it closed', async () => {
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
		await page.show();

		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
	});
});
