import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { displayAsPageShows } from '@/components/ui/testing/kept-page-popup';

const orders = [
	{ value: 'newest', label: 'Newest' },
	{ value: 'title', label: 'Title' },
];

function popupParts(): Element[] {
	return Array.from(document.querySelectorAll('[data-slot="select-content"]'));
}

describe('Select', () => {
	it('closes as its page hides, kept from drawing as the page shows again', async () => {
		const keptPage = await renderKeptPage(
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
		await page.getByRole('combobox', { name: 'Order' }).click();
		await expect.element(page.getByRole('listbox')).toBeVisible();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none']);
		// Base UI keeps a select's popup mounted once it closes.
		await expect
			.element(page.getByRole('combobox', { name: 'Order' }))
			.toHaveAttribute('aria-expanded', 'false');
	});
});
