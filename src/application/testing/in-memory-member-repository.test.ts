import { beforeEach } from 'vitest';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { describeMemberRepositoryContract } from '@/application/testing/member-repository-contract';

let invites: InMemoryInviteRepository;
let members: InMemoryMemberRepository;

beforeEach(() => {
	invites = new InMemoryInviteRepository();
	members = new InMemoryMemberRepository(invites);
});

describeMemberRepositoryContract(() => ({ members, invites }));
