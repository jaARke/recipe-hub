import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import type { Member } from '@/domain/member/member';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
} from '@/domain/recipe/extracted-recipe';
import { importProvenance, type RecipeImportId } from '@/domain/recipe/recipe-import';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { JsonLdPageRecipeExtractor } from '@/infrastructure/web/json-ld-page-recipe-extractor';
import { reportQueryErrorsWithoutParameters } from './develop-database';

// A link import and the draft it made, by their ids.
export type SeededImport = { importId: RecipeImportId; draftId: SavedDraftId };

// A link import's draft, stored as the import service stores one once its reader returns: the import
// starts, then succeeds with the draft built from what was read. Nothing reads a page or calls a
// model, so seeding spends no AI credit. deleteTestMember deletes both.
export function seedLinkImportDraft(
	db: NodePgDatabase,
	member: Member,
	read: { recipe: ExtractedRecipe; sourceUrl: string }
): Promise<SeededImport> {
	return reportQueryErrorsWithoutParameters(async () => {
		const imports = new DrizzleRecipeImportRepository(db);
		const recipeImport = await imports.start({ memberId: member.id, mode: 'url' });
		if (recipeImport === null) {
			throw new Error('An import started without a limit was refused');
		}
		const imported = importDraftFromExtractedRecipe(read.recipe, []);
		const draftId = await imports.recordSuccess(recipeImport.id, {
			draft: {
				provenance: importProvenance({ mode: 'url', sourceUrl: read.sourceUrl }, undefined),
				...(imported.content.title !== undefined && { title: imported.content.title }),
				imported,
				imagePathnames: [],
			},
		});
		if (draftId === null) {
			throw new Error('The seeded import was no longer running');
		}
		return { importId: recipeImport.id, draftId };
	});
}

// A link import of a page whose JSON-LD holds the whole recipe, read as the import service reads such a
// page, with no model.
export async function seedJsonLdImportDraft(
	db: NodePgDatabase,
	member: Member,
	page: WebPage
): Promise<SeededImport> {
	const extraction = await new JsonLdPageRecipeExtractor().extract(page);
	if (extraction === null) {
		throw new Error('The seeded page holds no recipe its JSON-LD reader reads');
	}
	return seedLinkImportDraft(db, member, { recipe: extraction.recipe, sourceUrl: page.url });
}
