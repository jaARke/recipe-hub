import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { recipeSearchParamNames } from '@/components/search/search-params';
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

	it.each([
		{
			where: 'a search without words',
			url: '/search?chapter=desserts&holiday=christmas',
			location: '/?chapter=desserts&holiday=christmas',
		},
		{
			where: 'a search emptied in the header',
			url: '/search?q=&diet=vegan&sort=title',
			location: '/?diet=vegan&sort=title',
		},
		{
			where: 'Browse given words',
			url: '/?q=lemon&chapter=desserts',
			location: '/search?q=lemon&chapter=desserts',
		},
		{
			where: 'an older link’s search without words, dropping its tags',
			url: '/search?tag=Dessert',
			location: '/',
		},
	])('redirects $where to the list it belongs on, with its filters', ({ url, location }) => {
		const response = proxy(new NextRequest(`https://recipes.example.com${url}`));

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(`https://recipes.example.com${location}`);
	});

	it.each([
		'/?chapter=desserts',
		'/search?q=lemon&chapter=desserts',
		'/search?sort=relevance',
		'/?q=lemon&chapter=nope',
	])('lets %s through to its page, signed out', (url) => {
		const response = proxy(new NextRequest(`https://recipes.example.com${url}`));

		expect(response.headers.get('location')).toBeNull();
		expect(response.headers.get('x-middleware-next')).toBe('1');
	});

	it('runs on Browse only with the query, so a list without words skips it', () => {
		expect(config.matcher).toContainEqual({
			source: '/',
			has: [{ type: 'query', key: recipeSearchParamNames.text }],
		});
		expect(config.matcher).toContain('/search');
	});
});
