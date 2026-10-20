import { asSchema } from 'ai';
import { describe, expect, it } from 'vitest';
import { pageOutputSchema, scanOutputSchema } from '@/infrastructure/ai/recipe-output';

type JsonSchemaNode = { [keyword: string]: unknown };

// Anthropic's limits on one request's output schema.
const anthropicUnionTypedLimit = 16;
const anthropicOptionalLimit = 24;

// Keywords a provider rejects or rewrites: Gemini and OpenAI list no oneOf, and Anthropic takes no
// length or number bounds.
const unsupportedKeywords = [
	'oneOf',
	'allOf',
	'not',
	'minLength',
	'maxLength',
	'pattern',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minItems',
	'maxItems',
];

function isNode(value: unknown): value is JsonSchemaNode {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Every schema node, the root included.
function nodes(schema: JsonSchemaNode): JsonSchemaNode[] {
	const children = Object.values(schema).flatMap((value) =>
		(Array.isArray(value) ? value : [value]).filter(isNode)
	);
	return [schema, ...children.flatMap(nodes)];
}

function propertiesOf(node: JsonSchemaNode): JsonSchemaNode {
	return isNode(node.properties) ? node.properties : {};
}

// The JSON Schema the AI SDK sends for an output schema.
async function sentSchema(schema: typeof pageOutputSchema | typeof scanOutputSchema) {
	return (await asSchema(schema).jsonSchema) as JsonSchemaNode;
}

describe.each([
	['scans', scanOutputSchema],
	['pages', pageOutputSchema],
])('the output schema for %s', (_, schema) => {
	it('uses no keyword a provider rejects', async () => {
		const keywords = nodes(await sentSchema(schema)).flatMap(Object.keys);

		expect(keywords.filter((keyword) => unsupportedKeywords.includes(keyword))).toEqual([]);
	});

	it('requires every property and allows no others, as OpenAI strict mode needs', async () => {
		const objects = nodes(await sentSchema(schema)).filter((node) => node.type === 'object');

		expect(objects.length).toBeGreaterThan(0);
		for (const object of objects) {
			expect(object.required).toEqual(Object.keys(propertiesOf(object)));
			expect(object.additionalProperties).toBe(false);
		}
	});

	it("stays within Anthropic's union-typed and optional parameter limits", async () => {
		const all = nodes(await sentSchema(schema));
		const unionTyped = all.filter((node) => 'anyOf' in node || Array.isArray(node.type));
		const optional = all.flatMap((node) =>
			Object.keys(propertiesOf(node)).filter(
				(key) => !(Array.isArray(node.required) && node.required.includes(key))
			)
		);

		expect(unionTyped.length).toBeLessThanOrEqual(anthropicUnionTypedLimit);
		expect(optional.length).toBeLessThanOrEqual(anthropicOptionalLimit);
	});
});

it('asks for the chapter, holidays, and diets by value, each with its label, after the lists', async () => {
	const properties = propertiesOf(await sentSchema(pageOutputSchema));

	expect(Object.keys(properties).slice(-4)).toEqual([
		'chapter',
		'holidays',
		'diets',
		'reviewNotes',
	]);
	expect(properties.chapter).toEqual({
		anyOf: [
			{
				type: 'string',
				enum: [
					'breakfast-brunch',
					'appetizers-beverages',
					'soups-salads',
					'vegetables-sides',
					'main-dishes',
					'breads-rolls',
					'desserts',
					'cookies-candy',
					'this-and-that',
				],
			},
			{ type: 'null' },
		],
		description:
			'The cookbook chapter the recipe goes in: "breakfast-brunch" for Breakfast & Brunch, "appetizers-beverages" for Appetizers & Beverages, "soups-salads" for Soups & Salads, "vegetables-sides" for Vegetables & Side Dishes, "main-dishes" for Main Dishes, "breads-rolls" for Breads & Rolls, "desserts" for Desserts, "cookies-candy" for Cookies & Candy, "this-and-that" for This & That.',
	});
	expect(properties.holidays).toEqual({
		type: 'array',
		items: {
			type: 'string',
			enum: [
				'new-years-day',
				'st-patricks-day',
				'easter',
				'fourth-of-july',
				'halloween',
				'thanksgiving',
				'christmas',
			],
		},
		description:
			'The holidays the source names the recipe for: "new-years-day" for New Year’s Day, "st-patricks-day" for St. Patrick’s Day, "easter" for Easter, "fourth-of-july" for Fourth of July, "halloween" for Halloween, "thanksgiving" for Thanksgiving, "christmas" for Christmas.',
	});
	expect(properties.diets).toEqual({
		type: 'array',
		items: { type: 'string', enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'] },
		description:
			'The diets the source states the recipe suits: "vegetarian" for Vegetarian, "vegan" for Vegan, "gluten-free" for Gluten-free, "dairy-free" for Dairy-free.',
	});
});

it('puts the transcription first, so the model reads the pages before it fills in the fields', async () => {
	const schema = await sentSchema(scanOutputSchema);

	expect(Object.keys(propertiesOf(schema))[0]).toBe('transcription');
});
