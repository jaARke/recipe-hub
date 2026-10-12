// Pathnames are never reused, so a stored image never changes and every cache may keep it a year.
export const imageCacheMaxAgeSeconds = 365 * 24 * 60 * 60;

// The image route's URL for a stored image, which Vercel's image optimizer also keys its copies by.
export function imageRouteSrc(pathname: string): string {
	return `/api/images/${pathname}`;
}

// The CDN cache tag on the image route's responses for a stored image, so deleting it can purge them.
export function imageCacheTag(pathname: string): string {
	return `image:${pathname}`;
}
