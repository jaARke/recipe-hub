import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { scaleIngredientLine } from '@/domain/recipe/ingredient-scaling';

describe('IngredientLineText', () => {
	it('keeps the word the amount was read past, as in "About"', () => {
		const { container } = render(
			<IngredientLineText line={parseIngredientLine('About ¼ cupful cold water')} />
		);
		expect(container.textContent).toBe('About ¼ cupful cold water');
		expect(container.querySelector('.font-semibold')?.textContent).toBe('¼ cupful');
	});

	it.each([
		['1 cup of water', '1 cup of water', '1 cup'],
		['a pinch of salt', '1 pinch of salt', '1 pinch'],
		['half a cup of milk', '½ cup of milk', '½ cup'],
		['about 1 cup of rice', 'about 1 cup of rice', '1 cup'],
		['2 heaping tablespoons of cocoa', '2 heaping tablespoons of cocoa', '2 heaping tablespoons'],
		['1 can (14 oz) of tomatoes', '1 can (14 oz) of tomatoes', '1 can (14 oz)'],
		['1 (14 oz) can of tomatoes', '1 (14 oz) can of tomatoes', '1'],
		['two eggs', '2 eggs', '2'],
		['2 cups flour', '2 cups flour', '2 cups'],
	])('shows "%s" as "%s", with "%s" in bold', (text, shown, bold) => {
		const { container } = render(<IngredientLineText line={parseIngredientLine(text)} />);
		expect(container.textContent).toBe(shown);
		expect(container.querySelector('.font-semibold')?.textContent).toBe(bold);
	});

	it('keeps the words between the unit and the item when the scale changes the unit', () => {
		const { line } = scaleIngredientLine(parseIngredientLine('1 cup of water'), 2);
		const { container } = render(<IngredientLineText line={line} />);
		expect(container.textContent).toBe('2 cups of water');
	});

	it('renders the unit as it renders the words after the amount, so a marker in it shows', () => {
		const { container } = render(
			<IngredientLineText
				line={parseIngredientLine('1 1/2 [?] cups flour')}
				renderText={(text) => <mark>{text}</mark>}
			/>
		);
		expect(Array.from(container.querySelectorAll('mark'), (mark) => mark.textContent)).toEqual([
			'[?] cups',
			'flour',
		]);
	});

	it('renders the words between the unit and the item as it renders the item, outside the bold', () => {
		const { container } = render(
			<IngredientLineText
				line={parseIngredientLine('1 [?] cup of milk')}
				renderText={(text) => <mark>{text}</mark>}
			/>
		);
		expect(Array.from(container.querySelectorAll('mark'), (mark) => mark.textContent)).toEqual([
			'[?] cup',
			'of milk',
		]);
		expect(container.querySelector('.font-semibold')?.textContent).toBe('1 [?] cup');
	});
});
