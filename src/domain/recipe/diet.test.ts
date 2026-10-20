import { describe, expect, it } from 'vitest';
import {
	dietLabels,
	dietListSchema,
	diets,
	dietSchemaOrgNames,
	dietsFromKeywords,
	dietsFromSchemaOrg,
	dietsImpliedBy,
	withImpliedDiets,
	withoutImpliedDiets,
	type Diet,
} from '@/domain/recipe/diet';

describe('diets', () => {
	it('runs in display order', () => {
		expect(diets.map((diet) => dietLabels[diet])).toEqual([
			'Vegetarian',
			'Vegan',
			'Gluten-free',
			'Dairy-free',
		]);
	});
});

describe('dietSchemaOrgNames', () => {
	it('names schema.org’s RestrictedDiet members, and none for Dairy-free', () => {
		expect(dietSchemaOrgNames).toStrictEqual({
			vegetarian: 'VegetarianDiet',
			vegan: 'VeganDiet',
			'gluten-free': 'GlutenFreeDiet',
			'dairy-free': undefined,
		});
	});
});

describe('dietsImpliedBy', () => {
	it('finds Vegetarian and Dairy-free in Vegan', () => {
		expect(dietsImpliedBy(['vegan'])).toEqual(new Set(['vegetarian', 'dairy-free']));
	});

	it('finds nothing in diets without Vegan', () => {
		expect(dietsImpliedBy([])).toEqual(new Set());
		expect(dietsImpliedBy(['vegetarian', 'gluten-free', 'dairy-free'])).toEqual(new Set());
	});
});

describe('withImpliedDiets', () => {
	it('adds Vegetarian and Dairy-free to Vegan', () => {
		expect(withImpliedDiets(['vegan'])).toEqual(['vegetarian', 'vegan', 'dairy-free']);
	});

	it('adds nothing to diets without Vegan', () => {
		expect(withImpliedDiets([])).toEqual([]);
		expect(withImpliedDiets(['gluten-free'])).toEqual(['gluten-free']);
		expect(withImpliedDiets(['vegetarian', 'dairy-free'])).toEqual(['vegetarian', 'dairy-free']);
	});

	it('lists each diet once, in display order', () => {
		expect(
			withImpliedDiets(['dairy-free', 'gluten-free', 'vegan', 'vegetarian', 'dairy-free'])
		).toEqual(['vegetarian', 'vegan', 'gluten-free', 'dairy-free']);
	});
});

describe('withoutImpliedDiets', () => {
	it('keeps Vegan alone of Vegetarian, Vegan, and Dairy-free', () => {
		expect(withoutImpliedDiets(['vegetarian', 'vegan', 'dairy-free'])).toEqual(['vegan']);
	});

	it('keeps diets without Vegan as they are', () => {
		expect(withoutImpliedDiets(['vegetarian'])).toEqual(['vegetarian']);
		expect(withoutImpliedDiets(['vegetarian', 'dairy-free'])).toEqual(['vegetarian', 'dairy-free']);
	});

	it('lists each diet once, in display order', () => {
		expect(withoutImpliedDiets(['gluten-free', 'vegan', 'vegetarian', 'vegan'])).toEqual([
			'vegan',
			'gluten-free',
		]);
	});
});

describe('dietsFromSchemaOrg', () => {
	it.each<unknown>([
		'https://schema.org/GlutenFreeDiet',
		'http://schema.org/GlutenFreeDiet',
		'GlutenFreeDiet',
		'schema:GlutenFreeDiet',
		' GlutenFreeDiet ',
		{ '@id': 'https://schema.org/GlutenFreeDiet' },
		{ '@id': 'http://schema.org/GlutenFreeDiet' },
		{ '@id': 'GlutenFreeDiet' },
		{ '@id': 'schema:GlutenFreeDiet' },
	])('reads %j', (value) => {
		expect(dietsFromSchemaOrg([value])).toEqual(['gluten-free']);
	});

	it('reads Vegan with what it implies', () => {
		expect(dietsFromSchemaOrg(['https://schema.org/VeganDiet'])).toEqual([
			'vegetarian',
			'vegan',
			'dairy-free',
		]);
	});

	it('ignores LowLactoseDiet, which allows dairy', () => {
		expect(
			dietsFromSchemaOrg([
				'https://schema.org/LowLactoseDiet',
				'LowLactoseDiet',
				{ '@id': 'schema:LowLactoseDiet' },
			])
		).toEqual([]);
		expect(dietsFromSchemaOrg(['LowLactoseDiet', 'VegetarianDiet'])).toEqual(['vegetarian']);
	});

	it('ignores other diets, other vocabularies, and values that are not names', () => {
		expect(
			dietsFromSchemaOrg([
				'https://schema.org/HalalDiet',
				'LowFatDiet',
				'https://example.com/VeganDiet',
				'Vegan',
				'vegandiet',
				42,
				null,
				{},
				{ '@id': 7 },
				['VeganDiet'],
			])
		).toEqual([]);
	});

	it('lists each diet once, in display order', () => {
		expect(
			dietsFromSchemaOrg([
				'GlutenFreeDiet',
				'https://schema.org/VegetarianDiet',
				'schema:GlutenFreeDiet',
			])
		).toEqual(['vegetarian', 'gluten-free']);
	});
});

describe('dietsFromKeywords', () => {
	it.each<[string, Diet]>([
		['Vegetarian', 'vegetarian'],
		['gluten-free', 'gluten-free'],
		['Gluten Free', 'gluten-free'],
		['GLUTEN-FREE', 'gluten-free'],
		['glutenfree', 'gluten-free'],
		['dairy-free', 'dairy-free'],
		['Dairy free', 'dairy-free'],
	])('reads %j as %s', (keyword, diet) => {
		expect(dietsFromKeywords([keyword])).toEqual([diet]);
	});

	it('reads Vegan with what it implies', () => {
		expect(dietsFromKeywords(['vegan'])).toEqual(['vegetarian', 'vegan', 'dairy-free']);
	});

	it('reads a diet only from a whole keyword', () => {
		expect(
			dietsFromKeywords(['vegan option', 'gluten-free flour', 'easily made dairy-free'])
		).toEqual([]);
	});

	it('reads neither non-dairy nor lactose-free as dairy-free', () => {
		expect(dietsFromKeywords(['non-dairy', 'Lactose-free'])).toEqual([]);
	});

	it('lists each diet once, in display order', () => {
		expect(dietsFromKeywords(['dairy free', 'Gluten-free', 'vegan', 'dairy-free'])).toEqual([
			'vegetarian',
			'vegan',
			'gluten-free',
			'dairy-free',
		]);
	});
});

describe('dietListSchema', () => {
	it('holds what Vegan implies, once each, in display order', () => {
		expect(dietListSchema.parse(['gluten-free', 'vegan', 'vegan'])).toEqual([
			'vegetarian',
			'vegan',
			'gluten-free',
			'dairy-free',
		]);
	});

	it('refuses a diet outside the vocabulary', () => {
		expect(dietListSchema.safeParse(['nut-free']).success).toBe(false);
	});
});
