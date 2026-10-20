import type { z } from 'zod';
import type { Problem } from '@/domain/problem';
import { approximationWord } from '@/domain/recipe/amount-words';
import { noChapterMessage, type Chapter } from '@/domain/recipe/chapter';
import { dietLabels, withImpliedDiets, withoutImpliedDiets, type Diet } from '@/domain/recipe/diet';
import { durationMinutesSchema, type RecipeTimes } from '@/domain/recipe/duration';
import { holidayLabels, inHolidayOrder, type Holiday } from '@/domain/recipe/holiday';
import { normalizeIngredientLine, parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { withoutListMarkers } from '@/domain/recipe/list-markers';
import { titleTextSchema } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import type { ImportDraft } from '@/domain/recipe/recipe-import';
import {
	readYieldAmount,
	yieldUnitTextSchema,
	type RecipeYield,
} from '@/domain/recipe/recipe-yield';
import { andList, plainTextSchema, sectionHeadingTextSchema } from '@/domain/text';
import { settings } from '@/lib/settings';

// A recipe as an extractor read it, before validation: text as written, ingredient lines unparsed.
// Every entry mode's extractor produces this shape, and one domain function turns it into a draft.
export type ExtractedRecipe = {
	title?: string;
	description?: string;
	// The story behind the recipe, or the cook's notes on the page or card.
	notes?: string;
	// Who or where the recipe comes from, as the page or card names it.
	source?: string;
	yield?: ExtractedYield;
	times: ExtractedTimes;
	ingredientSections: ExtractedIngredientSection[];
	instructionSections: ExtractedInstructionSection[];
	// The chapter the extractor files the recipe in, when it can name one.
	chapter?: Chapter;
	// Only the holidays the source names and the diets it states, never ones worked out from the recipe.
	holidays: Holiday[];
	diets: Diet[];
	reviewNotes: ReviewNote[];
};

export type ExtractedYield = {
	kind: 'servings' | 'makes';
	// As written, such as "4 to 6" or "2 1/2", read like the form's yield field.
	amount: string;
	unit?: string;
};

export type ExtractedTimes = {
	prepMinutes?: number;
	cookMinutes?: number;
	totalMinutes?: number;
};

export type ExtractedIngredientSection = {
	heading?: string;
	// One ingredient per line, as written.
	lines: string[];
};

export type ExtractedInstructionSection = {
	heading?: string;
	steps: string[];
};

export const reviewNoteFields = [
	'recipe',
	'title',
	'description',
	'source',
	'yield',
	'times',
	'ingredient',
	'step',
	'notes',
	'chapter',
	'holidays',
	'diets',
] as const;
export type ReviewNoteField = (typeof reviewNoteFields)[number];

// Something the reviewer should check. Section and line are zero-based and point at an ingredient or
// step; a note on the whole recipe, such as a second recipe left out, uses the field 'recipe'.
export type ReviewNote = {
	field: ReviewNoteField;
	section?: number;
	line?: number;
	note: string;
};

type DraftListName = 'ingredientSections' | 'instructionSections';

// A section of ingredient lines or steps, as text.
type ListSection = {
	heading?: string;
	texts: readonly string[];
};

// Where an extracted section landed in the draft, and where each of its items did; undefined where
// one was dropped.
type SectionPlace = {
	index: number;
	itemIndexes: readonly (number | undefined)[];
};

// A list without blank items or sections left empty, and where each extracted section went.
type KeptList = {
	name: DraftListName;
	sections: readonly ListSection[];
	places: readonly (SectionPlace | undefined)[];
};

// Where a review note lands, and whether that is what it points at rather than the section or list
// around something that was dropped.
type NotePlace = {
	path: string;
	exact: boolean;
};

// Each list's items, under the name the recipe content gives them.
const itemKeys = {
	ingredientSections: 'lines',
	instructionSections: 'steps',
} as const satisfies Record<DraftListName, string>;

const timeFields = [
	'prepMinutes',
	'cookMinutes',
	'totalMinutes',
] as const satisfies readonly (keyof RecipeTimes)[];

// Where notes on fields other than ingredients and steps show. A note on the times as a whole sits
// with the total, the time cards show and search filters by.
const reviewNotePaths = {
	recipe: '',
	title: 'title',
	description: 'description',
	source: 'source',
	yield: 'yield',
	times: 'times.totalMinutes',
	notes: 'notes',
	chapter: 'chapter',
	holidays: 'holidays',
	diets: 'diets',
} as const satisfies Record<Exclude<ReviewNoteField, 'ingredient' | 'step'>, string>;

const missingTitleProblem: Problem = {
	path: 'title',
	message: 'Add a title. The original doesn’t show one.',
};

const missingIngredientsProblem: Problem = {
	path: 'ingredientSections',
	message: 'Add the ingredients. The original doesn’t show any.',
};

const missingStepsProblem: Problem = {
	path: 'instructionSections',
	message: 'Add the steps. The original doesn’t show any.',
};

const missingChapterProblem: Problem = { path: 'chapter', message: noChapterMessage };

const chosenChapterProblem: Problem = {
	path: 'chapter',
	message: 'Check the chapter. It was chosen for you.',
};

// The second half of a character written as two UTF-16 code units, such as an emoji.
const lowSurrogate = /[\uDC00-\uDFFF]/;

// Text as the domain stores it in a field of the given kind, or undefined when nothing is left of it.
function storedText(
	text: string | undefined,
	schema: z.ZodString = plainTextSchema
): string | undefined {
	if (text === undefined) {
		return undefined;
	}
	const result = schema.safeParse(text);
	return result.success ? result.data : undefined;
}

// Each item is tidied as the list stores it first, so one that is only a bullet or a number drops.
function keptList(
	name: DraftListName,
	extracted: readonly ListSection[],
	tidy: (item: string) => string
): KeptList {
	const sections: ListSection[] = [];
	const places = extracted.map((section): SectionPlace | undefined => {
		const texts: string[] = [];
		const itemIndexes = section.texts.map((item) => {
			const text = storedText(tidy(item));
			if (text === undefined) {
				return undefined;
			}
			texts.push(text);
			return texts.length - 1;
		});
		if (texts.length === 0) {
			return undefined;
		}
		sections.push({ heading: storedText(section.heading, sectionHeadingTextSchema), texts });
		return { index: sections.length - 1, itemIndexes };
	});
	return { name, sections, places };
}

function itemPath(list: DraftListName, sectionIndex: number, itemIndex: number): string {
	return `${list}.${sectionIndex}.${itemKeys[list]}.${itemIndex}`;
}

// A kept section's heading, fitted to its limit.
function draftHeading(
	list: DraftListName,
	sectionIndex: number,
	heading: string | undefined,
	problems: Problem[]
): string | undefined {
	const max = settings.recipeLimits.maxSectionHeadingLength;
	const path = `${list}.${sectionIndex}.heading`;
	return heading === undefined ? undefined : fittedText(heading, max, path, problems);
}

// The item a note points at, or the section or list around it when that was dropped or is missing.
function listNotePlace(list: KeptList, section?: number, item?: number): NotePlace {
	const place = section === undefined ? undefined : list.places[section];
	if (place === undefined) {
		return { path: list.name, exact: section === undefined && item === undefined };
	}
	const itemIndex = item === undefined ? undefined : place.itemIndexes[item];
	if (itemIndex === undefined) {
		return { path: `${list.name}.${place.index}`, exact: item === undefined };
	}
	return { path: itemPath(list.name, place.index, itemIndex), exact: true };
}

function notePlace(note: ReviewNote, ingredients: KeptList, instructions: KeptList): NotePlace {
	switch (note.field) {
		case 'ingredient':
			return listNotePlace(ingredients, note.section, note.line);
		case 'step':
			return listNotePlace(instructions, note.section, note.line);
		default:
			return { path: reviewNotePaths[note.field], exact: true };
	}
}

// Text past its field's limit keeps as much of its start as the field holds, never splitting a
// character in two, with a note to check it. The member finishes it rather than retyping it, and the
// draft reaches review rather than failing its save.
function fittedText(text: string, max: number, path: string, problems: Problem[]): string {
	if (text.length <= max) {
		return text;
	}
	problems.push({
		path,
		message: `Check this against the original. It was cut to ${max} characters, the most it can hold.`,
	});
	const end = lowSurrogate.test(text.charAt(max)) ? max - 1 : max;
	return text.slice(0, end).trimEnd();
}

// Text as the draft keeps it, fitted to its field's limit, or undefined when nothing is left of it.
function draftText(
	text: string | undefined,
	max: number,
	path: string,
	problems: Problem[],
	schema?: z.ZodString
): string | undefined {
	const stored = storedText(text, schema);
	return stored === undefined ? undefined : fittedText(stored, max, path, problems);
}

// Read like the form's yield field. An approximate amount keeps its number, and one that isn't a
// number is left to the member, each with what the original said.
function draftYield(
	extracted: ExtractedYield | undefined,
	problems: Problem[]
): RecipeYield | undefined {
	const amountText = storedText(extracted?.amount);
	if (extracted === undefined || amountText === undefined) {
		return undefined;
	}
	const writtenUnit =
		extracted.kind === 'makes' ? storedText(extracted.unit, yieldUnitTextSchema) : undefined;
	const original = writtenUnit === undefined ? amountText : `${amountText} ${writtenUnit}`;
	const exactAmount = readYieldAmount(amountText);
	const amount = exactAmount ?? readYieldAmount(amountText.replace(approximationWord, ''));
	if (amount === undefined) {
		problems.push({
			path: 'yield.amount',
			message: `The original says “${original}”. Use a number, or two numbers for a range.`,
		});
		return undefined;
	}
	if (exactAmount === undefined) {
		problems.push({
			path: 'yield.amount',
			message: `The original says “${original}”. Check the yield.`,
		});
	}
	if (extracted.kind === 'servings') {
		return { kind: 'servings', amount };
	}
	const unit =
		writtenUnit === undefined
			? undefined
			: fittedText(writtenUnit, settings.recipeLimits.maxYieldUnitLength, 'yield.unit', problems);
	return { kind: 'makes', amount, unit };
}

// Minutes the domain refuses, such as 7.5, are left to the member, with what the original said.
function draftTimes(extracted: ExtractedTimes, problems: Problem[]): RecipeTimes {
	const times: RecipeTimes = {};
	for (const field of timeFields) {
		const minutes = extracted[field];
		if (minutes === undefined) {
			continue;
		}
		const result = durationMinutesSchema.safeParse(minutes);
		if (result.success) {
			times[field] = result.data;
			continue;
		}
		const fix = result.error.issues.map((issue) => issue.message).join(' ');
		problems.push({
			path: `times.${field}`,
			// NaN or Infinity says nothing a member could check.
			message: Number.isFinite(minutes) ? `The original says ${minutes} minutes. ${fix}` : fix,
		});
	}
	return times;
}

// Each choice an import files the recipe under is a note for the member to check. The diet's note asks
// the most care, since a wrong gluten-free claim can hurt someone, and names only the diets stated, not
// those they imply.
function filingProblems(
	chapter: Chapter | undefined,
	holidays: readonly Holiday[],
	diets: readonly Diet[]
): Problem[] {
	const problems = [chapter === undefined ? missingChapterProblem : chosenChapterProblem];
	if (holidays.length > 0) {
		const named = andList(holidays.map((holiday) => holidayLabels[holiday]));
		problems.push({
			path: 'holidays',
			message: `Check the holidays. The original mentions ${named}.`,
		});
	}
	const stated = withoutImpliedDiets(diets);
	if (stated.length > 0) {
		const named = andList(stated.map((diet) => dietLabels[diet].toLowerCase()));
		problems.push({
			path: 'diets',
			message: `Check the diet. Keep ${named} only if the original says so.`,
		});
	}
	return problems;
}

function withoutRepeats(problems: readonly Problem[]): Problem[] {
	const seen = new Set<string>();
	return problems.filter(({ path, message }) => {
		const key = JSON.stringify([path, message]);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

// The draft a member reviews in the recipe form, which joins the problems for each field in order.
// So what the draft could not keep as read comes first, then the extractor's notes, then what the
// recipe lacks and what the import filed it under, and last the notes whose item was dropped and now
// sit on its section or list.
// The images are the scans the recipe was read from, which stay attached to it.
export function importDraftFromExtractedRecipe(
	recipe: ExtractedRecipe,
	images: readonly RecipeImage[]
): ImportDraft {
	const lossProblems: Problem[] = [];
	const ingredientList = keptList(
		'ingredientSections',
		recipe.ingredientSections.map(({ heading, lines }) => ({ heading, texts: lines })),
		normalizeIngredientLine
	);
	const instructionList = keptList(
		'instructionSections',
		recipe.instructionSections.map(({ heading, steps }) => ({ heading, texts: steps })),
		withoutListMarkers
	);
	const holidays = inHolidayOrder(recipe.holidays);
	const diets = withImpliedDiets(recipe.diets);
	const content: RecipeDraftContent = {
		title: draftText(
			recipe.title,
			settings.recipeLimits.maxTitleLength,
			'title',
			lossProblems,
			titleTextSchema
		),
		description: draftText(
			recipe.description,
			settings.recipeLimits.maxDescriptionLength,
			'description',
			lossProblems
		),
		notes: draftText(recipe.notes, settings.recipeLimits.maxNotesLength, 'notes', lossProblems),
		source: draftText(recipe.source, settings.recipeLimits.maxSourceLength, 'source', lossProblems),
		yield: draftYield(recipe.yield, lossProblems),
		times: draftTimes(recipe.times, lossProblems),
		ingredientSections: ingredientList.sections.map((section, sectionIndex) => ({
			heading: draftHeading('ingredientSections', sectionIndex, section.heading, lossProblems),
			lines: section.texts.map((text, lineIndex) =>
				parseIngredientLine(
					fittedText(
						text,
						settings.recipeLimits.maxIngredientLineLength,
						itemPath('ingredientSections', sectionIndex, lineIndex),
						lossProblems
					)
				)
			),
		})),
		instructionSections: instructionList.sections.map((section, sectionIndex) => ({
			heading: draftHeading('instructionSections', sectionIndex, section.heading, lossProblems),
			steps: section.texts.map((text, stepIndex) => ({
				text: fittedText(
					text,
					settings.recipeLimits.maxStepLength,
					itemPath('instructionSections', sectionIndex, stepIndex),
					lossProblems
				),
			})),
		})),
		chapter: recipe.chapter,
		holidays,
		diets,
		images: [...images],
	};

	const exactNotes: Problem[] = [];
	const enclosingNotes: Problem[] = [];
	for (const note of recipe.reviewNotes) {
		const message = storedText(note.note);
		if (message === undefined) {
			continue;
		}
		const { path, exact } = notePlace(note, ingredientList, instructionList);
		if (exact) {
			exactNotes.push({ path, message });
		} else {
			enclosingNotes.push({ path, message });
		}
	}

	return {
		content,
		problems: withoutRepeats([
			...lossProblems,
			...exactNotes,
			...(content.title === undefined ? [missingTitleProblem] : []),
			...(ingredientList.sections.length === 0 ? [missingIngredientsProblem] : []),
			...(instructionList.sections.length === 0 ? [missingStepsProblem] : []),
			...filingProblems(recipe.chapter, holidays, diets),
			...enclosingNotes,
		]),
	};
}
