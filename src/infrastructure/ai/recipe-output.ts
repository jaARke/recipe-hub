import 'server-only';
import { z } from 'zod';
import { chapterLabels, chapters } from '@/domain/recipe/chapter';
import { dietLabels, diets } from '@/domain/recipe/diet';
import { reviewNoteFields, type ExtractedRecipe } from '@/domain/recipe/extracted-recipe';
import { holidayLabels, holidays } from '@/domain/recipe/holiday';
import { exampleIngredientLine } from '@/domain/recipe/ingredient-parser';
import { transcriptionMarkers } from '@/domain/recipe/transcription-markers';

// Each choice's value with the label a member reads it by, such as "desserts" for Desserts.
function choiceList<Choice extends string>(
	choices: readonly Choice[],
	labels: Record<Choice, string>
): string {
	return choices.map((choice) => `"${choice}" for ${labels[choice]}`).join(', ');
}

// What the model returns, kept apart from the domain's draft so every provider's structured output
// accepts it: every key is required with null for absent (OpenAI's strict mode), no oneOf (Gemini),
// no length or number bounds, and 14 nullable fields where Anthropic allows 16 union-typed ones.
const recipeFields = {
	title: z
		.string()
		.nullable()
		.describe('The title in sentence case, where names keep their capitals.'),
	description: z
		.string()
		.nullable()
		.describe('A short summary of the dish as the source gives it.'),
	notes: z
		.string()
		.nullable()
		.describe("The cook's notes, tips, or story about the recipe, in the source's words."),
	source: z
		.string()
		.nullable()
		.describe('Who or where the recipe comes from, as the source names it.'),
	yield: z
		.object({
			kind: z.enum(['servings', 'makes']),
			amount: z.string().describe('The amount in numerals, such as "4 to 6" or "2 1/2".'),
			unit: z
				.string()
				.nullable()
				.describe('What the recipe makes, such as "biscuits"; null for servings.'),
		})
		.nullable(),
	prepMinutes: z.number().nullable().describe('The stated prep time in whole minutes.'),
	cookMinutes: z.number().nullable().describe('The stated cook time in whole minutes.'),
	totalMinutes: z.number().nullable().describe('The stated total time in whole minutes.'),
	ingredientSections: z.array(
		z.object({
			heading: z
				.string()
				.nullable()
				.describe('The section heading in sentence case, such as "For the glaze".'),
			lines: z
				.array(z.string())
				.describe(
					`One ingredient per entry in the shape "${exampleIngredientLine}" shows, with only the words the source gives it.`
				),
		})
	),
	instructionSections: z.array(
		z.object({
			heading: z
				.string()
				.nullable()
				.describe('The section heading in sentence case, such as "For the glaze".'),
			steps: z.array(z.string()).describe('The steps in order, each written as sentences.'),
		})
	),
	// After the lists, so the model has written the recipe out before it files it.
	chapter: z
		.enum(chapters)
		.nullable()
		.describe(`The cookbook chapter the recipe goes in: ${choiceList(chapters, chapterLabels)}.`),
	holidays: z
		.array(z.enum(holidays))
		.describe(
			`The holidays the source names the recipe for: ${choiceList(holidays, holidayLabels)}.`
		),
	diets: z
		.array(z.enum(diets))
		.describe(`The diets the source states the recipe suits: ${choiceList(diets, dietLabels)}.`),
	reviewNotes: z
		.array(
			z.object({
				field: z.enum(reviewNoteFields),
				section: z
					.number()
					.nullable()
					.describe(
						'Zero-based section of the ingredient or step, 0 when there is only one. Given whenever line is.'
					),
				line: z.number().nullable().describe('Zero-based ingredient or step within its section.'),
				note: z.string().describe('One or two short sentences to the person reviewing the draft.'),
			})
		)
		.describe('What the person reviewing the draft should check against the original.'),
};

export const pageOutputSchema = z.object(recipeFields);

// The transcription comes first, so the model has read every page before it fills in the fields.
export const scanOutputSchema = z.object({
	transcription: z
		.string()
		.describe(
			`Every word on the pages in reading order, exactly as written, with ${transcriptionMarkers.illegible} and ${transcriptionMarkers.unsure} markers.`
		),
	...recipeFields,
});

export type RecipeOutput = z.infer<typeof pageOutputSchema>;

type ReviewNoteOutput = RecipeOutput['reviewNotes'][number];

function sectionCount(field: ReviewNoteOutput['field'], output: RecipeOutput): number | undefined {
	switch (field) {
		case 'ingredient':
			return output.ingredientSections.length;
		case 'step':
			return output.instructionSections.length;
		default:
			return undefined;
	}
}

// A note with a line but no section would point at the whole list, so a recipe with one section of
// that kind gets it; any other recipe keeps the note as given.
function reviewNoteSection(note: ReviewNoteOutput, output: RecipeOutput): number | null {
	if (note.section !== null || note.line === null) {
		return note.section;
	}
	return sectionCount(note.field, output) === 1 ? 0 : null;
}

// Text passes through as written; a null field is one the source does not state, which the extracted
// recipe leaves out. A model that found no recipe answers with empty lists, which pass through too.
export function toExtractedRecipe(output: RecipeOutput): ExtractedRecipe {
	return {
		...(output.title !== null && { title: output.title }),
		...(output.description !== null && { description: output.description }),
		...(output.notes !== null && { notes: output.notes }),
		...(output.source !== null && { source: output.source }),
		...(output.yield !== null && {
			yield: {
				kind: output.yield.kind,
				amount: output.yield.amount,
				...(output.yield.unit !== null && { unit: output.yield.unit }),
			},
		}),
		times: {
			...(output.prepMinutes !== null && { prepMinutes: output.prepMinutes }),
			...(output.cookMinutes !== null && { cookMinutes: output.cookMinutes }),
			...(output.totalMinutes !== null && { totalMinutes: output.totalMinutes }),
		},
		ingredientSections: output.ingredientSections.map(({ heading, lines }) => ({
			...(heading !== null && { heading }),
			lines,
		})),
		instructionSections: output.instructionSections.map(({ heading, steps }) => ({
			...(heading !== null && { heading }),
			steps,
		})),
		...(output.chapter !== null && { chapter: output.chapter }),
		holidays: output.holidays,
		diets: output.diets,
		reviewNotes: output.reviewNotes.map((reviewNote) => {
			const section = reviewNoteSection(reviewNote, output);
			return {
				field: reviewNote.field,
				...(section !== null && { section }),
				...(reviewNote.line !== null && { line: reviewNote.line }),
				note: reviewNote.note,
			};
		}),
	};
}
