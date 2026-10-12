import 'server-only';
import { Resend } from 'resend';
import {
	EmailDeliveryError,
	type EmailMessage,
	type EmailSender,
} from '@/application/ports/email-sender';
import { siteName } from '@/lib/site';

type ResendEmailSenderOptions = {
	apiKey: string;
	// A domain verified in Resend; mail comes from an address on it.
	domain: string;
};

// Outside production the SDK also prints refused requests to the console itself; deployments run in
// production mode, so only a local dev server prints them.
export class ResendEmailSender implements EmailSender {
	private readonly resend: Resend;
	private readonly from: string;

	constructor(options: ResendEmailSenderOptions) {
		this.resend = new Resend(options.apiKey);
		this.from = `${siteName} <recipes@${options.domain}>`;
	}

	async send(message: EmailMessage): Promise<void> {
		const { error } = await this.resend.emails.send(
			{
				from: this.from,
				to: message.to,
				subject: message.subject,
				text: message.text,
				replyTo: message.replyTo,
			},
			{ idempotencyKey: message.idempotencyKey }
		);
		if (error !== null) {
			// Resend's messages can quote an address, and services log the cause, so it keeps only the code.
			throw new EmailDeliveryError({
				cause: { name: error.name, statusCode: error.statusCode },
			});
		}
	}
}
