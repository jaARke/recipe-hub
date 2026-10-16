// What a deployment reaches besides its own image environment.
type ImageEnvironmentAccess = {
	// The environments in its own store whose images it also serves.
	readableEnvironments: readonly string[];
	// The environments whose images it fetches from production's public image route and serves.
	fetchedFromProduction: readonly string[];
	// Whether each write's background task sweeps once it is done. Vercel runs crons only on
	// production, whose daily cleanup sweeps instead.
	sweepsAfterWrites: boolean;
};

// Pathnames are never reused, so a stored image never changes and every cache may keep it a year.
export const imageCacheMaxAgeSeconds = 365 * 24 * 60 * 60;

// Production's image environment, whose images previews fetch from production's public image route.
export const productionImageEnvironment = 'production';

// Local development's image environment, outside every deployment's.
export const developmentImageEnvironment = 'development';

// A preview's image environment is preview/<branch folder>, so each branch's folders are its own.
export const previewImageEnvironmentPrefix = 'preview/';

// The seed's photos sit in their own environment, outside every deployment's folders.
export const seedImageEnvironment = 'seed';

// A removed image moves here under its own pathname, so each environment's removed images sit in
// its own folders under this one, trash/dish/production/<uuid>.jpg, and a restore takes the
// pathname back. The image route serves only the role folders, never this one.
export const trashFolder = 'trash/';

// Under a role's folder, an environment's folder, or with a shorter prefix such as preview/ the
// folder of every environment it takes in: dish/production/, scan/preview/.
export function roleFolder(role: string, environmentPrefix: string): string {
	return `${role}/${environmentPrefix}`;
}

// By Vercel's environment, each with a store of its own. Production reads only its own images. A
// preview's store holds its uploads and the seed's photos, and its database, a copy of
// production's, names production's photos and scans, which it fetches from production.
// Development reads its own and the seed's.
export const imageEnvironmentAccess = {
	production: {
		readableEnvironments: [],
		fetchedFromProduction: [],
		sweepsAfterWrites: false,
	},
	preview: {
		readableEnvironments: [seedImageEnvironment],
		fetchedFromProduction: [productionImageEnvironment],
		sweepsAfterWrites: true,
	},
	development: {
		readableEnvironments: [seedImageEnvironment],
		fetchedFromProduction: [],
		sweepsAfterWrites: true,
	},
} as const satisfies Record<'production' | 'preview' | 'development', ImageEnvironmentAccess>;

// The image route's URL for a stored image, which Vercel's image optimizer also keys its copies by.
export function imageRouteSrc(pathname: string): string {
	return `/api/images/${pathname}`;
}

// The CDN cache tag on the image route's responses for a stored image, so deleting it can purge them.
export function imageCacheTag(pathname: string): string {
	return `image:${pathname}`;
}
