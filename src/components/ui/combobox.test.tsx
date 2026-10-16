import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/components/ui/combobox';

const courses = ['Soup', 'Bread', 'Salad'];

describe('Combobox', () => {
	it('closes as its page hides, so a return through history finds it closed', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(
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
		const input = screen.getByRole('combobox', { name: 'Course' });

		await user.click(screen.getByRole('button', { name: 'Show courses' }));
		expect(await screen.findByRole('listbox')).toBeDefined();
		await page.hide();
		await page.show();

		expect(input.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
	});
});
