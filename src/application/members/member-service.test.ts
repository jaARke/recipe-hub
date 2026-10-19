import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import {
	MemberNotFoundError,
	MemberRoleConflictError,
	OwnerOnlyError,
	OwnerProtectedError,
	SelfRemovalError,
} from '@/application/members/errors';
import { MemberService } from '@/application/members/member-service';
import type { Actor } from '@/application/ports/actor-provider';
import { actorFor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-member-id';

// Configured as it might be typed; the service compares it as Better Auth stores addresses.
const ownerEmail = ' Owner@Example.com ';

const refusedActors = [
	{ who: 'an anonymous visitor', actor: anonymousActor(), error: SignInRequiredError },
	{ who: 'a member who is not an admin', actor: memberActor(), error: ForbiddenError },
];

function newMemberRepository(): InMemoryMemberRepository {
	return new InMemoryMemberRepository(
		new InMemoryInviteRepository(),
		new InMemoryFavoriteRepository(new InMemoryRecipeRepository()),
		new InMemorySavedDraftRepository()
	);
}

function createMembers() {
	const members = newMemberRepository();
	const serviceFor = (actor: Actor) =>
		new MemberService(members, new FixedActorProvider(actor), ownerEmail);
	return { members, serviceFor };
}

async function membersWithAda() {
	const context = createMembers();
	const ada = await context.members.create({
		email: 'ada@example.com',
		displayName: 'Ada',
		role: 'member',
	});
	return { ...context, ada, adaService: context.serviceFor(actorFor(ada)) };
}

// Ada is a member and Grace an admin.
async function membersWithGrace() {
	const context = await membersWithAda();
	const grace = await context.members.create({
		email: 'grace@example.com',
		displayName: 'Grace',
		role: 'admin',
	});
	return { ...context, grace, graceService: context.serviceFor(actorFor(grace)) };
}

// Ada is a member, Grace an admin, and Olive the owner.
async function membersWithOwner() {
	const context = await membersWithGrace();
	const owner = await context.members.create({
		email: 'owner@example.com',
		displayName: 'Olive',
		role: 'admin',
	});
	return { ...context, owner, ownerService: context.serviceFor(actorFor(owner)) };
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

function loggedLines(): unknown[] {
	return [...consoleInfo.mock.calls, ...consoleWarn.mock.calls].map(([line]) =>
		JSON.parse(String(line))
	);
}

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('getCurrentMember', () => {
	it('returns null for a signed-out visitor', async () => {
		const { serviceFor } = createMembers();

		expect(await serviceFor(anonymousActor()).getCurrentMember()).toBeNull();
	});

	it("returns the signed-in member's own details", async () => {
		const { ada, adaService } = await membersWithAda();

		const current = await adaService.getCurrentMember();

		expect(current).toEqual({
			id: ada.id,
			displayName: 'Ada',
			email: 'ada@example.com',
			role: 'member',
		});
		expect(current).not.toHaveProperty('createdAt');
	});

	it('returns null when the account no longer exists', async () => {
		const { serviceFor } = createMembers();

		expect(await serviceFor(memberActor()).getCurrentMember()).toBeNull();
	});
});

describe('listMembers', () => {
	it.each(refusedActors)('refuses $who', async ({ actor, error }) => {
		const { serviceFor } = createMembers();

		await expect(serviceFor(actor).listMembers()).rejects.toThrow(error);
	});

	it('lists every member oldest first for an admin, marking the admin and the owner', async () => {
		const { ada, grace, owner, graceService } = await membersWithOwner();

		expect(await graceService.listMembers()).toEqual([
			{
				id: ada.id,
				displayName: 'Ada',
				email: 'ada@example.com',
				role: 'member',
				createdAt: ada.createdAt,
				isCurrentMember: false,
				isOwner: false,
			},
			{
				id: grace.id,
				displayName: 'Grace',
				email: 'grace@example.com',
				role: 'admin',
				createdAt: grace.createdAt,
				isCurrentMember: true,
				isOwner: false,
			},
			{
				id: owner.id,
				displayName: 'Olive',
				email: 'owner@example.com',
				role: 'admin',
				createdAt: owner.createdAt,
				isCurrentMember: false,
				isOwner: true,
			},
		]);
	});
});

describe('renameCurrentMember', () => {
	it('refuses an anonymous visitor', async () => {
		const { serviceFor } = createMembers();

		await expect(serviceFor(anonymousActor()).renameCurrentMember('Ada')).rejects.toThrow(
			SignInRequiredError
		);
	});

	it('renames the member and returns their id', async () => {
		const { members, ada, adaService } = await membersWithAda();

		expect(await adaService.renameCurrentMember(' Ada Lovelace ')).toEqual({ id: ada.id });
		expect(await members.findById(ada.id)).toMatchObject({ displayName: 'Ada Lovelace' });
	});

	it('rejects an invalid name under the displayName field', async () => {
		const { members, ada, adaService } = await membersWithAda();

		await expect(adaService.renameCurrentMember('a'.repeat(61))).rejects.toThrow(
			expect.objectContaining({
				code: 'member.invalid-profile',
				problems: [{ path: 'displayName', message: 'Use 60 characters or fewer.' }],
			})
		);
		expect(await members.findById(ada.id)).toMatchObject({ displayName: 'Ada' });
	});

	it('reports an account that no longer exists', async () => {
		const { serviceFor } = createMembers();

		await expect(serviceFor(memberActor()).renameCurrentMember('Ada')).rejects.toThrow(
			MemberNotFoundError
		);
	});

	it('logs the rename by id alone', async () => {
		const { ada, adaService } = await membersWithAda();

		await adaService.renameCurrentMember('Ada Lovelace');

		expect(consoleInfo).toHaveBeenCalledOnce();
		const line = String(consoleInfo.mock.calls[0]?.[0]);
		expect(JSON.parse(line)).toEqual({
			level: 'info',
			logger: 'members',
			message: 'Member renamed',
			memberId: ada.id,
		});
		expect(line).not.toContain('Ada');
	});
});

describe('makeAdmin', () => {
	it.each(refusedActors)('refuses $who and keeps the role', async ({ actor, error }) => {
		const { members, ada, serviceFor } = await membersWithAda();

		await expect(serviceFor(actor).makeAdmin(ada.id)).rejects.toThrow(error);
		expect(await members.findById(ada.id)).toMatchObject({ role: 'member' });
	});

	it('makes the member an admin', async () => {
		const { members, ada, graceService } = await membersWithGrace();

		await graceService.makeAdmin(ada.id);

		expect(await members.findById(ada.id)).toMatchObject({ role: 'admin' });
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const { graceService } = await membersWithGrace();

		await expect(graceService.makeAdmin(id)).rejects.toThrow(MemberNotFoundError);
	});

	it('reports a removed member as not found', async () => {
		const { members, ada, graceService } = await membersWithGrace();
		await members.remove(ada.id);

		await expect(graceService.makeAdmin(ada.id)).rejects.toThrow(MemberNotFoundError);
	});

	it('reports an admin as a role conflict', async () => {
		const { members, graceService } = await membersWithGrace();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});

		await expect(graceService.makeAdmin(lin.id)).rejects.toThrow(MemberRoleConflictError);
	});

	it('logs the change by ids alone', async () => {
		const { ada, grace, graceService } = await membersWithGrace();

		await graceService.makeAdmin(ada.id);

		expect(loggedLines()).toEqual([
			{
				level: 'info',
				logger: 'members',
				message: 'Admin role granted',
				memberId: grace.id,
				targetMemberId: ada.id,
			},
		]);
	});
});

describe('removeAdmin', () => {
	it.each(refusedActors)('refuses $who and keeps the role', async ({ actor, error }) => {
		const { members, grace, serviceFor } = await membersWithGrace();

		await expect(serviceFor(actor).removeAdmin(grace.id)).rejects.toThrow(error);
		expect(await members.findById(grace.id)).toMatchObject({ role: 'admin' });
	});

	it('lets the owner remove admin from another admin, who stays a member', async () => {
		const { members, grace, owner, ownerService } = await membersWithOwner();

		await ownerService.removeAdmin(grace.id);

		expect(await members.findById(grace.id)).toMatchObject({ role: 'member' });
		expect(await members.findById(owner.id)).toMatchObject({ role: 'admin' });
	});

	it("refuses an admin removing another admin's role and logs the refusal by ids alone", async () => {
		const { members, grace, graceService } = await membersWithOwner();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});

		await expect(graceService.removeAdmin(lin.id)).rejects.toThrow(OwnerOnlyError);

		expect(await members.findById(lin.id)).toMatchObject({ role: 'admin' });
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Admin role removal refused',
				memberId: grace.id,
				targetMemberId: lin.id,
				failure: 'member.owner-only',
			},
		]);
	});

	it('lets an admin remove their own role', async () => {
		const { members, grace, graceService } = await membersWithGrace();

		await graceService.removeAdmin(grace.id);

		expect(await members.findById(grace.id)).toMatchObject({ role: 'member' });
	});

	it('refuses to remove the owner and logs the refusal by ids alone', async () => {
		const { members, grace, owner, graceService } = await membersWithOwner();

		await expect(graceService.removeAdmin(owner.id)).rejects.toThrow(OwnerProtectedError);

		expect(await members.findById(owner.id)).toMatchObject({ role: 'admin' });
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Admin role removal refused',
				memberId: grace.id,
				targetMemberId: owner.id,
				failure: 'member.owner',
			},
		]);
	});

	it('refuses the owner removing their own role', async () => {
		const { members, owner, ownerService } = await membersWithOwner();

		await expect(ownerService.removeAdmin(owner.id)).rejects.toThrow(OwnerProtectedError);

		expect(await members.findById(owner.id)).toMatchObject({ role: 'admin' });
	});

	it('reports a member who is not an admin as a role conflict', async () => {
		const { ada, ownerService } = await membersWithOwner();

		await expect(ownerService.removeAdmin(ada.id)).rejects.toThrow(MemberRoleConflictError);
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const { ownerService } = await membersWithOwner();

		await expect(ownerService.removeAdmin(id)).rejects.toThrow(MemberNotFoundError);
	});

	it('logs the change by ids alone', async () => {
		const { grace, owner, ownerService } = await membersWithOwner();

		await ownerService.removeAdmin(grace.id);

		expect(loggedLines()).toEqual([
			{
				level: 'info',
				logger: 'members',
				message: 'Admin role removed',
				memberId: owner.id,
				targetMemberId: grace.id,
			},
		]);
	});
});

describe('removeMember', () => {
	it.each(refusedActors)('refuses $who and keeps the member', async ({ actor, error }) => {
		const { members, ada, serviceFor } = await membersWithGrace();

		await expect(serviceFor(actor).removeMember(ada.id)).rejects.toThrow(error);
		expect(await members.findById(ada.id)).not.toHaveProperty('removedAt');
	});

	it('removes the member, who leaves the list and keeps their name', async () => {
		const { members, ada, grace, graceService } = await membersWithGrace();

		await graceService.removeMember(ada.id);

		expect((await graceService.listMembers()).map(({ id }) => id)).toEqual([grace.id]);
		expect(await members.findById(ada.id)).toMatchObject({
			displayName: 'Ada',
			removedAt: expect.any(Date),
		});
	});

	it('lets the owner remove another admin', async () => {
		const { members, grace, ownerService } = await membersWithOwner();

		await ownerService.removeMember(grace.id);

		expect(await members.listAdmins()).not.toContainEqual(
			expect.objectContaining({ id: grace.id })
		);
	});

	it('refuses an admin removing another admin and logs the refusal by ids alone', async () => {
		const { members, grace, graceService } = await membersWithOwner();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});

		await expect(graceService.removeMember(lin.id)).rejects.toThrow(OwnerOnlyError);

		expect(await members.findById(lin.id)).not.toHaveProperty('removedAt');
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Member removal refused',
				memberId: grace.id,
				targetMemberId: lin.id,
				failure: 'member.owner-only',
			},
		]);
	});

	it('refuses an admin removing a member the owner made an admin after the page loaded', async () => {
		const { members, ada, graceService, ownerService } = await membersWithOwner();
		const asLoaded = await members.findById(ada.id);
		await ownerService.makeAdmin(ada.id);
		// The removal reads Ada as the page loaded her, a member, as one racing the promotion would.
		const findById = members.findById.bind(members);
		vi.spyOn(members, 'findById').mockImplementation(async (id) =>
			id === ada.id ? asLoaded : findById(id)
		);

		await expect(graceService.removeMember(ada.id)).rejects.toThrow(MemberRoleConflictError);

		vi.restoreAllMocks();
		expect(await members.findById(ada.id)).toMatchObject({ role: 'admin' });
		expect(await members.findById(ada.id)).not.toHaveProperty('removedAt');
	});

	it('reports an admin removed already as not found, even to another admin', async () => {
		const { members, ownerService, graceService } = await membersWithOwner();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});
		await ownerService.removeMember(lin.id);

		await expect(graceService.removeMember(lin.id)).rejects.toThrow(MemberNotFoundError);
	});

	it('refuses an admin removing themselves and logs the refusal by ids alone', async () => {
		const { members, grace, graceService } = await membersWithGrace();

		await expect(graceService.removeMember(grace.id)).rejects.toThrow(SelfRemovalError);

		expect(await members.findById(grace.id)).not.toHaveProperty('removedAt');
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Member removal refused',
				memberId: grace.id,
				targetMemberId: grace.id,
				failure: 'member.self-removal',
			},
		]);
	});

	it('refuses to remove the owner and logs the refusal by ids alone', async () => {
		const { members, grace, owner, graceService } = await membersWithOwner();

		await expect(graceService.removeMember(owner.id)).rejects.toThrow(OwnerProtectedError);

		expect(await members.findById(owner.id)).not.toHaveProperty('removedAt');
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Member removal refused',
				memberId: grace.id,
				targetMemberId: owner.id,
				failure: 'member.owner',
			},
		]);
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const { graceService } = await membersWithGrace();

		await expect(graceService.removeMember(id)).rejects.toThrow(MemberNotFoundError);
	});

	it('reports a member removed already as not found', async () => {
		const { ada, graceService } = await membersWithGrace();
		await graceService.removeMember(ada.id);

		await expect(graceService.removeMember(ada.id)).rejects.toThrow(MemberNotFoundError);
	});

	it('logs the removal by ids alone', async () => {
		const { ada, grace, graceService } = await membersWithGrace();

		await graceService.removeMember(ada.id);

		expect(loggedLines()).toEqual([
			{
				level: 'info',
				logger: 'members',
				message: 'Member removed',
				memberId: grace.id,
				targetMemberId: ada.id,
			},
		]);
	});
});

describe('ensureOwner', () => {
	it('creates the owner as an admin named Admin when no account has the address', async () => {
		const { members, serviceFor } = await membersWithGrace();

		await serviceFor(anonymousActor()).ensureOwner();

		const owner = await members.findByEmail('owner@example.com');
		expect(owner).toMatchObject({ displayName: 'Admin', role: 'admin' });
		expect(await members.list()).toHaveLength(3);
		const line = String(consoleInfo.mock.calls[0]?.[0]);
		expect(JSON.parse(line)).toEqual({
			level: 'info',
			logger: 'members',
			message: 'Owner bootstrapped',
			memberId: owner?.id,
			created: true,
		});
		expect(line).not.toContain('owner@example.com');
	});

	it('promotes the member at the address, although another admin exists', async () => {
		const { members, serviceFor } = await membersWithGrace();
		const owner = await members.create({
			email: 'owner@example.com',
			displayName: 'Olive',
			role: 'member',
		});

		await serviceFor(anonymousActor()).ensureOwner();

		expect(await members.findById(owner.id)).toEqual({ ...owner, role: 'admin' });
		expect(await members.list()).toHaveLength(3);
		expect(loggedLines()).toEqual([
			{
				level: 'info',
				logger: 'members',
				message: 'Owner bootstrapped',
				memberId: owner.id,
				created: false,
			},
		]);
	});

	it('changes nothing and logs nothing when the owner is an admin', async () => {
		const { members, owner, serviceFor } = await membersWithOwner();

		await serviceFor(anonymousActor()).ensureOwner();

		expect(await members.findById(owner.id)).toEqual(owner);
		expect(await members.list()).toHaveLength(3);
		expect(loggedLines()).toEqual([]);
	});

	it('lets two runs at once on a store with no admin both succeed, with one owner', async () => {
		const { members, serviceFor } = await membersWithAda();
		const service = serviceFor(anonymousActor());

		await Promise.all([service.ensureOwner(), service.ensureOwner()]);

		expect(await members.listAdmins()).toEqual([
			expect.objectContaining({ email: 'owner@example.com' }),
		]);
	});

	it('creates a new owner account when the old one was removed, leaving that one removed', async () => {
		const { members, owner, serviceFor } = await membersWithOwner();
		await members.remove(owner.id);

		await serviceFor(anonymousActor()).ensureOwner();

		const current = await members.findByEmail('owner@example.com');
		expect(current).toMatchObject({ displayName: 'Admin', role: 'admin' });
		expect(current?.id).not.toBe(owner.id);
		expect(await members.findById(owner.id)).toMatchObject({ removedAt: expect.any(Date) });
	});

	it('never asks who is calling', async () => {
		const actors = new FixedActorProvider(memberActor());

		const members = newMemberRepository();

		await new MemberService(members, actors, ownerEmail).ensureOwner();

		expect(actors.wasAsked).toBe(false);
	});
});
