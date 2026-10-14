import 'server-only';
import { AppError } from '@/lib/errors';

// The facts each kind of message carries; the sender's templates word them.
export type EmailData = {
	'sign-in-code': { code: string; lifetimeMinutes: number };
	invite: { inviteeName: string; inviterName: string; link: string; expiresAt: Date };
	// Names who asked and nothing more; the request itself stays on the admin page.
	'access-request': { requesterName: string; reviewLink: string };
};

export type EmailKind = keyof EmailData;

export type EmailContent<Kind extends EmailKind = EmailKind> = {
	[Each in Kind]: { kind: Each; data: EmailData[Each] };
}[Kind];

export type EmailMessage = EmailContent & {
	to: string;
	replyTo?: string;
	// Sending again with the same key within a day delivers the message once.
	idempotencyKey?: string;
};

export class EmailDeliveryError extends AppError {
	readonly code = 'email.delivery-failed';

	constructor(options?: ErrorOptions) {
		super('Email could not be delivered', options);
	}
}

export interface EmailSender {
	// Throws EmailDeliveryError when the provider refuses the message or cannot be reached.
	send(message: EmailMessage): Promise<void>;
}
