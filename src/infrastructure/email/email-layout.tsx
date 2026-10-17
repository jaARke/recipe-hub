import 'server-only';
import type { CSSProperties, ReactNode } from 'react';
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from 'react-email';
import { siteName } from '@/lib/site';
import { tokenColors } from '@/lib/token-colors';

// What a template writes for one message; the layout around it is the same for every kind.
export type EmailParts = {
	subject: string;
	// Shown after the subject in an inbox.
	preview: string;
	heading: string;
	body: ReactNode;
	// Why the message came.
	footer: string;
};

const colors = tokenColors.light;

// Most email clients load no web fonts, so each stack names system fonts in place of the site's.
const sansSerif =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";
const monospace = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

// public/email/lockup.png, made at twice this size (assets/brand/SOURCES.md).
const lockupPath = '/email/lockup.png';
const lockupWidth = 233;
const lockupHeight = 35;

const styles = {
	body: { backgroundColor: colors.background, margin: 0, padding: '24px 0' },
	column: { maxWidth: '600px', padding: '0 24px', fontFamily: sansSerif },
	// Shown in place of the lockup when a client blocks images.
	lockupAltText: { color: colors.foreground, fontSize: '20px', fontWeight: 600 },
	heading: {
		margin: '32px 0 16px',
		color: colors.foreground,
		fontFamily: serif,
		fontSize: '24px',
		lineHeight: '32px',
		fontWeight: 600,
	},
	text: { margin: '0 0 16px', color: colors.foreground, fontSize: '16px', lineHeight: '24px' },
	code: {
		display: 'inline-block',
		margin: '0 0 16px',
		padding: '8px 16px',
		border: `1px solid ${colors.border}`,
		borderRadius: '10px',
		backgroundColor: colors.muted,
		color: colors.foreground,
		fontFamily: monospace,
		fontSize: '32px',
		lineHeight: '40px',
		fontWeight: 600,
		letterSpacing: '6px',
	},
	action: { margin: '8px 0 24px' },
	button: {
		padding: '12px 20px',
		borderRadius: '10px',
		backgroundColor: colors.primary,
		// The primary foreground token is the background's.
		color: colors.background,
		fontSize: '16px',
		fontWeight: 600,
	},
	url: {
		margin: '12px 0 0',
		color: colors.mutedForeground,
		fontSize: '14px',
		lineHeight: '20px',
		wordBreak: 'break-all',
	},
	urlLink: { color: colors.mutedForeground, textDecoration: 'underline' },
	rule: { margin: '32px 0 16px', borderTop: `1px solid ${colors.border}` },
	footer: { margin: 0, color: colors.mutedForeground, fontSize: '14px', lineHeight: '20px' },
} satisfies Record<string, CSSProperties>;

export function EmailText({ children }: { children: ReactNode }) {
	return <Text style={styles.text}>{children}</Text>;
}

// One text node, so a reader copies the code whole.
export function EmailCode({ code }: { code: string }) {
	return <Text style={styles.code}>{code}</Text>;
}

// A message's one button, with its URL printed below for clients that do not draw the button.
export function EmailAction({ href, label }: { href: string; label: string }) {
	return (
		<Section style={styles.action}>
			<Button href={href} style={styles.button}>
				{label}
			</Button>
			<Text style={styles.url}>
				<Link href={href} style={styles.urlLink}>
					{href}
				</Link>
			</Text>
		</Section>
	);
}

// A column on the site's cream, the lockup above it. A client's dark mode may repaint the background
// and leave images alone, so the lockup is transparent, its mascot and wordmark each with a cream
// edge that disappears on the cream and outlines them on a dark background. The images come from
// the public site, since previews ask for a Vercel sign-in.
export function EmailLayout({
	parts,
	siteUrl,
}: {
	parts: Omit<EmailParts, 'subject'>;
	siteUrl: URL;
}) {
	return (
		<Html lang="en">
			<Head>
				{/* The design has one scheme; clients that honor this leave its colors alone. */}
				<meta name="color-scheme" content="light" />
				<meta name="supported-color-schemes" content="light" />
			</Head>
			<Body style={styles.body}>
				<Preview>{parts.preview}</Preview>
				<Container style={styles.column}>
					<Img
						src={new URL(lockupPath, siteUrl).href}
						width={lockupWidth}
						height={lockupHeight}
						alt={siteName}
						style={styles.lockupAltText}
					/>
					<Heading as="h1" style={styles.heading}>
						{parts.heading}
					</Heading>
					{parts.body}
					<Hr style={styles.rule} />
					<Text style={styles.footer}>{parts.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
}
