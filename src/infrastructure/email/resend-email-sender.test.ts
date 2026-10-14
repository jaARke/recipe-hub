import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailDeliveryError, type EmailMessage } from '@/application/ports/email-sender';
import { ResendEmailSender } from '@/infrastructure/email/resend-email-sender';

type ReceivedRequest = { path?: string; headers: IncomingHttpHeaders; body: unknown };
type Reply = { status: number; body: object };

const message: EmailMessage = {
	to: 'grace@example.com',
	subject: 'Jake invited you to Barb’s Table',
	text: 'Open this link to create your account.',
	replyTo: 'jake@example.com',
	idempotencyKey: 'invite/0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
};

let server: Server;
let received: ReceivedRequest[];
let reply: Reply;

// Resend's API, played by a local server the SDK reaches through its own base URL setting.
beforeEach(async () => {
	received = [];
	reply = { status: 200, body: { id: 'email-id' } };
	server = createServer(async (request, response) => {
		let body = '';
		for await (const chunk of request) {
			body += chunk;
		}
		received.push({ path: request.url, headers: request.headers, body: JSON.parse(body) });
		response.writeHead(reply.status, { 'content-type': 'application/json' });
		response.end(JSON.stringify(reply.body));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	vi.stubEnv('RESEND_BASE_URL', `http://127.0.0.1:${port}`);
	// Outside production the SDK prints refused requests itself.
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await new Promise((resolve) => server.close(resolve));
});

function createSender(): ResendEmailSender {
	return new ResendEmailSender({ apiKey: 're_test', domain: 'recipes.example.com' });
}

describe('send', () => {
	it('sends plain text from the site address with the reply-to and idempotency key', async () => {
		await createSender().send(message);

		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({
			path: '/emails',
			headers: { 'idempotency-key': message.idempotencyKey },
			body: {
				from: 'Barb’s Table <recipes@recipes.example.com>',
				to: 'grace@example.com',
				subject: message.subject,
				text: message.text,
				reply_to: 'jake@example.com',
			},
		});
		expect(received[0]?.body).not.toHaveProperty('html');
	});

	it('throws a delivery error that keeps only the code and status of a refusal', async () => {
		reply = {
			status: 422,
			body: {
				statusCode: 422,
				name: 'validation_error',
				message: 'Invalid `to` field: grace@example',
			},
		};

		const error = await createSender()
			.send(message)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(EmailDeliveryError);
		expect((error as EmailDeliveryError).cause).toEqual({
			name: 'validation_error',
			statusCode: 422,
		});
	});

	it('throws a delivery error when the provider cannot be reached', async () => {
		await new Promise((resolve) => server.close(resolve));

		await expect(createSender().send(message)).rejects.toThrow(EmailDeliveryError);
	});
});
