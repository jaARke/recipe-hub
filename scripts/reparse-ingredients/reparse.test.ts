import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type {
	RecipeRepository,
	StoredRecipe,
	UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import { RecipeEditConflictError } from '@/application/recipes/errors';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';
import { slugify } from '@/domain/recipe/slug';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { createTestDatabase } from '@/infrastructure/db/testing/test-database';
import { reparseIngredients, reparseReport } from './reparse';

const contributorId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6f');

// As the parser read this line before it kept a run of describing words in the item.
const staleLine: IngredientLine = {
	text: '12 oz boneless, skinless chicken breast, cut into thin strips',
	amount: { min: 12 },
	unit: 'oz',
	item: 'boneless',
	preparation: 'skinless chicken breast, cut into thin strips',
};

const reparsedLine: IngredientLine = {
	text: '12 oz boneless, skinless chicken breast, cut into thin strips',
	amount: { min: 12 },
	unit: 'oz',
	item: 'boneless, skinless chicken breast',
	preparation: 'cut into thin strips',
};

const unchangedLine: IngredientLine = {
	text: '2 tablespoons soy sauce',
	amount: { min: 2 },
	unit: 'tablespoons',
	item: 'soy sauce',
};

// One character past the source limit, which a recipe stored before the limit was lowered can hold.
const overlongSource = 'x'.repeat(301);

// As a recipe saved before text was tidied holds it: a doubled space and a no-break space.
const untidiedSource = 'Grandma\u00a0Rose  Lee';
const tidiedSource = 'Grandma Rose Lee';

// As saved before lines were tidied, and as the parser reads it now.
const bulletedLine: IngredientLine = { text: '• 2 eggs;', item: '• 2 eggs;' };
const unbulletedLine: IngredientLine = { text: '2 eggs', amount: { min: 2 }, item: 'eggs' };

function content(title: string, lines: IngredientLine[]): RecipeContent {
	return {
		title,
		times: {},
		ingredientSections: [{ lines }],
		instructionSections: [{ steps: [{ text: 'Stir-fry everything over high heat.' }] }],
		chapter: 'main-dishes',
		holidays: [],
		diets: [],
		images: [],
	};
}

function addRecipe(
	recipes: RecipeRepository,
	recipeContent: RecipeContent,
	contributor: MemberId = contributorId
) {
	return recipes.create({
		content: recipeContent,
		provenance: { entryMode: 'manual' },
		contributorId: contributor,
		slugBase: slugify(recipeContent.title),
	});
}

// Someone saves every recipe between the run's read and its write.
class EditedDuringRunRepository extends InMemoryRecipeRepository {
	async update(): Promise<UpdatedRecipe | null> {
		throw new RecipeEditConflictError();
	}
}

// A member changes the recipes once, just before the run's third read, after the run has read and
// checked the newest recipe.
class ChangedDuringRunRepository extends InMemoryRecipeRepository {
	private readonly change: (recipes: InMemoryRecipeRepository) => Promise<unknown>;
	private reads = 0;

	constructor(change: (recipes: InMemoryRecipeRepository) => Promise<unknown>) {
		super();
		this.change = change;
	}

	async listIds(): Promise<RecipeId[]> {
		await this.beforeRead();
		return super.listIds();
	}

	async findStoredById(id: RecipeId): Promise<StoredRecipe | null> {
		await this.beforeRead();
		return super.findStoredById(id);
	}

	private async beforeRead(): Promise<void> {
		this.reads += 1;
		if (this.reads === 3) {
			await this.change(this);
		}
	}
}

// The oldest recipe holds a stale line; the hundred added after it read as stored.
async function addStaleThenHundred(recipes: RecipeRepository) {
	const oldest = await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));
	let newest = oldest;
	for (let index = 1; index <= 100; index += 1) {
		newest = await addRecipe(recipes, content(`Soy glaze ${index}`, [unchangedLine]));
	}
	return { oldest, newest };
}

function logLines(spy: MockInstance<(...args: unknown[]) => void>): unknown[] {
	return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('reparseIngredients', () => {
	it('lists a line that reads differently in a dry run, and writes nothing', async () => {
		const recipes = new InMemoryRecipeRepository();
		const stale = await addRecipe(recipes, content('Chicken stir-fry', [staleLine, unchangedLine]));

		const result = await reparseIngredients(recipes, { write: false });

		expect(result).toEqual({
			write: false,
			checked: 1,
			recipes: [
				{
					id: stale.id,
					slug: 'chicken-stir-fry',
					title: 'Chicken stir-fry',
					changes: [
						{
							kind: 'line',
							path: 'ingredientSections.0.lines.0',
							before: staleLine,
							after: reparsedLine,
						},
					],
					outcome: { kind: 'pending' },
				},
			],
		});
		expect(await recipes.findById(stale.id)).toEqual(stale);
	});

	it('writes a recipe whose line reads differently, and leaves an unchanged recipe alone', async () => {
		const recipes = new InMemoryRecipeRepository();
		const stale = await addRecipe(recipes, content('Chicken stir-fry', [staleLine, unchangedLine]));
		const unchanged = await addRecipe(recipes, content('Soy glaze', [unchangedLine]));

		const result = await reparseIngredients(recipes, { write: true });

		expect(result.checked).toBe(2);
		expect(result.recipes.map(({ id, outcome }) => ({ id, outcome }))).toEqual([
			{ id: stale.id, outcome: { kind: 'written' } },
		]);
		const written = await recipes.findById(stale.id);
		expect(written).toEqual<Recipe>({
			...stale,
			ingredientSections: [{ lines: [reparsedLine, unchangedLine] }],
			updatedAt: written!.updatedAt,
		});
		expect(written!.updatedAt.getTime()).toBeGreaterThan(stale.updatedAt.getTime());
		expect(await recipes.findById(unchanged.id)).toEqual(unchanged);
		expect(logLines(consoleInfo)).toContainEqual({
			level: 'info',
			logger: 'reparse-ingredients',
			message: 'Recipe re-parsed',
			recipeId: stale.id,
			fieldsChanged: 1,
		});
	});

	it('skips and reports a recipe that fails write-time validation, and carries on', async () => {
		const recipes = new InMemoryRecipeRepository();
		const invalid = await addRecipe(recipes, {
			...content('Old chicken stir-fry', [staleLine]),
			source: overlongSource,
		});
		const valid = await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));

		const result = await reparseIngredients(recipes, { write: true });

		const sourceProblem = { path: 'source', message: 'Use 300 characters or fewer.' };
		expect(result.recipes.map(({ id, outcome }) => ({ id, outcome }))).toEqual([
			{ id: valid.id, outcome: { kind: 'written' } },
			{
				id: invalid.id,
				outcome: { kind: 'skipped', code: 'recipe.invalid', problems: [sourceProblem] },
			},
		]);
		expect(await recipes.findById(invalid.id)).toEqual(invalid);
		expect((await recipes.findById(valid.id))?.ingredientSections).toEqual([
			{ lines: [reparsedLine] },
		]);
		expect(logLines(consoleWarn)).toEqual([
			{
				level: 'warn',
				logger: 'reparse-ingredients',
				message: 'Recipe re-parse skipped',
				recipeId: invalid.id,
				code: 'recipe.invalid',
				problems: [sourceProblem],
			},
		]);
	});

	it('skips a recipe saved after the run read it', async () => {
		const recipes = new EditedDuringRunRepository();
		const stale = await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));

		const result = await reparseIngredients(recipes, { write: true });

		expect(result.recipes.map(({ outcome }) => outcome)).toEqual([
			{ kind: 'skipped', code: 'recipe.edit-conflict' },
		]);
		expect(await recipes.findById(stale.id)).toEqual(stale);
	});

	it('lists and writes a recipe whose only change is its source’s spacing', async () => {
		const recipes = new InMemoryRecipeRepository();
		const untidied = await addRecipe(recipes, {
			...content('Soy glaze', [unchangedLine]),
			source: untidiedSource,
		});

		const result = await reparseIngredients(recipes, { write: true });

		expect(result.recipes).toEqual([
			{
				id: untidied.id,
				slug: 'soy-glaze',
				title: 'Soy glaze',
				changes: [{ kind: 'text', path: 'source', before: untidiedSource, after: tidiedSource }],
				outcome: { kind: 'written' },
			},
		]);
		expect((await recipes.findById(untidied.id))?.source).toBe(tidiedSource);
	});

	it('lists each tidied field and line in the order the recipe holds them', async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, {
			...content('Egg toast:', [unchangedLine, bulletedLine]),
			ingredientSections: [{ heading: 'For the toast ;', lines: [unchangedLine, bulletedLine] }],
			instructionSections: [{ steps: [{ text: 'Toast  the bread.\r\nTop with eggs.' }] }],
		});

		const result = await reparseIngredients(recipes, { write: false });

		expect(result.recipes[0]?.changes).toEqual([
			{ kind: 'text', path: 'title', before: 'Egg toast:', after: 'Egg toast' },
			{
				kind: 'text',
				path: 'ingredientSections.0.heading',
				before: 'For the toast ;',
				after: 'For the toast',
			},
			{
				kind: 'line',
				path: 'ingredientSections.0.lines.1',
				before: bulletedLine,
				after: unbulletedLine,
			},
			{
				kind: 'text',
				path: 'instructionSections.0.steps.0.text',
				before: 'Toast  the bread.\r\nTop with eggs.',
				after: 'Toast the bread.\nTop with eggs.',
			},
		]);
	});

	it('skips and reports a recipe holding a line that tidies to nothing, and carries on', async () => {
		const recipes = new InMemoryRecipeRepository();
		const bulletOnly = await addRecipe(
			recipes,
			content('Bullet only', [unchangedLine, { text: '•', item: '•' }])
		);
		const stale = await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));

		const result = await reparseIngredients(recipes, { write: true });

		expect(result.recipes.map(({ id, changes, outcome }) => ({ id, changes, outcome }))).toEqual([
			{
				id: stale.id,
				changes: [expect.objectContaining({ kind: 'line' })],
				outcome: { kind: 'written' },
			},
			{
				id: bulletOnly.id,
				changes: [],
				outcome: {
					kind: 'skipped',
					code: 'recipe.invalid',
					problems: [
						{ path: 'ingredientSections.0.lines.1.text', message: 'Enter some text.' },
						{ path: 'ingredientSections.0.lines.1.item', message: 'Enter some text.' },
					],
				},
			},
		]);
		expect(await recipes.findById(bulletOnly.id)).toEqual(bulletOnly);
	});

	it('finds nothing to change on a second run', async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, content('Chicken stir-fry', [staleLine, unchangedLine]));
		await reparseIngredients(recipes, { write: true });

		const result = await reparseIngredients(recipes, { write: true });

		expect(result).toEqual({ write: true, checked: 1, recipes: [] });
	});

	it('checks every other recipe when one it already read is deleted during the run', async () => {
		const recipes = new ChangedDuringRunRepository((changed) => changed.delete(newest.id));
		const { oldest, newest } = await addStaleThenHundred(recipes);

		const result = await reparseIngredients(recipes, { write: true });

		expect(await recipes.findById(newest.id)).toBeNull();
		expect(result.checked).toBe(101);
		expect(result.recipes.map(({ id, outcome }) => ({ id, outcome }))).toEqual([
			{ id: oldest.id, outcome: { kind: 'written' } },
		]);
		expect((await recipes.findById(oldest.id))?.ingredientSections).toEqual([
			{ lines: [reparsedLine] },
		]);
	});

	it('checks every recipe once when one is added during the run', async () => {
		const recipes = new ChangedDuringRunRepository((changed) =>
			addRecipe(changed, content('Added mid-run', [unchangedLine]))
		);
		const { oldest } = await addStaleThenHundred(recipes);

		const result = await reparseIngredients(recipes, { write: true });

		expect(result.checked).toBe(101);
		expect(result.recipes.map(({ id }) => id)).toEqual([oldest.id]);
	});
});

describe('reparseIngredients over the database', () => {
	it('writes a changed line, and reads it back as unchanged on a second run', async () => {
		const db = await createTestDatabase();
		const contributor = await new DrizzleMemberRepository(db).create({
			email: 'contributor@example.com',
			displayName: 'Contributor',
			role: 'member',
		});
		const recipes = new DrizzleRecipeRepository(db);
		const stale = await addRecipe(
			recipes,
			content('Chicken stir-fry', [staleLine, unchangedLine]),
			contributor.id
		);

		const first = await reparseIngredients(recipes, { write: true });
		const second = await reparseIngredients(recipes, { write: true });

		expect(first.recipes.map(({ id, outcome }) => ({ id, outcome }))).toEqual([
			{ id: stale.id, outcome: { kind: 'written' } },
		]);
		expect((await recipes.findById(stale.id))?.ingredientSections).toEqual([
			{ lines: [reparsedLine, unchangedLine] },
		]);
		expect(second).toEqual({ write: true, checked: 1, recipes: [] });
	});

	it('compares a source saved untidied as saved, though reading tidies it', async () => {
		const db = await createTestDatabase();
		const contributor = await new DrizzleMemberRepository(db).create({
			email: 'contributor@example.com',
			displayName: 'Contributor',
			role: 'member',
		});
		const recipes = new DrizzleRecipeRepository(db);
		const untidied = await addRecipe(
			recipes,
			{ ...content('Soy glaze', [unchangedLine]), source: untidiedSource },
			contributor.id
		);

		const first = await reparseIngredients(recipes, { write: true });
		const second = await reparseIngredients(recipes, { write: true });

		expect(untidied.source).toBe(tidiedSource);
		expect(first.recipes.map(({ changes, outcome }) => ({ changes, outcome }))).toEqual([
			{
				changes: [{ kind: 'text', path: 'source', before: untidiedSource, after: tidiedSource }],
				outcome: { kind: 'written' },
			},
		]);
		expect((await recipes.findStoredById(untidied.id))?.storedContent.source).toBe(tidiedSource);
		expect(second).toEqual({ write: true, checked: 1, recipes: [] });
	});
});

describe('reparseReport', () => {
	it("shows each changed line's reading before and after, and says to redeploy after a write", async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, {
			...content('Old chicken stir-fry', [unchangedLine, staleLine]),
			source: overlongSource,
		});
		await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));
		await addRecipe(recipes, content('Soy glaze', [unchangedLine]));

		const report = reparseReport(await reparseIngredients(recipes, { write: true }));

		expect(report).toBe(
			[
				'Checked 3 recipes; 2 recipes that tidying or the parser now changes.',
				[
					'chicken-stir-fry (Chicken stir-fry): written',
					'  ingredientSections.0.lines.0: "12 oz boneless, skinless chicken breast, cut into thin strips"',
					'  - amount 12, unit "oz", item "boneless", preparation "skinless chicken breast, cut into thin strips"',
					'  + amount 12, unit "oz", item "boneless, skinless chicken breast", preparation "cut into thin strips"',
				].join('\n'),
				[
					'old-chicken-stir-fry (Old chicken stir-fry): skipped, recipe.invalid: source: Use 300 characters or fewer.',
					'  ingredientSections.0.lines.1: "12 oz boneless, skinless chicken breast, cut into thin strips"',
					'  - amount 12, unit "oz", item "boneless", preparation "skinless chicken breast, cut into thin strips"',
					'  + amount 12, unit "oz", item "boneless, skinless chicken breast", preparation "cut into thin strips"',
				].join('\n'),
				'Wrote 1 recipe and skipped 1.',
				'Search reads the new text already, but cached recipe pages show the old until this environment is redeployed: redeploy it now.',
				'A skipped recipe keeps its old text and readings until it is fixed and saved in the recipe form, which tidies it and reads its lines again; one edited or deleted during the run is read again by the next run.',
			].join('\n\n')
		);
	});

	it('shows a tidied text before and after, with spaces that look alike told apart', async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, {
			...content('Egg toast', [bulletedLine]),
			source: untidiedSource,
		});

		const report = reparseReport(await reparseIngredients(recipes, { write: false }));

		expect(report.split('\n\n')[1]).toBe(
			[
				'egg-toast (Egg toast): to write',
				'  source: "Grandma\\u00a0Rose  Lee"',
				'  + "Grandma Rose Lee"',
				'  ingredientSections.0.lines.0: "• 2 eggs;"',
				'  - item "• 2 eggs;"',
				'  + text "2 eggs", amount 2, item "eggs"',
			].join('\n')
		);
	});

	it('says a dry run wrote nothing, and what a write would do', async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));

		const report = reparseReport(await reparseIngredients(recipes, { write: false }));

		expect(report.split('\n\n').at(-1)).toBe(
			'Dry run: nothing was written. With --write, this run would write 1 recipe and skip 0.'
		);
	});

	it('says there is nothing to change', async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, content('Soy glaze', [unchangedLine]));

		const report = reparseReport(await reparseIngredients(recipes, { write: true }));

		expect(report).toBe(
			'Checked 1 recipe; 0 recipes that tidying or the parser now changes.\n\nNothing to change.'
		);
	});
});
