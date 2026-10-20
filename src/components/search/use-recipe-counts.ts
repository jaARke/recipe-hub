'use client';

import * as React from 'react';
import { z } from 'zod';
import { recipeCountsPath } from '@/components/recipe/recipe-paths';
import type { RecipeFilterCounts } from '@/components/search/recipe-filter-counts';
import { requestWithin } from '@/lib/deadline';
import { hrefWithParams } from '@/lib/url-query';

// After the last change, so ticking several boxes in a row asks once.
const recipeCountsDebounceMs = 300;

// Longer than a count takes with a cold database, and short enough that Show soon reads as applying
// without one.
const recipeCountsTimeLimitMs = 10_000;

// A view's total and each option's count: the page's own, or the counts route's answer.
export type RecipeFilterTally = {
	total: number;
	counts: RecipeFilterCounts;
};

// Asks for a query's tally, rejecting once the signal aborts it.
export type RecipeCountsReader = (query: string, signal: AbortSignal) => Promise<RecipeFilterTally>;

// What the counts route answers, as far as Filter and sort reads it, checked as it arrives, since the
// page that asks may be an earlier deployment's.
const countSchema = z.number().int().nonnegative();
const countsByValueSchema = z.record(z.string(), countSchema);
const recipeFilterTallySchema = z.object({
	total: countSchema,
	counts: z.object({
		holidays: countsByValueSchema,
		diets: countsByValueSchema,
		totalTimes: countsByValueSchema,
		sources: z.array(z.object({ label: z.string(), count: countSchema })),
		contributors: z.array(z.object({ memberId: z.string(), count: countSchema })),
	}),
});

// The counts route's tally for the query, rejecting when it refuses the query, fails, or answers in a
// shape it never gives.
export const fetchRecipeCounts: RecipeCountsReader = async (query, signal) => {
	const response = await fetch(hrefWithParams(recipeCountsPath, new URLSearchParams(query)), {
		signal,
	});
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`The recipe counts route answered with status ${response.status}`);
	}

	return recipeFilterTallySchema.parse(await response.json());
};

// The tally for a query, within the time limit and until the cancellation, which aborts the request.
export function requestRecipeCounts(
	query: string,
	readCounts: RecipeCountsReader,
	cancellation: AbortSignal
): Promise<RecipeFilterTally> {
	return requestWithin(
		(signal) => readCounts(query, signal),
		{ timeLimitMs: recipeCountsTimeLimitMs, cancellation },
		() => new Error(`Counting the recipes took over ${recipeCountsTimeLimitMs / 1000} seconds`)
	);
}

// What is known of a query's tally.
export type RecipeCountsStatus =
	{ kind: 'counting' } | { kind: 'counted'; tally: RecipeFilterTally } | { kind: 'failed' };

type SettledRecipeCounts = {
	query: string;
	status: Exclude<RecipeCountsStatus, { kind: 'counting' }>;
};

export type RecipeCounts = {
	// The query's own tally, never another's.
	current: RecipeCountsStatus;
	// The last tally counted, the query's own or an earlier one's, which options show while a count is
	// underway or failed.
	latest: RecipeFilterTally;
};

const counting: RecipeCountsStatus = { kind: 'counting' };

// The tally for the latest query, asked for a moment after it last changed. Each change cancels the
// request before it, and an answer settles only the query it was asked for, so a late answer never
// stands for a newer query. The known query, the view's own, needs no request. The reader must keep
// its identity across renders, or each render asks again.
export function useRecipeCounts(
	query: string,
	known: { query: string; tally: RecipeFilterTally },
	readCounts: RecipeCountsReader
): RecipeCounts {
	const [settled, setSettled] = React.useState<SettledRecipeCounts>();
	const knownQuery = known.query;

	React.useEffect(() => {
		if (query === knownQuery) {
			return;
		}

		const cancellation = new AbortController();
		const debounce = setTimeout(() => {
			void requestRecipeCounts(query, readCounts, cancellation.signal).then(
				(tally) => {
					if (!cancellation.signal.aborted) {
						setSettled({ query, status: { kind: 'counted', tally } });
					}
				},
				() => {
					if (!cancellation.signal.aborted) {
						setSettled({ query, status: { kind: 'failed' } });
					}
				}
			);
		}, recipeCountsDebounceMs);
		return () => {
			clearTimeout(debounce);
			cancellation.abort();
		};
	}, [query, knownQuery, readCounts]);

	let current = counting;
	if (query === knownQuery) {
		current = { kind: 'counted', tally: known.tally };
	} else if (settled?.query === query) {
		current = settled.status;
	}

	const [latest, setLatest] = React.useState(known.tally);
	if (current.kind === 'counted' && current.tally !== latest) {
		setLatest(current.tally);
	}

	return { current, latest: current.kind === 'counted' ? current.tally : latest };
}
