import { beforeEach } from 'vitest';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { describeRecipeRepositoryContract } from '@/application/testing/recipe-repository-contract';
import { memberIdSchema } from '@/domain/member/member';

// Any member ids: the fake keeps no members to check them against.
const contributorId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const otherContributorId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c');

let repository: InMemoryRecipeRepository;
let imports: InMemoryRecipeImportRepository;

beforeEach(() => {
	repository = new InMemoryRecipeRepository();
	imports = new InMemoryRecipeImportRepository(repository, new InMemorySavedDraftRepository());
});

describeRecipeRepositoryContract(() => ({
	repository,
	imports,
	contributorId,
	otherContributorId,
}));
