import { z } from 'zod';
import type { RecipeFormPayload } from '@/components/recipe-form/recipe-form-fields';
import type { Problem } from '@/domain/problem';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { parseAmountText, parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { parseRecipeContent, type RecipeContentInput } from '@/domain/recipe/recipe';
import { recipeImageRoleSchema } from '@/domain/recipe/recipe-image';

// Maps what the recipe form sends to the recipe service's input. It defines Zod schemas, so only
// Server Actions import it, never the form.

const payloadSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	source: z.string().optional(),
	notes: z.string().optional(),
	yield: z
		.object({
			kind: z.enum(['servings', 'makes']),
			amount: z.string(),
			unit: z.string().optional(),
		})
		.optional(),
	times: z.object({
		prepMinutes: z.string().optional(),
		cookMinutes: z.string().optional(),
		totalMinutes: z.string().optional(),
	}),
	ingredientSections: z.array(
		z.object({ heading: z.string().optional(), lines: z.array(z.string()) })
	),
	instructionSections: z.array(
		z.object({ heading: z.string().optional(), steps: z.array(z.string()) })
	),
	tags: z.array(z.string()),
	images: z.array(
		z.object({
			role: recipeImageRoleSchema,
			pathname: z.string(),
			alt: z.string().optional(),
		})
	),
}) satisfies z.ZodType<RecipeFormPayload>;

// The form always sends this shape, so anything else came from an out-of-date page.
const unreadablePayloadProblem: Problem = {
	path: '',
	message: 'We couldn’t read the recipe. Reload the page and try again.',
};

const unreadableYieldProblem: Problem = {
	path: 'yield.amount',
	message: 'We couldn’t read this amount. Use a number, or two numbers for a range.',
};

function readPayload(json: string): RecipeFormPayload {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		throw new InvalidRecipeError([unreadablePayloadProblem]);
	}
	const result = payloadSchema.safeParse(data);
	if (!result.success) {
		throw new InvalidRecipeError([unreadablePayloadProblem]);
	}
	return result.data;
}

// Blank optional text is omitted, as the domain expects.
function optionalText(text: string | undefined): string | undefined {
	return text === undefined || text.trim() === '' ? undefined : text;
}

// Anything but a number reaches the domain as NaN, which it refuses with its own message.
function minutes(text: string | undefined): number | undefined {
	const value = optionalText(text);
	return value === undefined ? undefined : Number(value.trim());
}

// The rest of the recipe's problems, so one save reports them all.
function contentProblems(content: RecipeContentInput): readonly Problem[] {
	try {
		parseRecipeContent(content);
	} catch (error) {
		if (error instanceof InvalidRecipeError) {
			return error.problems;
		}
		throw error;
	}
	return [];
}

// Throws InvalidRecipeError when the payload is malformed or the yield's amount can't be read. The
// recipe service validates the rest.
export function recipeContentFromForm(json: string): RecipeContentInput {
	const payload = readPayload(json);
	const content: RecipeContentInput = {
		title: payload.title,
		description: optionalText(payload.description),
		source: optionalText(payload.source),
		notes: optionalText(payload.notes),
		times: {
			prepMinutes: minutes(payload.times.prepMinutes),
			cookMinutes: minutes(payload.times.cookMinutes),
			totalMinutes: minutes(payload.times.totalMinutes),
		},
		ingredientSections: payload.ingredientSections.map((section) => ({
			heading: optionalText(section.heading),
			lines: section.lines.map((line) => parseIngredientLine(line)),
		})),
		instructionSections: payload.instructionSections.map((section) => ({
			heading: optionalText(section.heading),
			steps: section.steps.map((text) => ({ text })),
		})),
		tags: payload.tags,
		images: payload.images.map(({ role, pathname, alt }) => ({
			role,
			pathname,
			alt: optionalText(alt),
		})),
	};

	const recipeYield = payload.yield;
	if (recipeYield === undefined || optionalText(recipeYield.amount) === undefined) {
		return content;
	}
	const amount = parseAmountText(recipeYield.amount);
	if (amount === undefined) {
		throw new InvalidRecipeError([unreadableYieldProblem, ...contentProblems(content)]);
	}
	return {
		...content,
		yield:
			recipeYield.kind === 'servings'
				? { kind: 'servings', amount }
				: { kind: 'makes', amount, unit: optionalText(recipeYield.unit) },
	};
}
