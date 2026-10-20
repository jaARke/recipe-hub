import { z } from 'zod';
import { slugKey } from '@/domain/recipe/slug';

// Only diets a source states, never ones inferred from ingredients: a wrong gluten-free claim can
// hurt someone. No allergy diets, for the same reason.
export const diets = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;
export type Diet = (typeof diets)[number];

export const dietLabels = {
	vegetarian: 'Vegetarian',
	vegan: 'Vegan',
	'gluten-free': 'Gluten-free',
	'dairy-free': 'Dairy-free',
} as const satisfies Record<Diet, string>;

// Each diet's member of schema.org's RestrictedDiet, as suitableForDiet names it. Dairy-free has
// none: LowLactoseDiet allows dairy, so giving it would be a false claim.
export const dietSchemaOrgNames = {
	vegetarian: 'VegetarianDiet',
	vegan: 'VeganDiet',
	'gluten-free': 'GlutenFreeDiet',
	'dairy-free': undefined,
} as const satisfies Record<Diet, string | undefined>;

// Every other diet each one implies, in full, since implications are not followed in turn.
export const impliedDiets = {
	vegetarian: [],
	vegan: ['vegetarian', 'dairy-free'],
	'gluten-free': [],
	'dairy-free': [],
} as const satisfies Record<Diet, readonly Diet[]>;

// The keywords an imported page states each diet by, compared by slug key, so case and punctuation don't
// count. A keyword states a diet only as a whole, since "vegan option" says nothing of the recipe.
const dietKeywordHints = {
	vegetarian: ['vegetarian'],
	vegan: ['vegan'],
	'gluten-free': ['gluten-free', 'glutenfree'],
	// Not "non-dairy", which US labels allow on food holding milk protein, or "lactose-free".
	'dairy-free': ['dairy-free', 'dairyfree'],
} as const satisfies Record<Diet, readonly string[]>;

// How a page writes a schema.org name: bare, with the schema: prefix, or as either address.
const schemaOrgPrefixes = ['', 'schema:', 'http://schema.org/', 'https://schema.org/'];

const dietsBySchemaOrgTerm = new Map<string, Diet>(
	diets.flatMap((diet) => {
		const name = dietSchemaOrgNames[diet];
		return name === undefined
			? []
			: schemaOrgPrefixes.map((prefix) => [`${prefix}${name}`, diet] as const);
	})
);

const dietsByKeyword = new Map(
	diets.flatMap((diet) => dietKeywordHints[diet].map((hint) => [slugKey(hint), diet] as const))
);

// Every diet the given ones imply.
export function dietsImpliedBy(given: readonly Diet[]): ReadonlySet<Diet> {
	return new Set(given.flatMap((diet) => impliedDiets[diet]));
}

// The diets given, with every one they imply, once each, in display order.
export function withImpliedDiets(given: readonly Diet[]): Diet[] {
	const implied = dietsImpliedBy(given);
	return diets.filter((diet) => given.includes(diet) || implied.has(diet));
}

// The diets given, without those another of them implies, once each, in display order.
export function withoutImpliedDiets(given: readonly Diet[]): Diet[] {
	const implied = dietsImpliedBy(given);
	return diets.filter((diet) => given.includes(diet) && !implied.has(diet));
}

export const dietListSchema = z.array(z.enum(diets)).overwrite(withImpliedDiets);

// The term a suitableForDiet value names, as text or as a node's @id.
function schemaOrgTerm(value: unknown): string | undefined {
	const term = typeof value === 'object' && value !== null && '@id' in value ? value['@id'] : value;
	return typeof term === 'string' ? term.trim() : undefined;
}

// The diets a page's suitableForDiet values name, with what they imply. A RestrictedDiet with no diet
// here, such as LowLactoseDiet, names none.
export function dietsFromSchemaOrg(values: readonly unknown[]): Diet[] {
	return withImpliedDiets(
		values
			.map(schemaOrgTerm)
			.filter((term) => term !== undefined)
			.map((term) => dietsBySchemaOrgTerm.get(term))
			.filter((diet) => diet !== undefined)
	);
}

// The diets a page's keywords state, with what they imply. Each entry is one keyword, so a value
// listing several with commas is split first.
export function dietsFromKeywords(keywords: readonly string[]): Diet[] {
	return withImpliedDiets(
		keywords
			.map((keyword) => dietsByKeyword.get(slugKey(keyword)))
			.filter((diet) => diet !== undefined)
	);
}
