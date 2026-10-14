import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { RecipeRepository, UpdatedRecipe } from '@/application/ports/recipe-repository';
import { RecipeEditConflictError } from '@/application/recipes/errors';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import type { Recipe, RecipeContent } from '@/domain/recipe/recipe';
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

function content(title: string, lines: IngredientLine[]): RecipeContent {
	return {
		title,
		times: {},
		ingredientSections: [{ lines }],
		instructionSections: [{ steps: [{ text: 'Stir-fry everything over high heat.' }] }],
		tags: ['Weeknight'],
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
					changes: [{ section: 0, line: 0, before: staleLine, after: reparsedLine }],
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
			message: 'Recipe ingredients re-parsed',
			recipeId: stale.id,
			linesChanged: 1,
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
				message: 'Recipe ingredient re-parse skipped',
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

	it('finds nothing to change on a second run', async () => {
		const recipes = new InMemoryRecipeRepository();
		await addRecipe(recipes, content('Chicken stir-fry', [staleLine, unchangedLine]));
		await reparseIngredients(recipes, { write: true });

		const result = await reparseIngredients(recipes, { write: true });

		expect(result).toEqual({ write: true, checked: 1, recipes: [] });
	});

	it('reads every page of recipes', async () => {
		const recipes = new InMemoryRecipeRepository();
		for (let index = 1; index <= 51; index += 1) {
			await addRecipe(recipes, content(`Soy glaze ${index}`, [unchangedLine]));
		}
		const stale = await addRecipe(recipes, content('Chicken stir-fry', [staleLine]));

		const result = await reparseIngredients(recipes, { write: false });

		expect(result.checked).toBe(52);
		expect(result.recipes.map(({ id }) => id)).toEqual([stale.id]);
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
				'Checked 3 recipes; 2 recipes with lines the parser now reads differently.',
				[
					'chicken-stir-fry (Chicken stir-fry): written',
					'  Section 1, line 1: "12 oz boneless, skinless chicken breast, cut into thin strips"',
					'  - amount 12, unit "oz", item "boneless", preparation "skinless chicken breast, cut into thin strips"',
					'  + amount 12, unit "oz", item "boneless, skinless chicken breast", preparation "cut into thin strips"',
				].join('\n'),
				[
					'old-chicken-stir-fry (Old chicken stir-fry): skipped, recipe.invalid: source: Use 300 characters or fewer.',
					'  Section 1, line 2: "12 oz boneless, skinless chicken breast, cut into thin strips"',
					'  - amount 12, unit "oz", item "boneless", preparation "skinless chicken breast, cut into thin strips"',
					'  + amount 12, unit "oz", item "boneless, skinless chicken breast", preparation "cut into thin strips"',
				].join('\n'),
				'Wrote 1 recipe and skipped 1.',
				'Search reads the new lines already, but cached recipe pages show the old ones until this environment is redeployed: redeploy it now.',
				'A skipped recipe keeps its old reading until it is fixed and saved in the recipe form, which reads its lines again; one edited or deleted during the run is read again by the next run.',
			].join('\n\n')
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
			'Checked 1 recipe; 0 recipes with lines the parser now reads differently.\n\nNothing to change.'
		);
	});
});
