import 'server-only';
import { AppError } from '@/lib/errors';

export type EmailMessage = {
	to: string;
	subject: string;
	// Plain text only: short transactional messages need no HTML part.
	text: string;
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
