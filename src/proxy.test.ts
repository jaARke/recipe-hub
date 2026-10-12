import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';

describe('proxy', () => {
	it('sends a visitor without a session to sign in, naming the page and its query', () => {
		const response = proxy(new NextRequest('https://recipes.example.com/admin/invites?tab=open'));

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(
			'https://recipes.example.com/sign-in?next=%2Fadmin%2Finvites%3Ftab%3Dopen'
		);
	});

	it('lets a request with a session cookie through', () => {
		const response = proxy(
			new NextRequest('https://recipes.example.com/account', {
				headers: { cookie: '__Secure-better-auth.session_token=token.signature' },
			})
		);

		expect(response.headers.get('location')).toBeNull();
		expect(response.headers.get('x-middleware-next')).toBe('1');
	});
});
