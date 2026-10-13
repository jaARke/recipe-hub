import { describe, expect, it } from 'vitest';
import { formatTimeAgo } from '@/components/recipe-import/time-ago';

const now = new Date('2026-10-12T18:00:00.000Z');

function minutesBefore(minutes: number): Date {
	return new Date(now.getTime() - minutes * 60 * 1000);
}

describe('formatTimeAgo', () => {
	it.each([
		{ minutes: 0, expected: 'just now' },
		{ minutes: 0.9, expected: 'just now' },
		{ minutes: 1, expected: '1 minute ago' },
		{ minutes: 59.9, expected: '59 minutes ago' },
		{ minutes: 60, expected: '1 hour ago' },
		{ minutes: 23 * 60 + 59, expected: '23 hours ago' },
		{ minutes: 24 * 60, expected: 'yesterday' },
		{ minutes: 6 * 24 * 60 + 23 * 60, expected: '6 days ago' },
	])('says $expected for $minutes minutes', ({ minutes, expected }) => {
		expect(formatTimeAgo(minutesBefore(minutes), now)).toBe(expected);
	});

	it('says just now for a time a little ahead, as a clock skew can make it', () => {
		expect(formatTimeAgo(minutesBefore(-1), now)).toBe('just now');
	});
});
