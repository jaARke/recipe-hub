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
	// Where the emails' images are served from.
	siteUrl: URL;
};

// Outside production the SDK also prints refused requests to the console itself; deployments run in
// production mode, so only a local dev server prints them.
export class ResendEmailSender implements EmailSender {
	private readonly resend: Resend;
	private readonly from: string;
	private readonly siteUrl: URL;

	constructor(options: ResendEmailSenderOptions) {
		this.resend = new Resend(options.apiKey);
		this.from = `${siteName} <recipes@${options.domain}>`;
		this.siteUrl = options.siteUrl;
	}

	async send(message: EmailMessage): Promise<void> {
		// Every page's server code builds this sender, so the renderer loads only once a message is sent.
		const { renderEmail } = await import('@/infrastructure/email/render-email');
		const { subject, html, text } = await renderEmail(message, this.siteUrl);

		const { error } = await this.resend.emails.send(
			{
				from: this.from,
				to: message.to,
				subject,
				html,
				text,
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
