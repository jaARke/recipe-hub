import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import { MemberNotFoundError } from '@/application/members/errors';
import { MemberService } from '@/application/members/member-service';
import type { Actor } from '@/application/ports/actor-provider';
import { actorFor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';

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

let consoleInfo: MockInstance<typeof console.info>;

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
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
	it.each([
		{ who: 'an anonymous visitor', actor: anonymousActor(), error: SignInRequiredError },
		{ who: 'a member who is not an admin', actor: memberActor(), error: ForbiddenError },
	])('refuses $who', async ({ actor, error }) => {
		const { serviceFor } = createMembers();

		await expect(serviceFor(actor).listMembers()).rejects.toThrow(error);
	});

	it('lists every member oldest first for an admin', async () => {
		const { members, ada, serviceFor } = await membersWithAda();
		const grace = await members.create({
			email: 'grace@example.com',
			displayName: 'Grace',
			role: 'admin',
		});

		expect(await serviceFor(actorFor(grace)).listMembers()).toEqual([
			{
				id: ada.id,
				displayName: 'Ada',
				email: 'ada@example.com',
				role: 'member',
				createdAt: ada.createdAt,
			},
			{
				id: grace.id,
				displayName: 'Grace',
				email: 'grace@example.com',
				role: 'admin',
				createdAt: grace.createdAt,
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
