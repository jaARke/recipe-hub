import 'server-only';
import { render, toPlainText } from 'react-email';
import type { EmailContent, EmailKind } from '@/application/ports/email-sender';
import { EmailLayout } from '@/infrastructure/email/email-layout';
import { emailTemplates } from '@/infrastructure/email/email-templates';

export type RenderedEmail = { subject: string; html: string; text: string };

// The heading keeps its case. Every link is a button, whose URL is printed below it, or that URL
// itself, so the text part gives each link's words alone.
const textOptions = {
	selectors: [
		{ selector: 'h1', options: { uppercase: false } },
		{ selector: 'a', options: { ignoreHref: true } },
	],
};

// The text part is read from the HTML part, so both say the same thing.
export async function renderEmail<Kind extends EmailKind>(
	content: EmailContent<Kind>,
	siteUrl: URL
): Promise<RenderedEmail> {
	const { subject, ...parts } = emailTemplates[content.kind](content.data);
	const html = await render(<EmailLayout parts={parts} siteUrl={siteUrl} />);
	return { subject, html, text: toPlainText(html, textOptions) };
}
