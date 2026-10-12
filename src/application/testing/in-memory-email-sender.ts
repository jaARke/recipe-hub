import {
	EmailDeliveryError,
	type EmailMessage,
	type EmailSender,
} from '@/application/ports/email-sender';

// Records what it sends, and refuses the addresses a test names, as a provider would.
export class InMemoryEmailSender implements EmailSender {
	private readonly messages: EmailMessage[] = [];
	private readonly refusedAddresses = new Set<string>();

	get sentMessages(): readonly EmailMessage[] {
		return this.messages;
	}

	failDeliveriesTo(address: string): void {
		this.refusedAddresses.add(address);
	}

	async send(message: EmailMessage): Promise<void> {
		if (this.refusedAddresses.has(message.to)) {
			throw new EmailDeliveryError();
		}

		this.messages.push(message);
	}
}
