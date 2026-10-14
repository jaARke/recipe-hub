import { describe, expect, it } from 'vitest';
import {
	expiringImageCutoff,
	removedImageCutoff,
	unusedImageCutoff,
} from '@/domain/recipe/image-retention';
import { settings } from '@/lib/settings';

const now = new Date('2026-10-13T09:00:00Z');
const day = 24 * 60 * 60 * 1000;

function daysBeforeNow(days: number): Date {
	return new Date(now.getTime() - days * day);
}

describe('removedImageCutoff', () => {
	it("is a removed image's lifetime before now", () => {
		expect(removedImageCutoff(now)).toEqual(
			daysBeforeNow(settings.retention.removedImageLifetimeDays)
		);
	});
});

describe('unusedImageCutoff', () => {
	it("is an unused upload's lifetime before now", () => {
		expect(unusedImageCutoff(now)).toEqual(
			daysBeforeNow(settings.retention.unusedImageLifetimeDays)
		);
	});
});

describe('expiringImageCutoff', () => {
	it("is an expiring environment's image lifetime before now", () => {
		expect(expiringImageCutoff(now)).toEqual(
			daysBeforeNow(settings.retention.expiringImageLifetimeDays)
		);
	});
});
