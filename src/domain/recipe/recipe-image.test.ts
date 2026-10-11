import { describe, expect, it } from 'vitest';
import { coverImage } from '@/domain/recipe/recipe-image';

describe('coverImage', () => {
	it('is the first dish photo', () => {
		const scan = { role: 'scan', pathname: 'card-front.jpg' } as const;
		const first = { role: 'dish', pathname: 'plated.jpg' } as const;
		const second = { role: 'dish', pathname: 'sliced.jpg' } as const;

		expect(coverImage([scan, first, second])).toBe(first);
	});

	it('is undefined without a dish photo', () => {
		expect(coverImage([{ role: 'scan', pathname: 'card-front.jpg' }])).toBeUndefined();
		expect(coverImage([])).toBeUndefined();
	});
});
