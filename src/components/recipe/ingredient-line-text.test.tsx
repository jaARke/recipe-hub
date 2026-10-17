import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import type { IngredientLineSpan } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { scaleIngredientLine } from '@/domain/recipe/ingredient-scaling';

// Marks each part the line renders through renderText, as the recipe form marks what is left to check.
function markText(text: string) {
	return <mark>{text}</mark>;
}

// Marks each span the line is given, as the cooking view underlines an amount a scale left unscaled.
function markSpan(text: ReactNode) {
	return <ins>{text}</ins>;
}

describe('IngredientLineText', () => {
	it.each([
		['About ¼ cupful cold water', 'About ¼ cupful cold water', '¼ cupful'],
		['1 cup of water', '1 cup of water', '1 cup'],
		['a pinch of salt', '1 pinch of salt', '1 pinch'],
		['half a cup of milk', '½ cup of milk', '½ cup'],
		['about 1 cup of rice', 'about 1 cup of rice', '1 cup'],
		['2 heaping tablespoons of cocoa', '2 heaping tablespoons of cocoa', '2 heaping tablespoons'],
		['1 can (14 oz) of tomatoes', '1 can (14 oz) of tomatoes', '1 can (14 oz)'],
		['1 (14 oz) can of tomatoes', '1 (14 oz) can of tomatoes', '1'],
		['two eggs', '2 eggs', '2'],
		['2 cups flour', '2 cups flour', '2 cups'],
	])('shows "%s" as "%s", with "%s" in bold', async (text, shown, bold) => {
		const { locator } = await render(<IngredientLineText line={parseIngredientLine(text)} />);

		await expect.element(locator).toHaveTextContent(shown);
		await expect.element(locator.getByText(bold)).toHaveStyle({ fontWeight: '600' });
	});

	it('keeps the words between the unit and the item when the scale changes the unit', async () => {
		const { line } = scaleIngredientLine(parseIngredientLine('1 cup of water'), 2);
		const { locator } = await render(<IngredientLineText line={line} />);

		await expect.element(locator).toHaveTextContent('2 cups of water');
	});

	it.each([
		['1 cup of flour plus a tablespoon', 2, '2 cups of flour plus 2 tablespoons'],
		[
			'1 cup sugar for the cake plus 2 tablespoons for the top',
			2,
			'2 cups sugar for the cake plus ¼ cup for the top',
		],
	])(
		'shows "%s" by %s as "%s", with the words between its parts as written though the scale changed them',
		async (text, factor, shown) => {
			const written = parseIngredientLine(text);
			const { line } = scaleIngredientLine(written, factor);
			const { locator } = await render(<IngredientLineText line={line} written={written} />);

			await expect.element(locator).toHaveTextContent(shown);
		}
	);

	it.each([
		['1/3 [?] cup flour', 2, '⅔ [?] cup flour'],
		['1 [?] cup (240 ml) milk', 2, '2 [?] cups (480 ml) milk'],
		['3 [?] tsp vanilla', 3, '3 [?] tablespoons vanilla'],
	])('shows "%s" by %s as "%s", with the marker before the unit', async (text, factor, shown) => {
		const { line } = scaleIngredientLine(parseIngredientLine(text), factor);
		const { locator } = await render(<IngredientLineText line={line} />);

		await expect.element(locator).toHaveTextContent(shown);
	});

	it('renders the unit as it renders the words after the amount, so a marker in it shows', async () => {
		const { locator } = await render(
			<IngredientLineText
				line={parseIngredientLine('1 1/2 [?] cups flour')}
				renderText={markText}
			/>
		);

		expect(
			locator
				.getByRole('mark')
				.elements()
				.map((mark) => mark.textContent)
		).toEqual(['[?] cups', 'flour']);
	});

	it('renders the words between the unit and the item as it renders the item, outside the bold', async () => {
		const { locator } = await render(
			<IngredientLineText line={parseIngredientLine('1 [?] cup of milk')} renderText={markText} />
		);

		expect(
			locator
				.getByRole('mark')
				.elements()
				.map((mark) => mark.textContent)
		).toEqual(['[?] cup', 'of milk']);
		await expect.element(locator.getByText('1 [?] cup')).toHaveStyle({ fontWeight: '600' });
	});

	it.each<[string, IngredientLineSpan[], string[], string]>([
		[
			'2 envelopes (4½ teaspoons) active dry yeast',
			[{ field: 'unit', start: 11, end: 23 }],
			['4½ teaspoons'],
			'600',
		],
		[
			'1 cup of milk (about 8 ounces)',
			[{ field: 'item', start: 12, end: 20 }],
			['8 ounces'],
			'400',
		],
		[
			'1 cup of milk (about 8 ounces or 2 cups)',
			[
				{ field: 'item', start: 12, end: 20 },
				{ field: 'item', start: 24, end: 30 },
			],
			['8 ounces', '2 cups'],
			'400',
		],
		[
			'2 whole chickens, about 4 pounds',
			[{ field: 'preparation', start: 6, end: 14 }],
			['4 pounds'],
			'400',
		],
		['1 cup sugar for the 2 pans', [{ field: 'preparation', start: 8, end: 9 }], ['2'], '400'],
	])(
		'shows "%s" whole, with each span its field holds marked past what the line writes before the field',
		async (text, spans, marked, fontWeight) => {
			const { locator } = await render(
				<IngredientLineText line={parseIngredientLine(text)} marks={{ spans, render: markSpan }} />
			);

			await expect.element(locator).toHaveTextContent(text);
			const marks = locator.getByRole('insertion');
			expect(marks.elements().map((mark) => mark.textContent)).toEqual(marked);
			await expect.element(marks.first()).toHaveStyle({ fontWeight });
		}
	);
});
