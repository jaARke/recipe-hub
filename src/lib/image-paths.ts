// Pathnames are never reused, so a stored image never changes and every cache may keep it a year.
export const imageCacheMaxAgeSeconds = 365 * 24 * 60 * 60;

// Production's image environment, which every other deployment also reads.
export const productionImageEnvironment = 'production';

// Local development's image environment, outside every deployment's.
export const developmentImageEnvironment = 'development';

// A preview's image environment is preview/<branch folder>, so each branch's folders are its own.
export const previewImageEnvironmentPrefix = 'preview/';

// The seed's photos sit in their own environment, outside every deployment's folders.
export const seedImageEnvironment = 'seed';

// The image route's URL for a stored image, which Vercel's image optimizer also keys its copies by.
export function imageRouteSrc(pathname: string): string {
	return `/api/images/${pathname}`;
}

// The CDN cache tag on the image route's responses for a stored image, so deleting it can purge them.
export function imageCacheTag(pathname: string): string {
	return `image:${pathname}`;
}
