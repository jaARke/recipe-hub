// What a deployment reaches besides its own image environment.
type ImageEnvironmentAccess = {
	// The environments whose images it also serves.
	readableEnvironments: readonly string[];
	// The prefixes of the environments whose old images it deletes.
	expiringEnvironmentPrefixes: readonly string[];
	// Whether each write's background task sweeps once it is done. Vercel runs crons only on
	// production, whose daily cleanup sweeps instead.
	sweepsAfterWrites: boolean;
};

// Pathnames are never reused, so a stored image never changes and every cache may keep it a year.
export const imageCacheMaxAgeSeconds = 365 * 24 * 60 * 60;

// Production's image environment, which previews also read.
export const productionImageEnvironment = 'production';

// Local development's image environment, outside every deployment's.
export const developmentImageEnvironment = 'development';

// A preview's image environment is preview/<branch folder>, so each branch's folders are its own.
export const previewImageEnvironmentPrefix = 'preview/';

// The seed's photos sit in their own environment, outside every deployment's folders.
export const seedImageEnvironment = 'seed';

// By Vercel's environment. Previews share production's store, so they read production's photos,
// which their databases' copied recipes name, and the seed's. Production reads only its own and
// expires every preview's, which covers branches pushed without a pull request too. Development's
// store is its own, holding only its images and the seed's.
export const imageEnvironmentAccess = {
	production: {
		readableEnvironments: [],
		expiringEnvironmentPrefixes: [previewImageEnvironmentPrefix],
		sweepsAfterWrites: false,
	},
	preview: {
		readableEnvironments: [productionImageEnvironment, seedImageEnvironment],
		expiringEnvironmentPrefixes: [],
		sweepsAfterWrites: true,
	},
	development: {
		readableEnvironments: [seedImageEnvironment],
		expiringEnvironmentPrefixes: [],
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
