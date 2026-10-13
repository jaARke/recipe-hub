import { beforeEach } from 'vitest';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { describeRecipeImportRepositoryContract } from '@/application/testing/recipe-import-repository-contract';
import { memberIdSchema } from '@/domain/member/member';

// Any member ids: the fakes keep no members to check them against.
const memberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const otherMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c');

let recipes: InMemoryRecipeRepository;
let imports: InMemoryRecipeImportRepository;

beforeEach(() => {
	recipes = new InMemoryRecipeRepository();
	imports = new InMemoryRecipeImportRepository(recipes);
});

describeRecipeImportRepositoryContract(() => ({
	imports,
	recipes,
	memberId,
	otherMemberId,
	backdate: async (id, createdAt) => imports.backdate(id, createdAt),
}));
