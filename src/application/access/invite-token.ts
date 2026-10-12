import 'server-only';
import { z } from 'zod';

const inviteTokenBytes = 32;

// 32 bytes in base64url without padding.
const inviteTokenSchema = z.string().regex(/^[\w-]{43}$/);

// The link carries the token and the database keeps only its hash, so a stolen row opens nothing.
export function createInviteToken(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(inviteTokenBytes))).toString(
		'base64url'
	);
}

// Tokens arrive from links, so anything else names no invite.
export function isInviteToken(token: unknown): token is string {
	return inviteTokenSchema.safeParse(token).success;
}

// SHA-256 as hex. A token holds 256 random bits, so it needs no salt or slow hash.
export async function hashInviteToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Buffer.from(digest).toString('hex');
}
