import 'server-only';

// A Route Handler's 404, which no cache keeps.
export function notFoundResponse(): Response {
	return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
