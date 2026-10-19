import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

function styleOf(role: 'checkbox' | 'radio', name: string): CSSStyleDeclaration {
	return getComputedStyle(page.getByRole(role, { name }).element());
}

describe('RadioGroupItem', () => {
	it("casts the checkbox's shadow", async () => {
		await render(
			<>
				<Checkbox aria-label="Favorite" />
				<RadioGroup aria-label="Chapter">
					<RadioGroupItem value="desserts" aria-label="Desserts" />
				</RadioGroup>
			</>
		);

		expect(styleOf('radio', 'Desserts').boxShadow).not.toBe('none');
		expect(styleOf('radio', 'Desserts').boxShadow).toBe(styleOf('checkbox', 'Favorite').boxShadow);
	});

	it('dims once disabled in its field, as the checkbox does', async () => {
		await render(
			<RadioGroup aria-label="Chapter" defaultValue="desserts">
				<Field orientation="horizontal">
					<RadioGroupItem id="chapter-desserts" value="desserts" />
					<FieldLabel htmlFor="chapter-desserts">Desserts</FieldLabel>
				</Field>
				<Field orientation="horizontal" data-disabled="true">
					<RadioGroupItem id="chapter-cookies-candy" value="cookies-candy" disabled />
					<FieldLabel htmlFor="chapter-cookies-candy">Cookies & Candy</FieldLabel>
				</Field>
			</RadioGroup>
		);

		expect(styleOf('radio', 'Desserts').opacity).toBe('1');
		expect(styleOf('radio', 'Cookies & Candy').opacity).toBe('0.5');
	});
});
