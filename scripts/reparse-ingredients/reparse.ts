import { isDeepStrictEqual } from 'node:util';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import { RecipeEditConflictError, type RecipeNotFoundError } from '@/application/recipes/errors';
import type { Problem } from '@/domain/problem';
import type { Amount } from '@/domain/recipe/amount';
import { storedContent } from '@/domain/recipe/content-limits';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import {
	ingredientLineSchemaFor,
	type IngredientLine,
	type IngredientSection,
} from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import {
	parseRecipeContent,
	type Recipe,
	type RecipeContent,
	type RecipeId,
} from '@/domain/recipe/recipe';
import { getLogger } from '@/lib/logger';

// Normalizes a fresh reading as storing it would, so a line stored from the same reading equals it.
const storedLineSchema = ingredientLineSchemaFor(storedContent);

export type ReparseOptions = {
	// Without it, a dry run: every recipe is read and checked, and none is written.
	write: boolean;
};

export type LineChange = {
	// Counted from 0, as the content stores sections and lines.
	section: number;
	line: number;
	before: IngredientLine;
	after: IngredientLine;
};

export type ReparseOutcome =
	// Changed and valid, and left as it is by a dry run.
	| { kind: 'pending' }
	| { kind: 'written' }
	| { kind: 'skipped'; code: InvalidRecipeError['code']; problems: readonly Problem[] }
	// Edited or deleted after it was read; the next run reads it again.
	| { kind: 'skipped'; code: RecipeEditConflictError['code'] | RecipeNotFoundError['code'] };

export type ReparsedRecipe = {
	id: RecipeId;
	slug: string;
	title: string;
	changes: LineChange[];
	outcome: ReparseOutcome;
};

export type ReparseResult = {
	write: boolean;
	checked: number;
	// Only the recipes with a line the parser now reads differently, in the order they were read.
	recipes: ReparsedRecipe[];
};

const logger = getLogger('reparse-ingredients');

// Each section with its lines read again from their text, and the lines that read differently.
function reparseSections(recipe: Recipe): {
	ingredientSections: IngredientSection[];
	changes: LineChange[];
} {
	const changes: LineChange[] = [];
	const ingredientSections = recipe.ingredientSections.map((section, sectionIndex) => ({
		...section,
		lines: section.lines.map((before, lineIndex) => {
			const after = storedLineSchema.parse(parseIngredientLine(before.text));
			if (!isDeepStrictEqual(before, after)) {
				changes.push({ section: sectionIndex, line: lineIndex, before, after });
			}
			return after;
		}),
	}));
	return { ingredientSections, changes };
}

// Checked as any save is, and written through the repository's update, which versions the recipe and
// refuses it when someone saved it after it was read.
async function checkAndWrite(
	recipes: RecipeRepository,
	recipe: Recipe,
	ingredientSections: IngredientSection[],
	options: ReparseOptions
): Promise<ReparseOutcome> {
	let content: RecipeContent;
	try {
		// The content schema drops the recipe's other fields, such as its id and slug.
		content = parseRecipeContent({ ...recipe, ingredientSections });
	} catch (error) {
		if (error instanceof InvalidRecipeError) {
			return { kind: 'skipped', code: error.code, problems: error.problems };
		}
		throw error;
	}

	if (!options.write) {
		return { kind: 'pending' };
	}

	try {
		const updated = await recipes.update(recipe.id, {
			content,
			expectedUpdatedAt: recipe.updatedAt,
		});
		return updated === null ? { kind: 'skipped', code: 'recipe.not-found' } : { kind: 'written' };
	} catch (error) {
		if (error instanceof RecipeEditConflictError) {
			return { kind: 'skipped', code: error.code };
		}
		throw error;
	}
}

function logOutcome(recipe: ReparsedRecipe): void {
	const { outcome } = recipe;
	switch (outcome.kind) {
		case 'pending':
			return;
		case 'written':
			logger.info('Recipe ingredients re-parsed', {
				recipeId: recipe.id,
				linesChanged: recipe.changes.length,
			});
			return;
		case 'skipped':
			logger.warn('Recipe ingredient re-parse skipped', {
				recipeId: recipe.id,
				code: outcome.code,
				...('problems' in outcome && { problems: outcome.problems }),
			});
			return;
	}
}

// Every recipe's id as one listing finds them, asked for more recipes than exist, so a recipe added or
// deleted while the run goes on cannot shift another out of the run, as it would between pages.
async function snapshotIds(recipes: RecipeRepository): Promise<RecipeId[]> {
	for (let limit = (await recipes.count()) + 1; ; limit *= 2) {
		const listed = await recipes.list({ limit, offset: 0, sort: 'newest' });
		if (listed.length < limit) {
			return listed.map(({ id }) => id);
		}
	}
}

function countOf(result: ReparseResult, kind: ReparseOutcome['kind']): number {
	return result.recipes.filter((recipe) => recipe.outcome.kind === kind).length;
}

// Reads every saved ingredient line again with the current parser, and with options.write saves each
// recipe whose lines read differently. A recipe that cannot be saved is skipped with its reason, and
// the run carries on. A second run finds nothing to change.
export async function reparseIngredients(
	recipes: RecipeRepository,
	options: ReparseOptions
): Promise<ReparseResult> {
	const result: ReparseResult = { write: options.write, checked: 0, recipes: [] };
	// Each recipe is read again just before it is checked, so a member's edit since the snapshot is
	// re-parsed too. One deleted since then needs nothing; one added since was parsed when it was saved.
	for (const id of await snapshotIds(recipes)) {
		const recipe = await recipes.findById(id);
		if (recipe === null) {
			continue;
		}

		result.checked += 1;
		const { ingredientSections, changes } = reparseSections(recipe);
		if (changes.length === 0) {
			continue;
		}

		const reparsed: ReparsedRecipe = {
			id: recipe.id,
			slug: recipe.slug,
			title: recipe.title,
			changes,
			outcome: await checkAndWrite(recipes, recipe, ingredientSections, options),
		};
		logOutcome(reparsed);
		result.recipes.push(reparsed);
	}

	logger.info('Ingredient re-parse finished', {
		write: result.write,
		recipesChecked: result.checked,
		recipesChanged: result.recipes.length,
		recipesWritten: countOf(result, 'written'),
		recipesSkipped: countOf(result, 'skipped'),
	});
	return result;
}

function quoted(text: string): string {
	return JSON.stringify(text);
}

function plural(count: number, noun: string): string {
	return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function amountText(amount: Amount): string {
	return amount.max === undefined ? String(amount.min) : `${amount.min} to ${amount.max}`;
}

// A line's reading, field by field, with its text left out, since a re-parse never changes it.
function readingText(line: IngredientLine): string {
	return [
		line.amount === undefined ? undefined : `amount ${amountText(line.amount)}`,
		line.unit === undefined ? undefined : `unit ${quoted(line.unit)}`,
		`item ${quoted(line.item)}`,
		line.preparation === undefined ? undefined : `preparation ${quoted(line.preparation)}`,
	]
		.filter((part) => part !== undefined)
		.join(', ');
}

function outcomeText(outcome: ReparseOutcome): string {
	switch (outcome.kind) {
		case 'pending':
			return 'to write';
		case 'written':
			return 'written';
		case 'skipped':
			switch (outcome.code) {
				case 'recipe.invalid':
					return `skipped, ${outcome.code}: ${outcome.problems
						.map(({ path, message }) => (path === '' ? message : `${path}: ${message}`))
						.join('; ')}`;
				case 'recipe.edit-conflict':
					return `skipped, ${outcome.code}: edited during the run`;
				case 'recipe.not-found':
					return `skipped, ${outcome.code}: deleted during the run`;
			}
	}
}

function recipeText(recipe: ReparsedRecipe): string {
	return [
		`${recipe.slug} (${recipe.title}): ${outcomeText(recipe.outcome)}`,
		...recipe.changes.flatMap(({ section, line, before, after }) => [
			`  Section ${section + 1}, line ${line + 1}: ${quoted(before.text)}`,
			`  - ${readingText(before)}`,
			`  + ${readingText(after)}`,
		]),
	].join('\n');
}

function closingText(result: ReparseResult): string[] {
	const pending = countOf(result, 'pending');
	const written = countOf(result, 'written');
	const skipped = countOf(result, 'skipped');
	if (!result.write) {
		return [
			`Dry run: nothing was written. With --write, this run would write ${plural(pending, 'recipe')} and skip ${skipped}.`,
		];
	}

	return [
		`Wrote ${plural(written, 'recipe')} and skipped ${skipped}.`,
		...(written > 0
			? [
					'Search reads the new lines already, but cached recipe pages show the old ones until this environment is redeployed: redeploy it now.',
				]
			: []),
		...(skipped > 0
			? [
					'A skipped recipe keeps its old reading until it is fixed and saved in the recipe form, which reads its lines again; one edited or deleted during the run is read again by the next run.',
				]
			: []),
	];
}

// What a person reviews: each changed line's reading before and after, each recipe's outcome, and
// what to do next.
export function reparseReport(result: ReparseResult): string {
	const summary = `Checked ${plural(result.checked, 'recipe')}; ${plural(result.recipes.length, 'recipe')} with lines the parser now reads differently.`;
	if (result.recipes.length === 0) {
		return [summary, 'Nothing to change.'].join('\n\n');
	}

	return [summary, ...result.recipes.map(recipeText), ...closingText(result)].join('\n\n');
}
