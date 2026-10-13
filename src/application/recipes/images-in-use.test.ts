import { describe, expect, it } from 'vitest';
import { imagesInUse } from '@/application/recipes/images-in-use';
import { memberActor } from '@/application/testing/actors';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { importDraftCutoff } from '@/domain/recipe/recipe-import';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';

const listedPhoto: RecipeImage = { role: 'dish', pathname: 'dish/development/soup.jpg' };
const draftScan: RecipeImage = { role: 'scan', pathname: 'scan/development/card.jpg' };
const expiredDraftScan: RecipeImage = { role: 'scan', pathname: 'scan/development/old-card.jpg' };
const unusedPhoto = 'dish/development/unused.jpg';

// One member's recipe listing a photo, draft awaiting review naming a scan, and expired draft naming
// another.
async function createCatalog(now: Date) {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const { memberId } = memberActor();
	await recipes.create({
		content: recipeContentSchema.parse({ ...sampleChickenSoup, images: [listedPhoto] }),
		provenance: { entryMode: 'manual' },
		contributorId: memberId,
		slugBase: 'chicken-soup',
	});
	for (const scan of [draftScan, expiredDraftScan]) {
		const started = await imports.start({ memberId, mode: 'photo' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		await imports.recordSuccess(started.id, {
			draft: { content: { title: 'Soup card', images: [scan] }, problems: [] },
		});
		if (scan === expiredDraftScan) {
			imports.backdate(started.id, new Date(importDraftCutoff(now).getTime() - 1000));
		}
	}
	return { recipes, imports, memberId };
}

describe('imagesInUse', () => {
	it('finds the pathnames a recipe lists or an unexpired draft names', async () => {
		const now = new Date();
		const { recipes, imports } = await createCatalog(now);

		const inUse = await imagesInUse(
			[listedPhoto.pathname, draftScan.pathname, expiredDraftScan.pathname, unusedPhoto],
			recipes,
			imports,
			now
		);

		expect([...inUse].toSorted()).toEqual([listedPhoto.pathname, draftScan.pathname]);
	});

	it("ignores the excluded member's recipes and drafts", async () => {
		const now = new Date();
		const { recipes, imports, memberId } = await createCatalog(now);
		const pathnames = [listedPhoto.pathname, draftScan.pathname];

		expect(await imagesInUse(pathnames, recipes, imports, now, memberId)).toEqual(new Set());
		expect(await imagesInUse(pathnames, recipes, imports, now, memberActor().memberId)).toEqual(
			new Set(pathnames)
		);
	});

	it('finds nothing among pathnames nothing names', async () => {
		const now = new Date();
		const { recipes, imports } = await createCatalog(now);

		expect(await imagesInUse([unusedPhoto], recipes, imports, now)).toEqual(new Set());
	});
});
