import { describe, expect, it } from 'vitest';
import { normalizedPhotoSize } from '@/components/recipe-form/photo-processing';

describe('normalizedPhotoSize', () => {
	it.each([
		{
			photo: 'landscape dish photo',
			role: 'dish',
			natural: { width: 4032, height: 3024 },
			expected: { width: 2400, height: 1800 },
		},
		{
			photo: 'portrait dish photo',
			role: 'dish',
			natural: { width: 3024, height: 4032 },
			expected: { width: 1800, height: 2400 },
		},
		{
			photo: 'square dish photo',
			role: 'dish',
			natural: { width: 3000, height: 3000 },
			expected: { width: 2400, height: 2400 },
		},
		{
			photo: 'landscape scan',
			role: 'scan',
			natural: { width: 8064, height: 6048 },
			expected: { width: 3072, height: 2304 },
		},
		{
			photo: 'portrait scan',
			role: 'scan',
			natural: { width: 6048, height: 8064 },
			expected: { width: 2304, height: 3072 },
		},
	] as const)('fits a $photo to its long edge', ({ role, natural, expected }) => {
		expect(normalizedPhotoSize(natural, role)).toEqual(expected);
	});

	it('never enlarges a photo smaller than the target', () => {
		expect(normalizedPhotoSize({ width: 1200, height: 900 }, 'dish')).toEqual({
			width: 1200,
			height: 900,
		});
		expect(normalizedPhotoSize({ width: 2400, height: 1600 }, 'scan')).toEqual({
			width: 2400,
			height: 1600,
		});
	});

	it('rounds the short side to the nearest pixel', () => {
		// 2400 × 1000 / 3001 is 799.73, and 2400 × 1001 / 3001 is 800.53.
		expect(normalizedPhotoSize({ width: 3001, height: 1000 }, 'dish')).toEqual({
			width: 2400,
			height: 800,
		});
		expect(normalizedPhotoSize({ width: 3001, height: 1001 }, 'dish')).toEqual({
			width: 2400,
			height: 801,
		});
	});

	it('keeps at least one pixel on each side', () => {
		expect(normalizedPhotoSize({ width: 12000, height: 2 }, 'dish')).toEqual({
			width: 2400,
			height: 1,
		});
	});
});
