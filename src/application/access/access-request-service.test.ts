import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AccessRequestService } from '@/application/access/access-request-service';
import { AccessRequestNotFoundError } from '@/application/access/errors';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import { actorFor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryAccessRequestRepository } from '@/application/testing/in-memory-access-request-repository';
import { InMemoryEmailSender } from '@/application/testing/in-memory-email-sender';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import type { AccessRequestFields } from '@/domain/member/access-request';

const appUrl = new URL('https://recipes.example.com');
const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-request-id';

const adaFields: AccessRequestFields = {
	name: 'Ada Lovelace',
	relationship: 'We met at the book club.',
	email: 'ada@example.com',
};

const refusedActors = [
	{ who: 'an anonymous visitor', actor: anonymousActor(), error: SignInRequiredError },
	{ who: 'a member who is not an admin', actor: memberActor(), error: ForbiddenError },
];

function createAccess() {
	const requests = new InMemoryAccessRequestRepository();
	const members = new InMemoryMemberRepository();
	const emails = new InMemoryEmailSender();
	const serviceFor = (actor: Actor) =>
		new AccessRequestService(requests, members, emails, new FixedActorProvider(actor), appUrl);
	return { requests, members, emails, serviceFor };
}

async function accessWithAdmin() {
	const access = createAccess();
	const admin = await access.members.create({
		email: 'jake@example.com',
		displayName: 'Jake',
		role: 'admin',
	});
	return { ...access, admin, adminService: access.serviceFor(actorFor(admin)) };
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

function loggedText(): string {
	return [...consoleInfo.mock.calls, ...consoleWarn.mock.calls]
		.map(([line]) => String(line))
		.join('\n');
}

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('submitRequest', () => {
	it('stores a pending request with the normalized fields', async () => {
		const { requests, serviceFor } = createAccess();

		await serviceFor(anonymousActor()).submitRequest({
			name: ' Ada Lovelace ',
			relationship: 'We met at the book club. ',
			email: ' Ada@Example.com',
		});

		expect(await requests.listPending()).toEqual([
			{ ...adaFields, id: expect.any(String), status: 'pending', createdAt: expect.any(Date) },
		]);
	});

	it('never asks who is calling', async () => {
		const { requests, members, emails } = createAccess();
		const actors = new FixedActorProvider(memberActor());

		await new AccessRequestService(requests, members, emails, actors, appUrl).submitRequest(
			adaFields
		);

		expect(actors.wasAsked).toBe(false);
	});

	it('rejects invalid fields with their paths and stores nothing', async () => {
		const { requests, serviceFor } = createAccess();

		await expect(
			serviceFor(anonymousActor()).submitRequest({
				name: ' ',
				relationship: 'Neighbor',
				email: 'x',
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: 'access.invalid-request',
				problems: [
					{ path: 'name', message: expect.any(String) },
					{ path: 'email', message: expect.any(String) },
				],
			})
		);
		expect(await requests.listPending()).toEqual([]);
	});

	it('emails every admin a notification that names who asked and links to the admin page', async () => {
		const { requests, members, emails, admin, serviceFor } = await accessWithAdmin();
		const secondAdmin = await members.create({
			email: 'grace@example.com',
			displayName: 'Grace',
			role: 'admin',
		});
		await members.create({ email: 'lin@example.com', displayName: 'Lin', role: 'member' });

		await serviceFor(anonymousActor()).submitRequest(adaFields);

		const [request] = await requests.listPending();
		const text =
			'Ada Lovelace asked for access to Recipe Hub.\n\n' +
			'Review the request on the admin page:\nhttps://recipes.example.com/admin';
		expect(emails.sentMessages).toEqual([
			{
				to: 'jake@example.com',
				subject: 'New access request',
				text,
				idempotencyKey: `access-request-notification/${request?.id}/${admin.id}`,
			},
			{
				to: 'grace@example.com',
				subject: 'New access request',
				text,
				idempotencyKey: `access-request-notification/${request?.id}/${secondAdmin.id}`,
			},
		]);
	});

	it('logs a failed notification, keeps the request, and still notifies the other admins', async () => {
		const { requests, members, emails, serviceFor } = await accessWithAdmin();
		await members.create({ email: 'grace@example.com', displayName: 'Grace', role: 'admin' });
		emails.failDeliveriesTo('jake@example.com');

		await expect(serviceFor(anonymousActor()).submitRequest(adaFields)).resolves.toBeUndefined();

		const [request] = await requests.listPending();
		expect(emails.sentMessages.map(({ to }) => to)).toEqual(['grace@example.com']);
		expect(consoleWarn).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toEqual({
			level: 'warn',
			logger: 'access',
			message: 'Access request notification failed',
			requestId: request?.id,
			err: expect.objectContaining({ code: 'email.delivery-failed' }),
		});
		expect(loggedText()).not.toContain('jake@example.com');
	});

	it('logs the request by its id alone', async () => {
		const { requests, serviceFor } = createAccess();

		await serviceFor(anonymousActor()).submitRequest(adaFields);

		const [request] = await requests.listPending();
		expect(consoleInfo).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
			level: 'info',
			logger: 'access',
			message: 'Access requested',
			requestId: request?.id,
		});
		expect(loggedText()).not.toMatch(/Ada|book club|ada@example\.com/);
	});
});

describe('listPendingRequests', () => {
	it.each(refusedActors)('refuses $who', async ({ actor, error }) => {
		const { serviceFor } = createAccess();

		await expect(serviceFor(actor).listPendingRequests()).rejects.toThrow(error);
	});

	it('lists pending requests oldest first for an admin', async () => {
		const { requests, adminService } = await accessWithAdmin();
		const ada = await requests.create(adaFields);
		const grace = await requests.create({ name: 'Grace Hopper', relationship: 'A neighbor.' });
		const lin = await requests.create({ name: 'Lin Chen', relationship: 'A cousin.' });
		await requests.markApproved(grace.id);

		const pending = await adminService.listPendingRequests();

		expect(pending).toEqual([
			{ ...adaFields, id: ada.id, createdAt: ada.createdAt },
			{ name: 'Lin Chen', relationship: 'A cousin.', id: lin.id, createdAt: lin.createdAt },
		]);
		expect(pending[0]).not.toHaveProperty('status');
	});
});

describe('declineRequest', () => {
	it.each(refusedActors)('refuses $who and keeps the request', async ({ actor, error }) => {
		const { requests, serviceFor } = createAccess();
		const request = await requests.create(adaFields);

		await expect(serviceFor(actor).declineRequest(request.id)).rejects.toThrow(error);
		expect(await requests.findById(request.id)).not.toBeNull();
	});

	it('deletes the request', async () => {
		const { requests, adminService } = await accessWithAdmin();
		const request = await requests.create(adaFields);

		await adminService.declineRequest(request.id);

		expect(await requests.findById(request.id)).toBeNull();
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const { adminService } = await accessWithAdmin();

		await expect(adminService.declineRequest(id)).rejects.toThrow(AccessRequestNotFoundError);
	});

	it('reports an approved request as not found and keeps it', async () => {
		const { requests, adminService } = await accessWithAdmin();
		const request = await requests.create(adaFields);
		await requests.markApproved(request.id);

		await expect(adminService.declineRequest(request.id)).rejects.toThrow(
			AccessRequestNotFoundError
		);
		expect(await requests.findById(request.id)).toMatchObject({ status: 'approved' });
	});

	it('logs the decline by ids alone', async () => {
		const { requests, admin, adminService } = await accessWithAdmin();
		const request = await requests.create(adaFields);

		await adminService.declineRequest(request.id);

		expect(JSON.parse(String(consoleInfo.mock.lastCall?.[0]))).toEqual({
			level: 'info',
			logger: 'access',
			message: 'Access request declined',
			requestId: request.id,
			memberId: admin.id,
		});
		expect(loggedText()).not.toMatch(/Ada|book club|ada@example\.com/);
	});
});
