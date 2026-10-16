import { beforeEach } from 'vitest';
import { describeFavoriteRepositoryContract } from '@/application/testing/favorite-repository-contract';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { memberIdSchema } from '@/domain/member/member';

// Any member ids: the fakes keep no members to check them against.
const memberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const otherMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c');

let recipes: InMemoryRecipeRepository;
let favorites: InMemoryFavoriteRepository;

beforeEach(() => {
	recipes = new InMemoryRecipeRepository();
	favorites = new InMemoryFavoriteRepository(recipes);
});

describeFavoriteRepositoryContract(() => ({ favorites, recipes, memberId, otherMemberId }));
