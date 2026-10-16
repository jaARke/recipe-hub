import { isDeepStrictEqual } from 'node:util';
import type { RecipeRepository, StoredRecipe } from '@/application/ports/recipe-repository';
import { RecipeEditConflictError, type RecipeNotFoundError } from '@/application/recipes/errors';
import { problemsFromZodError, type Problem } from '@/domain/problem';
import type { Amount } from '@/domain/recipe/amount';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import {
	parseRecipeContent,
	storedRecipeContentSchema,
	type RecipeContent,
	type RecipeId,
} from '@/domain/recipe/recipe';
import { getLogger } from '@/lib/logger';

export type ReparseOptions = {
	// Without it, a dry run: every recipe is read and checked, and none is written.
	write: boolean;
};

// One field of the content that tidying or the parser changes, by its path in the content, such as
// "source" or "ingredientSections.0.lines.2". A line changes whole, since its reading follows its text.
export type ContentChange =
	| { kind: 'text'; path: string; before: string; after: string }
	| { kind: 'line'; path: string; before: IngredientLine; after: IngredientLine };

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
	// Empty for a recipe whose content tidies into content no recipe may hold.
	changes: ContentChange[];
	outcome: ReparseOutcome;
};

export type ReparseResult = {
	write: boolean;
	checked: number;
	// Only the recipes that tidying or the parser now changes, in the order they were read.
	recipes: ReparsedRecipe[];
};

type JsonObject = { readonly [key: string]: unknown };

type PathSegment = string | number;

const logger = getLogger('reparse-ingredients');

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The content as a save would store it now: its text tidied and each line read again from its text.
// Stored limits apply, so a recipe saved before a limit was lowered still tidies.
function tidiedContent(stored: RecipeContent) {
	return storedRecipeContentSchema.safeParse({
		...stored,
		ingredientSections: stored.ingredientSections.map((section) => ({
			...section,
			lines: section.lines.map((line) => parseIngredientLine(line.text)),
		})),
	});
}

// The line a path names, such as "ingredientSections.0.lines.2", or undefined for any other path.
function lineAt(content: RecipeContent, path: readonly PathSegment[]): IngredientLine | undefined {
	const [list, section, lines, line, ...rest] = path;
	if (list !== 'ingredientSections' || lines !== 'lines' || rest.length > 0) {
		return undefined;
	}
	return typeof section === 'number' && typeof line === 'number'
		? content.ingredientSections[section]?.lines[line]
		: undefined;
}

// Every text and line in the tidied content that differs from what is stored, in the content's order.
function collectChanges(
	contents: { stored: RecipeContent; tidied: RecipeContent },
	storedValue: unknown,
	tidiedValue: unknown,
	path: readonly PathSegment[],
	changes: ContentChange[]
): void {
	const after = lineAt(contents.tidied, path);
	if (after !== undefined) {
		const before = lineAt(contents.stored, path);
		if (before !== undefined && !isDeepStrictEqual(before, after)) {
			changes.push({ kind: 'line', path: path.join('.'), before, after });
		}
		return;
	}

	if (typeof tidiedValue === 'string') {
		if (typeof storedValue === 'string' && storedValue !== tidiedValue) {
			changes.push({ kind: 'text', path: path.join('.'), before: storedValue, after: tidiedValue });
		}
		return;
	}

	const children: [PathSegment, unknown][] = Array.isArray(tidiedValue)
		? tidiedValue.map((child, index) => [index, child])
		: isObject(tidiedValue)
			? Object.entries(tidiedValue)
			: [];
	for (const [segment, child] of children) {
		const storedChild = Array.isArray(storedValue)
			? storedValue[Number(segment)]
			: isObject(storedValue)
				? storedValue[segment]
				: undefined;
		collectChanges(contents, storedChild, child, [...path, segment], changes);
	}
}

function contentChanges(stored: RecipeContent, tidied: RecipeContent): ContentChange[] {
	const changes: ContentChange[] = [];
	collectChanges({ stored, tidied }, stored, tidied, [], changes);
	return changes;
}

// Checked as any save is, and written through the repository's update, which versions the recipe and
// refuses it when someone saved it after it was read.
async function checkAndWrite(
	recipes: RecipeRepository,
	{ recipe }: StoredRecipe,
	tidied: RecipeContent,
	options: ReparseOptions
): Promise<ReparseOutcome> {
	let content: RecipeContent;
	try {
		content = parseRecipeContent(tidied);
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

// What tidying and reading the recipe's lines again change, and what came of saving that, or null
// when nothing changes.
async function reparseRecipe(
	recipes: RecipeRepository,
	stored: StoredRecipe,
	options: ReparseOptions
): Promise<Pick<ReparsedRecipe, 'changes' | 'outcome'> | null> {
	const tidied = tidiedContent(stored.storedContent);
	if (!tidied.success) {
		const problems = problemsFromZodError(tidied.error);
		return { changes: [], outcome: { kind: 'skipped', code: 'recipe.invalid', problems } };
	}

	const changes = contentChanges(stored.storedContent, tidied.data);
	if (changes.length === 0) {
		return null;
	}
	return { changes, outcome: await checkAndWrite(recipes, stored, tidied.data, options) };
}

function logOutcome(recipe: ReparsedRecipe): void {
	const { outcome } = recipe;
	switch (outcome.kind) {
		case 'pending':
			return;
		case 'written':
			logger.info('Recipe re-parsed', {
				recipeId: recipe.id,
				fieldsChanged: recipe.changes.length,
			});
			return;
		case 'skipped':
			logger.warn('Recipe re-parse skipped', {
				recipeId: recipe.id,
				code: outcome.code,
				...('problems' in outcome && { problems: outcome.problems }),
			});
			return;
	}
}

function countOf(result: ReparseResult, kind: ReparseOutcome['kind']): number {
	return result.recipes.filter((recipe) => recipe.outcome.kind === kind).length;
}

// Tidies every saved recipe's text and reads its ingredient lines again with the current parser, and
// with options.write saves each recipe that changes. Recipes are compared as saved, since reading
// tidies their text. A recipe that cannot be saved is skipped with its reason, and the run carries
// on. A second run finds nothing to change.
export async function reparseIngredients(
	recipes: RecipeRepository,
	options: ReparseOptions
): Promise<ReparseResult> {
	const result: ReparseResult = { write: options.write, checked: 0, recipes: [] };
	// Each recipe is read again just before it is checked, so a member's edit since the snapshot is
	// re-parsed too. One deleted since then needs nothing; one added since was tidied when it was saved.
	for (const id of await recipes.listIds()) {
		const stored = await recipes.findStoredById(id);
		if (stored === null) {
			continue;
		}

		result.checked += 1;
		const reparse = await reparseRecipe(recipes, stored, options);
		if (reparse === null) {
			continue;
		}

		const { recipe } = stored;
		const reparsed: ReparsedRecipe = {
			id: recipe.id,
			slug: recipe.slug,
			title: recipe.title,
			...reparse,
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

// Quoted as JSON, with the spaces tidying collapses that would otherwise look like plain ones escaped.
function quoted(text: string): string {
	return JSON.stringify(text).replace(
		/[^\S\n\r\t ]/gu,
		(character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
	);
}

function plural(count: number, noun: string): string {
	return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function amountText(amount: Amount): string {
	return amount.max === undefined ? String(amount.min) : `${amount.min} to ${amount.max}`;
}

// A line's reading, field by field, with its text first where it differs from the text shown above.
function readingText(line: IngredientLine, shownText: string): string {
	return [
		line.text === shownText ? undefined : `text ${quoted(line.text)}`,
		line.amount === undefined ? undefined : `amount ${amountText(line.amount)}`,
		line.unit === undefined ? undefined : `unit ${quoted(line.unit)}`,
		`item ${quoted(line.item)}`,
		line.preparation === undefined ? undefined : `preparation ${quoted(line.preparation)}`,
	]
		.filter((part) => part !== undefined)
		.join(', ');
}

// Each change under its path and the text as saved: a text's tidied form, or a line's reading before
// and after.
function changeText(change: ContentChange): string[] {
	switch (change.kind) {
		case 'text':
			return [`  ${change.path}: ${quoted(change.before)}`, `  + ${quoted(change.after)}`];
		case 'line':
			return [
				`  ${change.path}: ${quoted(change.before.text)}`,
				`  - ${readingText(change.before, change.before.text)}`,
				`  + ${readingText(change.after, change.before.text)}`,
			];
	}
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
		...recipe.changes.flatMap(changeText),
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
					'Search reads the new text already, but cached recipe pages show the old until this environment is redeployed: redeploy it now.',
				]
			: []),
		...(skipped > 0
			? [
					'A skipped recipe keeps its old text and readings until it is fixed and saved in the recipe form, which tidies it and reads its lines again; one edited or deleted during the run is read again by the next run.',
				]
			: []),
	];
}

// What a person reviews: each changed field before and after, each recipe's outcome, and what to do
// next.
export function reparseReport(result: ReparseResult): string {
	const summary = `Checked ${plural(result.checked, 'recipe')}; ${plural(result.recipes.length, 'recipe')} that tidying or the parser now changes.`;
	if (result.recipes.length === 0) {
		return [summary, 'Nothing to change.'].join('\n\n');
	}

	return [summary, ...result.recipes.map(recipeText), ...closingText(result)].join('\n\n');
}
