import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from '@/proxy';

describe('proxy', () => {
	it('sends a visitor without a session to sign in, naming the page and its query', () => {
		const response = proxy(new NextRequest('https://recipes.example.com/admin/invites?tab=open'));

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(
			'https://recipes.example.com/sign-in?next=%2Fadmin%2Finvites%3Ftab%3Dopen'
		);
	});

	it.each([
		{ where: 'an HTTPS deployment', name: '__Host-better-auth.session_token' },
		{ where: 'the dev server', name: 'better-auth.session_token' },
	])('lets a request with the session cookie $where sets through', ({ name }) => {
		const response = proxy(
			new NextRequest('https://recipes.example.com/account', {
				headers: { cookie: `favorites=recipe-id; ${name}=token.signature` },
			})
		);

		expect(response.headers.get('location')).toBeNull();
		expect(response.headers.get('x-middleware-next')).toBe('1');
	});

	it('sends a visitor whose cookies hold no session to sign in', () => {
		const response = proxy(
			new NextRequest('https://recipes.example.com/account', {
				headers: { cookie: 'favorites=recipe-id; __Host-better-auth.better-auth-passkey=token' },
			})
		);

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(
			'https://recipes.example.com/sign-in?next=%2Faccount'
		);
	});

	it('runs only on the pages that need a session, so the Recipes page’s requests skip it', () => {
		expect(config.matcher).toEqual([
			'/contribute/:path*',
			'/recipes/:slug/edit',
			'/admin/:path*',
			'/account/:path*',
		]);
	});
});
