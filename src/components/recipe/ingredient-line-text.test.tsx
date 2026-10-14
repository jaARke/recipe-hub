import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';

describe('IngredientLineText', () => {
	it('keeps the word the amount was read past, as in "About"', () => {
		const { container } = render(
			<IngredientLineText line={parseIngredientLine('About ¼ cupful cold water')} />
		);
		expect(container.textContent).toBe('About ¼ cupful cold water');
		expect(container.querySelector('.font-semibold')?.textContent).toBe('¼ cupful');
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
});
