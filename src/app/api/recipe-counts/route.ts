import type { NextRequest } from 'next/server';
import { readRecipeCounts } from '@/app/_lib/recipe-cache';
import { notFoundResponse } from '@/app/_lib/route-responses';
import { parseRecipeSearchParams, toRecipeCountsInput } from '@/components/search/search-params';
import { routeSearchParams } from '@/lib/url-query';

// The filter sheet's live count: what the Recipes page at the same query would count, without its
// recipes. It refuses what the page refuses.
export async function GET(request: NextRequest) {
	const state = parseRecipeSearchParams(routeSearchParams(request.nextUrl.searchParams));
	if (state === null) {
		return notFoundResponse();
	}

	const counts = await readRecipeCounts(toRecipeCountsInput(state));
	if (counts === null) {
		return notFoundResponse();
	}

	// Kept only by the cache it was read through, which writes clear, as the page's list is, so the
	// count never runs ahead of or behind the page it leads to.
	return Response.json(counts, { headers: { 'Cache-Control': 'no-store' } });
}
