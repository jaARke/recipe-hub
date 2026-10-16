import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

const orders = [
	{ value: 'newest', label: 'Newest' },
	{ value: 'title', label: 'Title' },
];

describe('Select', () => {
	it('closes as its page hides, so a return through history finds it closed', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(
			<Select items={orders} defaultValue="newest">
				<SelectTrigger aria-label="Order">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{orders.map((order) => (
						<SelectItem key={order.value} value={order.value}>
							{order.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
		const trigger = screen.getByRole('combobox', { name: 'Order' });

		await user.click(trigger);
		expect(await screen.findByRole('listbox')).toBeDefined();
		await page.hide();
		await page.show();

		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
	});
});
