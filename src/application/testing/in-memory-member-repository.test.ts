import { beforeEach } from 'vitest';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { describeMemberRepositoryContract } from '@/application/testing/member-repository-contract';

let invites: InMemoryInviteRepository;
let recipes: InMemoryRecipeRepository;
let favorites: InMemoryFavoriteRepository;
let members: InMemoryMemberRepository;

beforeEach(() => {
	invites = new InMemoryInviteRepository();
	recipes = new InMemoryRecipeRepository();
	favorites = new InMemoryFavoriteRepository(recipes);
	members = new InMemoryMemberRepository(invites, favorites);
});

describeMemberRepositoryContract(() => ({ members, invites, favorites, recipes }));
