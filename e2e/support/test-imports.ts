import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Member } from '@/domain/member/member';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
} from '@/domain/recipe/extracted-recipe';
import type { RecipeImport } from '@/domain/recipe/recipe-import';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { reportQueryErrorsWithoutParameters } from './develop-database';

// A link import's draft awaiting review, stored as the import service stores one once its reader
// returns: the import starts, then succeeds with the draft built from what was read. Nothing reads
// a page or calls a model, so seeding spends no AI credit. deleteTestMember deletes it.
export function seedLinkImportDraft(
	db: NodePgDatabase,
	member: Member,
	read: { recipe: ExtractedRecipe; sourceUrl: string }
): Promise<RecipeImport> {
	return reportQueryErrorsWithoutParameters(async () => {
		const imports = new DrizzleRecipeImportRepository(db);
		const recipeImport = await imports.start({ memberId: member.id, mode: 'url' });
		if (recipeImport === null) {
			throw new Error('An import started without a limit was refused');
		}
		const recorded = await imports.recordSuccess(recipeImport.id, {
			draft: importDraftFromExtractedRecipe(read.recipe, []),
			sourceUrl: read.sourceUrl,
		});
		if (!recorded) {
			throw new Error('The seeded import was no longer running');
		}
		return recipeImport;
	});
}
