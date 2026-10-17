import { load, type CheerioAPI } from 'cheerio/slim';
import { describe, expect, it } from 'vitest';
import { renderEmail } from '@/infrastructure/email/render-email';

const siteUrl = new URL('https://site.example.com');
const inviteLink = 'https://recipes.example.com/invite#token';
const reviewLink = 'https://recipes.example.com/admin';

// The hidden text an inbox shows after the subject, before the padding that follows it.
function previewText($: CheerioAPI): string {
	return $('body div[data-skip-in-text]').first().contents().first().text();
}

function lockup($: CheerioAPI) {
	const image = $('img');
	return {
		count: image.length,
		src: image.attr('src'),
		width: image.attr('width'),
		height: image.attr('height'),
		alt: image.attr('alt'),
	};
}

// The button's link, and the URL printed in the paragraph right after it.
function action($: CheerioAPI, label: string) {
	const button = $('a').filter((_, link) => $(link).text() === label);
	const url = button.next('p').find('a');
	return {
		buttons: $('a').not('p a').length,
		href: button.attr('href'),
		printedUrl: url.text(),
		printedUrlHref: url.attr('href'),
	};
}

function footer($: CheerioAPI): string {
	return $('hr').nextAll('p').text();
}

describe('renderEmail', () => {
	it('renders a sign-in code with the code in its subject and as one monospace text node', async () => {
		const email = await renderEmail(
			{ kind: 'sign-in-code', data: { code: '482915', lifetimeMinutes: 30 } },
			siteUrl
		);
		const $ = load(email.html);
		const code = $('p').filter((_, paragraph) => $(paragraph).text() === '482915');

		expect(email.subject).toBe('482915 is your Barb’s Table sign-in code');
		expect(email.text).toBe(
			'Your sign-in code\n\n' +
				'Enter this code to sign in to Barb’s Table:\n\n' +
				'482915\n\n' +
				'It expires in 30 minutes.\n\n' +
				'----------------------------------------\n\n' +
				'You’re getting this email because someone asked to sign in to Barb’s Table with this address. If you didn’t ask for a code, you can ignore this email.'
		);
		expect(previewText($)).toBe('It expires in 30 minutes.');
		expect(code).toHaveLength(1);
		expect(
			code
				.contents()
				.toArray()
				.map((node) => node.type)
		).toEqual(['text']);
		expect(code.css('font-family')).toMatch(/monospace$/);
		expect($('a')).toHaveLength(0);
		expect(footer($)).toBe(
			'You’re getting this email because someone asked to sign in to Barb’s Table with this address. If you didn’t ask for a code, you can ignore this email.'
		);
	});

	it('renders an invite with its link as the one button, printed below it, and its expiry in the site’s zone', async () => {
		const email = await renderEmail(
			{
				kind: 'invite',
				// Evening in New York, so the date shows the site's zone, not UTC.
				data: {
					inviteeName: 'Ada',
					inviterName: 'Jake',
					link: inviteLink,
					expiresAt: new Date('2026-10-20T01:30:00Z'),
				},
			},
			siteUrl
		);
		const $ = load(email.html);

		expect(email.subject).toBe('Jake invited you to Barb’s Table');
		expect(email.text).toBe(
			'You’re invited\n\n' +
				'Hi Ada,\n\n' +
				'Jake invited you to Barb’s Table, where you can add recipes to the shared collection.\n\n' +
				'Create your account\n\n' +
				`${inviteLink}\n\n` +
				'The link works once and expires on October 19, 2026. To reach Jake, reply to this email.\n\n' +
				'----------------------------------------\n\n' +
				'You’re getting this email because Jake invited this address to Barb’s Table.'
		);
		expect(previewText($)).toBe('Create your account to add recipes to the shared collection.');
		expect(action($, 'Create your account')).toEqual({
			buttons: 1,
			href: inviteLink,
			printedUrl: inviteLink,
			printedUrlHref: inviteLink,
		});
		expect(footer($)).toBe(
			'You’re getting this email because Jake invited this address to Barb’s Table.'
		);
	});

	it('renders an access request that names who asked and links to the admin page', async () => {
		const email = await renderEmail(
			{ kind: 'access-request', data: { requesterName: 'Ada Lovelace', reviewLink } },
			siteUrl
		);
		const $ = load(email.html);

		expect(email.subject).toBe('New access request');
		expect(email.text).toBe(
			'New access request\n\n' +
				'Ada Lovelace asked for access to Barb’s Table.\n\n' +
				'Review the request\n\n' +
				`${reviewLink}\n\n` +
				'----------------------------------------\n\n' +
				'You’re getting this email because you’re an admin of Barb’s Table.'
		);
		expect(previewText($)).toBe('Ada Lovelace asked for access to Barb’s Table.');
		expect(action($, 'Review the request')).toEqual({
			buttons: 1,
			href: reviewLink,
			printedUrl: reviewLink,
			printedUrlHref: reviewLink,
		});
		expect(footer($)).toBe('You’re getting this email because you’re an admin of Barb’s Table.');
	});

	it('heads every kind with the lockup from the site, at its display size, named for the site', async () => {
		const emails = await Promise.all([
			renderEmail({ kind: 'sign-in-code', data: { code: '482915', lifetimeMinutes: 30 } }, siteUrl),
			renderEmail(
				{
					kind: 'invite',
					data: {
						inviteeName: 'Ada',
						inviterName: 'Jake',
						link: inviteLink,
						expiresAt: new Date(),
					},
				},
				siteUrl
			),
			renderEmail({ kind: 'access-request', data: { requesterName: 'Ada', reviewLink } }, siteUrl),
		]);

		for (const email of emails) {
			expect(lockup(load(email.html))).toEqual({
				count: 1,
				src: 'https://site.example.com/email/lockup.png',
				width: '263',
				height: '70',
				alt: 'Barb’s Table',
			});
		}
	});
});
