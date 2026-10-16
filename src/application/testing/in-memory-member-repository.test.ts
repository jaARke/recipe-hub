import { beforeEach } from 'vitest';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { describeMemberRepositoryContract } from '@/application/testing/member-repository-contract';

let invites: InMemoryInviteRepository;
let recipes: InMemoryRecipeRepository;
let favorites: InMemoryFavoriteRepository;
let drafts: InMemorySavedDraftRepository;
let members: InMemoryMemberRepository;

beforeEach(() => {
	invites = new InMemoryInviteRepository();
	recipes = new InMemoryRecipeRepository();
	favorites = new InMemoryFavoriteRepository(recipes);
	drafts = new InMemorySavedDraftRepository();
	members = new InMemoryMemberRepository(invites, favorites, drafts);
});

describeMemberRepositoryContract(() => ({ members, invites, favorites, recipes, drafts }));
