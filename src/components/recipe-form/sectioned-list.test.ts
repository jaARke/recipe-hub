import { describe, expect, it } from 'vitest';
import {
	describeMove,
	itemLabel,
	itemMoves,
	itemName,
	sectionName,
} from '@/components/recipe-form/sectioned-list';

function section(heading: string, ...texts: string[]) {
	return { heading, items: texts.map((text) => ({ text })) };
}

const sections = [
	section('', '2 cups flour', '1 teaspoon salt', '', '1 cup milk'),
	section('For the glaze', '1 cup powdered sugar', '2 tablespoons milk'),
	section('  ', '1 egg'),
];

describe('sectionName', () => {
	it('uses the heading, or the section number where there is none', () => {
		expect(sectionName(sections, 1)).toBe('For the glaze');
		expect(sectionName(sections, 0)).toBe('section 1');
		expect(sectionName(sections, 2)).toBe('section 3');
	});
});

describe('itemLabel', () => {
	it('numbers an item within its section', () => {
		expect(itemLabel('ingredient', sections, { sectionIndex: 0, itemIndex: 2 }, false)).toBe(
			'Ingredient 3'
		);
	});

	it('names the section, since numbers restart in each one', () => {
		expect(itemLabel('step', sections, { sectionIndex: 1, itemIndex: 1 }, true)).toBe(
			'Step 2, For the glaze'
		);
		expect(itemLabel('step', sections, { sectionIndex: 2, itemIndex: 0 }, true)).toBe(
			'Step 1, section 3'
		);
	});
});

describe('itemName', () => {
	it('quotes the item’s own text', () => {
		expect(itemName('  2 cups flour ', 'ingredient')).toBe('“2 cups flour”');
	});

	it('cuts long text to 40 characters', () => {
		expect(
			itemName('Whisk the eggs and sugar until pale and thick, about 3 minutes.', 'step')
		).toBe('“Whisk the eggs and sugar until pale and…”');
	});

	it('uses the noun for a blank item', () => {
		expect(itemName('   ', 'step')).toBe('step');
	});
});

describe('describeMove', () => {
	it('names both positions for a move within a section', () => {
		expect(
			describeMove(
				sections,
				{ sectionIndex: 0, itemIndex: 3 },
				{ sectionIndex: 0, itemIndex: 2 },
				'ingredient'
			)
		).toBe('Moved “1 cup milk” from position 4 to 3 of 4.');
	});

	it('names the section and the new position for a move to another section', () => {
		expect(
			describeMove(
				sections,
				{ sectionIndex: 0, itemIndex: 0 },
				{ sectionIndex: 1, itemIndex: 2 },
				'ingredient'
			)
		).toBe('Moved “2 cups flour” to For the glaze, position 3 of 3.');
		expect(
			describeMove(
				sections,
				{ sectionIndex: 0, itemIndex: 2 },
				{ sectionIndex: 2, itemIndex: 1 },
				'ingredient'
			)
		).toBe('Moved ingredient to section 3, position 2 of 2.');
	});
});

describe('itemMoves', () => {
	it('offers up, down, and the end of every other section', () => {
		expect(itemMoves(sections, { sectionIndex: 1, itemIndex: 0 })).toEqual([
			{ kind: 'up', label: 'Move up', to: undefined },
			{ kind: 'down', label: 'Move down', to: { sectionIndex: 1, itemIndex: 1 } },
			{ kind: 'section', label: 'Move to section 1', to: { sectionIndex: 0, itemIndex: 4 } },
			{ kind: 'section', label: 'Move to section 3', to: { sectionIndex: 2, itemIndex: 1 } },
		]);
	});

	it('leads nowhere down from the last item', () => {
		const [up, down] = itemMoves(sections, { sectionIndex: 0, itemIndex: 3 });

		expect(up?.to).toEqual({ sectionIndex: 0, itemIndex: 2 });
		expect(down?.to).toBeUndefined();
	});

	it('offers only up and down without other sections', () => {
		expect(itemMoves([sections[0] ?? section('')], { sectionIndex: 0, itemIndex: 1 })).toEqual([
			{ kind: 'up', label: 'Move up', to: { sectionIndex: 0, itemIndex: 0 } },
			{ kind: 'down', label: 'Move down', to: { sectionIndex: 0, itemIndex: 2 } },
		]);
	});
});
