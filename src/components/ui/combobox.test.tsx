import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/components/ui/combobox';
import { displayAsPageShows } from '@/components/ui/testing/kept-page-popup';

const courses = ['Soup', 'Bread', 'Salad'];

function popupParts(): Element[] {
	return Array.from(document.querySelectorAll('[data-slot="combobox-content"]'));
}

describe('Combobox', () => {
	it('closes as its page hides, kept from drawing as the page shows again', async () => {
		const keptPage = await renderKeptPage(
			<Combobox items={courses}>
				<ComboboxInput aria-label="Course" triggerLabel="Show courses" />
				<ComboboxContent>
					<ComboboxList>
						{(course: string) => (
							<ComboboxItem key={course} value={course}>
								{course}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		);
		await page.getByRole('button', { name: 'Show courses' }).click();
		await expect.element(page.getByRole('listbox')).toBeVisible();
		await keptPage.hide();

		expect(await displayAsPageShows(popupParts(), keptPage.show)).toEqual(['none']);
		await expect.poll(popupParts).toEqual([]);
	});
});
