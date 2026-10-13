import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import {
	LastAdminError,
	MemberNotFoundError,
	MemberRoleConflictError,
	SelfRemovalError,
} from '@/application/members/errors';
import { MemberService } from '@/application/members/member-service';
import type { Actor } from '@/application/ports/actor-provider';
import { actorFor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-member-id';

const refusedActors = [
	{ who: 'an anonymous visitor', actor: anonymousActor(), error: SignInRequiredError },
	{ who: 'a member who is not an admin', actor: memberActor(), error: ForbiddenError },
];

function createMembers() {
	const members = new InMemoryMemberRepository();
	const serviceFor = (actor: Actor) => new MemberService(members, new FixedActorProvider(actor));
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

	it('lists every member oldest first for an admin, marking the admin', async () => {
		const { ada, grace, graceService } = await membersWithGrace();

		expect(await graceService.listMembers()).toEqual([
			{
				id: ada.id,
				displayName: 'Ada',
				email: 'ada@example.com',
				role: 'member',
				createdAt: ada.createdAt,
				isCurrentMember: false,
			},
			{
				id: grace.id,
				displayName: 'Grace',
				email: 'grace@example.com',
				role: 'admin',
				createdAt: grace.createdAt,
				isCurrentMember: true,
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

	it('removes admin from another admin, who stays a member', async () => {
		const { members, grace, graceService } = await membersWithGrace();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});

		await graceService.removeAdmin(lin.id);

		expect(await members.findById(lin.id)).toMatchObject({ role: 'member' });
		expect(await members.findById(grace.id)).toMatchObject({ role: 'admin' });
	});

	it('lets an admin remove their own role while another admin remains', async () => {
		const { members, grace, graceService } = await membersWithGrace();
		await members.create({ email: 'lin@example.com', displayName: 'Lin', role: 'admin' });

		await graceService.removeAdmin(grace.id);

		expect(await members.findById(grace.id)).toMatchObject({ role: 'member' });
	});

	it('refuses to remove the last admin and logs the refusal by ids alone', async () => {
		const { members, grace, graceService } = await membersWithGrace();

		await expect(graceService.removeAdmin(grace.id)).rejects.toThrow(LastAdminError);

		expect(await members.findById(grace.id)).toMatchObject({ role: 'admin' });
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Admin role removal refused',
				memberId: grace.id,
				targetMemberId: grace.id,
				failure: 'member.last-admin',
			},
		]);
	});

	it('reports a member who is not an admin as a role conflict', async () => {
		const { ada, graceService } = await membersWithGrace();

		await expect(graceService.removeAdmin(ada.id)).rejects.toThrow(MemberRoleConflictError);
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const { graceService } = await membersWithGrace();

		await expect(graceService.removeAdmin(id)).rejects.toThrow(MemberNotFoundError);
	});

	it('logs the change by ids alone', async () => {
		const { members, grace, graceService } = await membersWithGrace();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});

		await graceService.removeAdmin(lin.id);

		expect(loggedLines()).toEqual([
			{
				level: 'info',
				logger: 'members',
				message: 'Admin role removed',
				memberId: grace.id,
				targetMemberId: lin.id,
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

	it('removes another admin', async () => {
		const { members, graceService } = await membersWithGrace();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});

		await graceService.removeMember(lin.id);

		expect(await members.listAdmins()).not.toContainEqual(expect.objectContaining({ id: lin.id }));
	});

	it('refuses an admin removing themselves and logs the refusal by ids alone', async () => {
		const { members, grace, graceService } = await membersWithGrace();
		await members.create({ email: 'lin@example.com', displayName: 'Lin', role: 'admin' });

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

	it('refuses to remove the last admin after the acting admin lost their role, and logs it', async () => {
		const { members, grace, graceService } = await membersWithGrace();
		const lin = await members.create({
			email: 'lin@example.com',
			displayName: 'Lin',
			role: 'admin',
		});
		// Lin removed admin from Grace after Grace's page loaded.
		await members.setRole(grace.id, 'member');

		await expect(graceService.removeMember(lin.id)).rejects.toThrow(LastAdminError);

		expect(await members.listAdmins()).toEqual([lin]);
		expect(loggedLines()).toEqual([
			{
				level: 'warn',
				logger: 'members',
				message: 'Member removal refused',
				memberId: grace.id,
				targetMemberId: lin.id,
				failure: 'member.last-admin',
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

describe('ensureAdmin', () => {
	it('does nothing when an admin exists', async () => {
		const { members, ada, serviceFor } = await membersWithAda();
		await members.create({ email: 'grace@example.com', displayName: 'Grace', role: 'admin' });

		await serviceFor(anonymousActor()).ensureAdmin('ada@example.com');

		expect(await members.findById(ada.id)).toMatchObject({ role: 'member' });
		expect(await members.list()).toHaveLength(2);
		expect(consoleInfo).not.toHaveBeenCalled();
	});

	it('promotes the account that has the address', async () => {
		const { members, ada, serviceFor } = await membersWithAda();

		await serviceFor(anonymousActor()).ensureAdmin(' Ada@Example.com ');

		expect(await members.listAdmins()).toEqual([{ ...ada, role: 'admin' }]);
		expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
			level: 'info',
			logger: 'members',
			message: 'Admin bootstrapped',
			memberId: ada.id,
			created: false,
		});
	});

	it('creates an admin named Admin when no account has the address', async () => {
		const { members, serviceFor } = await membersWithAda();

		await serviceFor(anonymousActor()).ensureAdmin('owner@example.com');

		const [admin] = await members.listAdmins();
		expect(admin).toMatchObject({ email: 'owner@example.com', displayName: 'Admin' });
		expect(await members.list()).toHaveLength(2);
		const line = String(consoleInfo.mock.calls[0]?.[0]);
		expect(JSON.parse(line)).toEqual({
			level: 'info',
			logger: 'members',
			message: 'Admin bootstrapped',
			memberId: admin?.id,
			created: true,
		});
		expect(line).not.toContain('owner@example.com');
	});

	it('never asks who is calling', async () => {
		const actors = new FixedActorProvider(memberActor());

		await new MemberService(new InMemoryMemberRepository(), actors).ensureAdmin(
			'owner@example.com'
		);

		expect(actors.wasAsked).toBe(false);
	});
});
