import { beforeEach } from 'vitest';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { describeRecipeRepositoryContract } from '@/application/testing/recipe-repository-contract';
import { memberIdSchema } from '@/domain/member/member';

// Any member id: the fake keeps no members to check it against.
const contributorId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');

let repository: InMemoryRecipeRepository;

beforeEach(() => {
	repository = new InMemoryRecipeRepository();
});

describeRecipeRepositoryContract(() => ({ repository, contributorId }));
