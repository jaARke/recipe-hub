import { describe, expect, it } from 'vitest';
import { savedDraftCutoff } from '@/application/drafts/saved-draft';
import { imagesInUse } from '@/application/recipes/images-in-use';
import { memberActor } from '@/application/testing/actors';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { importDraftCutoff } from '@/domain/recipe/recipe-import';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';

const listedPhoto: RecipeImage = {
	role: 'dish',
	pathname: 'dish/development/soup.jpg',
	size: { width: 2400, height: 1800 },
};
const draftScan: RecipeImage = { role: 'scan', pathname: 'scan/development/card.jpg' };
const expiredDraftScan: RecipeImage = { role: 'scan', pathname: 'scan/development/old-card.jpg' };
const savedDraftPhoto = 'dish/development/saved.jpg';
const expiredSavedDraftPhoto = 'dish/development/old-saved.jpg';
const unusedPhoto = 'dish/development/unused.jpg';

// One member's recipe listing a photo, draft awaiting review naming a scan, and expired draft naming
// another, and their saved draft naming a photo and expired saved draft naming another.
async function createCatalog(now: Date) {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const drafts = new InMemorySavedDraftRepository();
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
	for (const pathname of [savedDraftPhoto, expiredSavedDraftPhoto]) {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [pathname] });
		if (draft === null) {
			throw new Error('The draft was refused');
		}
		if (pathname === expiredSavedDraftPhoto) {
			drafts.backdate(draft.id, new Date(savedDraftCutoff(now).getTime() - 1000));
		}
	}
	return { recipes, imports, drafts, memberId };
}

describe('imagesInUse', () => {
	it('finds the pathnames a recipe lists or an unexpired draft names', async () => {
		const now = new Date();
		const { recipes, imports, drafts } = await createCatalog(now);

		const inUse = await imagesInUse(
			[
				listedPhoto.pathname,
				draftScan.pathname,
				expiredDraftScan.pathname,
				savedDraftPhoto,
				expiredSavedDraftPhoto,
				unusedPhoto,
			],
			recipes,
			imports,
			drafts,
			now
		);

		expect([...inUse].toSorted()).toEqual(
			[listedPhoto.pathname, draftScan.pathname, savedDraftPhoto].toSorted()
		);
	});

	it("ignores the excluded member's recipes and drafts", async () => {
		const now = new Date();
		const { recipes, imports, drafts, memberId } = await createCatalog(now);
		const pathnames = [listedPhoto.pathname, draftScan.pathname, savedDraftPhoto];

		expect(await imagesInUse(pathnames, recipes, imports, drafts, now, memberId)).toEqual(
			new Set()
		);
		expect(
			await imagesInUse(pathnames, recipes, imports, drafts, now, memberActor().memberId)
		).toEqual(new Set(pathnames));
	});

	it('finds nothing among pathnames nothing names', async () => {
		const now = new Date();
		const { recipes, imports, drafts } = await createCatalog(now);

		expect(await imagesInUse([unusedPhoto], recipes, imports, drafts, now)).toEqual(new Set());
	});
});
