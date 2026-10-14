import { describe, expect, it } from 'vitest';
import { readUnit } from '@/domain/recipe/ingredient-units';

describe('readUnit', () => {
	it.each([
		['T', 'tablespoon'],
		['T.', 'tablespoon'],
		['Tbs', 'tablespoon'],
		['tbs', 'tablespoon'],
		['tbsps', 'tablespoon'],
		['tbls', 'tablespoon'],
		['level tablespoons', 'tablespoon'],
		['t', 'teaspoon'],
		['t.', 'teaspoon'],
		['teas', 'teaspoon'],
		['tea sp.', 'teaspoon'],
		['tsps.', 'teaspoon'],
		['cupful', 'cup'],
		['c.', 'cup'],
		['fl. oz.', 'fluid ounce'],
		['fl oz', 'fluid ounce'],
		['sq.', 'square'],
		['pk', 'peck'],
		['cl', 'centiliter'],
		['litres', 'liter'],
		['env.', 'envelope'],
		['pkt.', 'packet'],
		['loaves', 'loaf'],
		['can (14 ounces)', 'can'],
		['oz (340 g)', 'ounce'],
	])('reads "%s" as the unit %s', (unit, id) => {
		expect(readUnit(unit)).toBe(id);
	});

	it.each(['eggs', 'large', 'small', ''])('reads no unit in "%s"', (unit) => {
		expect(readUnit(unit)).toBeUndefined();
	});
});
