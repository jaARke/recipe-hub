import { beforeEach } from 'vitest';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { describeSavedDraftRepositoryContract } from '@/application/testing/saved-draft-repository-contract';
import { memberIdSchema } from '@/domain/member/member';

// Any member ids: the fakes keep no members to check them against.
const memberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const otherMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c');

let drafts: InMemorySavedDraftRepository;
let imports: InMemoryRecipeImportRepository;

beforeEach(() => {
	drafts = new InMemorySavedDraftRepository();
	imports = new InMemoryRecipeImportRepository(new InMemoryRecipeRepository());
});

describeSavedDraftRepositoryContract(() => ({
	drafts,
	imports,
	memberId,
	otherMemberId,
	backdate: async (id, updatedAt) => drafts.backdate(id, updatedAt),
}));
