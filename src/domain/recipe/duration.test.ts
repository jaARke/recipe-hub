import { describe, expect, it } from 'vitest';
import { durationMinutesSchema, formatDuration, totalMinutes } from '@/domain/recipe/duration';

describe('formatDuration', () => {
	it.each([
		[0, '0 min'],
		[15, '15 min'],
		[35, '35 min'],
		[60, '1 hr'],
		[70, '1 hr 10 min'],
		[225, '3 hr 45 min'],
		[240, '4 hr'],
		[270, '4 hr 30 min'],
	])('writes %s minutes as %s', (minutes, expected) => {
		expect(formatDuration(minutes)).toBe(expected);
	});
});

describe('durationMinutesSchema', () => {
	it('accepts whole minutes from zero', () => {
		expect(durationMinutesSchema.safeParse(0).success).toBe(true);
		expect(durationMinutesSchema.safeParse(90).success).toBe(true);
	});

	it('rejects negative and fractional minutes', () => {
		expect(durationMinutesSchema.safeParse(-5).success).toBe(false);
		expect(durationMinutesSchema.safeParse(1.5).success).toBe(false);
	});
});

describe('totalMinutes', () => {
	it('prefers the stated total', () => {
		expect(totalMinutes({ prepMinutes: 15, cookMinutes: 15, totalMinutes: 270 })).toBe(270);
	});

	it('adds prep and cook when no total is stated', () => {
		expect(totalMinutes({ prepMinutes: 15, cookMinutes: 35 })).toBe(50);
		expect(totalMinutes({ prepMinutes: 15 })).toBe(15);
		expect(totalMinutes({ cookMinutes: 0 })).toBe(0);
	});

	it('is undefined when no time is known', () => {
		expect(totalMinutes({})).toBeUndefined();
	});
});
