import 'server-only';
import type { DeviceFavorites } from '@/application/ports/device-favorites';
import { recipeIdSchema, type RecipeId } from '@/domain/recipe/recipe';
import { settings } from '@/lib/settings';

const cookieName = 'favorites';

// Browsers keep a cookie for 400 days at most, so each change renews it for that long.
const lifetimeSeconds = 400 * 24 * 60 * 60;

// Left as it is by the cookie's URI encoding, so each id takes 37 bytes, as the settings schema's
// range for maxPerDevice counts.
const separator = '.';

type FavoritesCookieAttributes = {
	httpOnly: true;
	sameSite: 'lax';
	secure: boolean;
	path: '/';
	maxAge: number;
};

// The part of the request's cookies, from Next's cookies(), that the adapter uses.
export type FavoritesCookieStore = {
	get(name: string): { value: string } | undefined;
	set(name: string, value: string, attributes: FavoritesCookieAttributes): void;
};

type CookieDeviceFavoritesOptions = {
	// Setting the cookie works only where a response carries it, in a Server Action or a Route Handler.
	cookies: () => Promise<FavoritesCookieStore>;
	// Whether the cookie travels over HTTPS alone.
	secure: boolean;
};

// The well-formed ids, lowercased as Postgres prints them, each once and up to the cap. Anything else
// in the value is dropped, so a tampered cookie reads as what survives rather than failing the page.
function parseRecipeIds(value: string): RecipeId[] {
	const ids = new Set<RecipeId>();
	for (const part of value.split(separator)) {
		if (ids.size === settings.favorites.maxPerDevice) {
			break;
		}

		const parsed = recipeIdSchema.safeParse(part.toLowerCase());
		if (parsed.success) {
			ids.add(parsed.data);
		}
	}
	return [...ids];
}

// Only the server's response sets the cookie, and HttpOnly keeps script from writing it: Safari
// deletes what script writes after seven days without a visit, but keeps this for its lifetime.
export class CookieDeviceFavorites implements DeviceFavorites {
	private readonly cookies: () => Promise<FavoritesCookieStore>;
	private readonly secure: boolean;

	constructor(options: CookieDeviceFavoritesOptions) {
		this.cookies = options.cookies;
		this.secure = options.secure;
	}

	async list(): Promise<RecipeId[]> {
		const value = (await this.cookies()).get(cookieName)?.value;
		return value === undefined ? [] : parseRecipeIds(value);
	}

	async save(recipeIds: readonly RecipeId[]): Promise<void> {
		if (recipeIds.length > settings.favorites.maxPerDevice) {
			throw new Error('A device keeps at most settings.favorites.maxPerDevice favorites');
		}
		if (recipeIds.length === 0) {
			return this.clear();
		}

		(await this.cookies()).set(
			cookieName,
			recipeIds.join(separator),
			this.attributes(lifetimeSeconds)
		);
	}

	// Expires the cookie with the attributes it was set with, which browsers match it by.
	async clear(): Promise<void> {
		(await this.cookies()).set(cookieName, '', this.attributes(0));
	}

	private attributes(maxAge: number): FavoritesCookieAttributes {
		return { httpOnly: true, sameSite: 'lax', secure: this.secure, path: '/', maxAge };
	}
}
