import { describe, expect, it } from 'vitest';
import {
	expiringImageCutoff,
	removedImageCutoff,
	unusedImageCutoff,
} from '@/domain/recipe/image-retention';

const now = new Date('2026-10-13T09:00:00Z');

describe('removedImageCutoff', () => {
	it('is forty days before now', () => {
		expect(removedImageCutoff(now)).toEqual(new Date('2026-09-03T09:00:00Z'));
	});
});

describe('unusedImageCutoff', () => {
	it('is one day before now', () => {
		expect(unusedImageCutoff(now)).toEqual(new Date('2026-10-12T09:00:00Z'));
	});
});

describe('expiringImageCutoff', () => {
	it('is thirty days before now', () => {
		expect(expiringImageCutoff(now)).toEqual(new Date('2026-09-13T09:00:00Z'));
	});
});
