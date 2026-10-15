import {
	RequestCookies,
	ResponseCookies,
	stringifyCookie,
} from 'next/dist/server/web/spec-extension/cookies';
import { describe, expect, it } from 'vitest';
import { recipeIdSchema, type RecipeId } from '@/domain/recipe/recipe';
import {
	CookieDeviceFavorites,
	type FavoritesCookieStore,
} from '@/infrastructure/cookies/cookie-device-favorites';
import { settings } from '@/lib/settings';

const soupId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const pieId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6f');
const saladId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d70');

const fourHundredDaysInSeconds = 34_560_000;

// Distinct ids, as many as asked for, each a uuid as Postgres prints it.
function recipeIds(count: number): RecipeId[] {
	return Array.from({ length: count }, (_, index) =>
		recipeIdSchema.parse(`0199c7a4-2c3e-7b1a-9f00-${index.toString(16).padStart(12, '0')}`)
	);
}

// The browser's cookies as Next's own classes read the request's and write the response's, which is
// what Next's cookies() does in a Server Action.
function browserWith(cookieHeader?: string) {
	const request = new RequestCookies(
		new Headers(cookieHeader === undefined ? {} : { cookie: cookieHeader })
	);
	const response = new ResponseCookies(new Headers());
	const store: FavoritesCookieStore = {
		get: (name) => response.get(name) ?? request.get(name),
		set: (name, value, attributes) => {
			response.set(name, value, attributes);
		},
	};
	const favorites = (secure = true) =>
		new CookieDeviceFavorites({ cookies: async () => store, secure });
	return { favorites, sent: () => response.get('favorites') };
}

describe('list', () => {
	it('reads nothing from a browser without the cookie', async () => {
		expect(await browserWith().favorites().list()).toEqual([]);
	});

	it('reads the ids it saved, newest first', async () => {
		const browser = browserWith();

		await browser.favorites().save([pieId, soupId]);

		expect(await browser.favorites().list()).toEqual([pieId, soupId]);
	});
});

describe('reading a tampered or malformed cookie', () => {
	it.each([
		{ what: 'an empty value', value: '' },
		{ what: 'text that is no id', value: 'favorite-recipes' },
		{ what: 'ids joined by commas', value: `${soupId},${pieId}` },
		{ what: 'JSON', value: encodeURIComponent(JSON.stringify([soupId])) },
		{ what: 'an id cut short', value: soupId.slice(0, -1) },
		{ what: 'broken percent-encoding', value: `${soupId}%E0%A4%A` },
	])('reads $what as no favorites', async ({ value }) => {
		expect(await browserWith(`favorites=${value}`).favorites().list()).toEqual([]);
	});

	it('keeps the well-formed ids, in their order, and drops the rest', async () => {
		const value = [saladId, 'not-an-id', '', ` ${pieId}`, soupId, `${pieId}x`].join('.');

		expect(await browserWith(`favorites=${value}`).favorites().list()).toEqual([saladId, soupId]);
	});

	it('reads a repeated id once, in any case', async () => {
		const value = [soupId, pieId, soupId.toUpperCase()].join('.');

		expect(await browserWith(`favorites=${value}`).favorites().list()).toEqual([soupId, pieId]);
	});

	it('reads no more ids than a device keeps, the newest first', async () => {
		const ids = recipeIds(settings.favorites.maxPerDevice + 5);

		const listed = await browserWith(`favorites=${ids.join('.')}`)
			.favorites()
			.list();

		expect(listed).toEqual(ids.slice(0, settings.favorites.maxPerDevice));
	});

	it('reads the cookie the site sets, not one of another name', async () => {
		const browser = browserWith(`favorite=${soupId}; favorites_old=${pieId}`);

		expect(await browser.favorites().list()).toEqual([]);
	});
});

describe('save', () => {
	it('sets an HttpOnly, SameSite=Lax cookie for the whole site, for 400 days', async () => {
		const browser = browserWith();

		await browser.favorites().save([soupId]);

		expect(browser.sent()).toMatchObject({
			name: 'favorites',
			value: soupId,
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			path: '/',
			maxAge: fourHundredDaysInSeconds,
		});
	});

	it('leaves Secure off where the site is served over HTTP', async () => {
		const browser = browserWith();

		await browser.favorites(false).save([soupId]);

		expect(browser.sent()).toMatchObject({ secure: false, maxAge: fourHundredDaysInSeconds });
	});

	it('renews the 400 days on every change', async () => {
		const browser = browserWith(`favorites=${soupId}`);

		await browser.favorites().save([pieId, soupId]);

		expect(browser.sent()).toMatchObject({
			value: `${pieId}.${soupId}`,
			maxAge: fourHundredDaysInSeconds,
		});
	});

	it('keeps a full device within the 4,096 bytes a browser keeps of a cookie', async () => {
		const browser = browserWith();
		const ids = recipeIds(settings.favorites.maxPerDevice);

		await browser.favorites().save(ids);

		const sent = browser.sent();
		expect(sent?.value).toBe(ids.join('.'));
		expect(stringifyCookie(sent!).length).toBeLessThanOrEqual(4096);
	});

	it('refuses more ids than a device keeps, setting nothing', async () => {
		const browser = browserWith();

		await expect(
			browser.favorites().save(recipeIds(settings.favorites.maxPerDevice + 1))
		).rejects.toThrow('A device keeps at most settings.favorites.maxPerDevice favorites');
		expect(browser.sent()).toBeUndefined();
	});

	it('expires the cookie when saving none', async () => {
		const browser = browserWith(`favorites=${soupId}`);

		await browser.favorites().save([]);

		expect(browser.sent()).toMatchObject({ value: '', maxAge: 0, path: '/' });
		expect(await browser.favorites().list()).toEqual([]);
	});
});

describe('clear', () => {
	it('expires the cookie with the attributes it was set with', async () => {
		const browser = browserWith(`favorites=${soupId}`);

		await browser.favorites().clear();

		expect(browser.sent()).toMatchObject({
			name: 'favorites',
			value: '',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			path: '/',
			maxAge: 0,
		});
		expect(await browser.favorites().list()).toEqual([]);
	});
});
