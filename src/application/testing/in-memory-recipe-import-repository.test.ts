import { beforeEach } from 'vitest';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { describeRecipeImportRepositoryContract } from '@/application/testing/recipe-import-repository-contract';
import { memberIdSchema } from '@/domain/member/member';

// Any member ids: the fakes keep no members to check them against.
const memberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const otherMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c');

let recipes: InMemoryRecipeRepository;
let drafts: InMemorySavedDraftRepository;
let imports: InMemoryRecipeImportRepository;

beforeEach(() => {
	recipes = new InMemoryRecipeRepository();
	drafts = new InMemorySavedDraftRepository();
	imports = new InMemoryRecipeImportRepository(recipes, drafts);
});

describeRecipeImportRepositoryContract(() => ({
	imports,
	recipes,
	drafts,
	memberId,
	otherMemberId,
	backdate: async (id, createdAt) => imports.backdate(id, createdAt),
	storeDraftOf: async (id, member) => {
		drafts.storeImported(member, id, {
			provenance: { entryMode: 'photo' },
			imported: { content: {}, problems: [] },
			imagePathnames: [],
		});
	},
}));
