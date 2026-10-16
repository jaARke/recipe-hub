import { describe, expect, it } from 'vitest';
import { encodeWithinBudget, normalizedPhotoSize } from '@/components/recipe-form/photo-processing';
import { maxImportScanSizeInBytes } from '@/domain/recipe/import-limits';
import { imageSizeSchema } from '@/domain/recipe/recipe-image';

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

	it.each(['dish', 'scan'] as const)('draws a %s at a size a recipe accepts', (role) => {
		const size = normalizedPhotoSize({ width: 12000, height: 9000 }, role);

		expect(imageSizeSchema.safeParse(size).success).toBe(true);
	});
});

describe('encodeWithinBudget', () => {
	// Encodes a JPEG of the bytes the test sets for each long edge and quality, and records each draw
	// and encoding in turn.
	function fakeCanvas(bytes: Record<number, Record<number, number>>) {
		const steps: string[] = [];
		let longEdge = 0;
		const canvas = {
			draw: ({ width, height }: { width: number; height: number }) => {
				longEdge = Math.max(width, height);
				steps.push(`draw ${width} × ${height}`);
				return Promise.resolve();
			},
			encode: (quality: number) => {
				steps.push(`encode at ${quality}`);
				return Promise.resolve(new Blob([new Uint8Array(bytes[longEdge]?.[quality] ?? 0)]));
			},
		};
		return { canvas, steps };
	}

	const landscapeScan = { width: 8064, height: 6048 };

	// Over the import size limit at every quality.
	const heavyAtEveryQuality = {
		0.9: 9_000_000,
		0.8: 8_000_000,
		0.7: 7_000_000,
		0.6: 6_000_000,
		0.5: 5_000_000,
	};

	const everyQuality = [
		'encode at 0.9',
		'encode at 0.8',
		'encode at 0.7',
		'encode at 0.6',
		'encode at 0.5',
	];

	it('encodes a dish photo once, at its size and quality, whatever it weighs', async () => {
		const { canvas, steps } = fakeCanvas({ 2400: { 0.85: 5_000_000 } });

		const photo = await encodeWithinBudget('dish', { width: 4032, height: 3024 }, canvas);

		expect(steps).toEqual(['draw 2400 × 1800', 'encode at 0.85']);
		expect(photo).toMatchObject({ width: 2400, height: 1800 });
		expect(photo.jpeg.size).toBe(5_000_000);
	});

	it('keeps a scan exactly at the import size limit at its own size and quality', async () => {
		const { canvas, steps } = fakeCanvas({ 3072: { 0.9: maxImportScanSizeInBytes } });

		await encodeWithinBudget('scan', landscapeScan, canvas);

		expect(steps).toEqual(['draw 3072 × 2304', 'encode at 0.9']);
	});

	it('lowers a heavier scan’s quality a tenth at a time until it fits, drawing it once', async () => {
		const { canvas, steps } = fakeCanvas({
			3072: { 0.9: 5_200_000, 0.8: 3_900_000, 0.7: 3_100_000 },
		});

		const photo = await encodeWithinBudget('scan', landscapeScan, canvas);

		expect(steps).toEqual(['draw 3072 × 2304', 'encode at 0.9', 'encode at 0.8', 'encode at 0.7']);
		expect(photo).toMatchObject({ width: 3072, height: 2304 });
		expect(photo.jpeg.size).toBe(3_100_000);
	});

	it('shrinks a scan no quality fits a quarter at a time, at the lowest quality, until it fits', async () => {
		const { canvas, steps } = fakeCanvas({
			3072: heavyAtEveryQuality,
			2304: { 0.5: 4_000_000 },
			1728: { 0.5: 3_000_000 },
		});

		const photo = await encodeWithinBudget('scan', landscapeScan, canvas);

		expect(steps).toEqual([
			'draw 3072 × 2304',
			...everyQuality,
			'draw 2304 × 1728',
			'encode at 0.5',
			'draw 1728 × 1296',
			'encode at 0.5',
		]);
		expect(photo).toMatchObject({ width: 1728, height: 1296 });
		expect(photo.jpeg.size).toBe(3_000_000);
	});

	it('keeps the last attempt, at 1600 px, when nothing fits', async () => {
		const { canvas, steps } = fakeCanvas({
			3072: heavyAtEveryQuality,
			2304: { 0.5: 4_600_000 },
			1728: { 0.5: 4_300_000 },
			1600: { 0.5: 4_000_000 },
		});

		const photo = await encodeWithinBudget('scan', { width: 6048, height: 8064 }, canvas);

		expect(steps).toEqual([
			'draw 2304 × 3072',
			...everyQuality,
			'draw 1728 × 2304',
			'encode at 0.5',
			'draw 1296 × 1728',
			'encode at 0.5',
			'draw 1200 × 1600',
			'encode at 0.5',
		]);
		expect(photo).toMatchObject({ width: 1200, height: 1600 });
		expect(photo.jpeg.size).toBe(4_000_000);
	});

	it('shrinks a smaller scan only to long edges below its own', async () => {
		const { canvas, steps } = fakeCanvas({
			2000: heavyAtEveryQuality,
			1728: { 0.5: maxImportScanSizeInBytes + 1 },
		});

		const photo = await encodeWithinBudget('scan', { width: 2000, height: 1500 }, canvas);

		expect(steps).toEqual([
			'draw 2000 × 1500',
			...everyQuality,
			'draw 1728 × 1296',
			'encode at 0.5',
			'draw 1600 × 1200',
			'encode at 0.5',
		]);
		expect(photo).toMatchObject({ width: 1600, height: 1200 });
	});

	it('keeps the lowest quality for a scan too small to shrink', async () => {
		const { canvas, steps } = fakeCanvas({ 1600: heavyAtEveryQuality });

		const photo = await encodeWithinBudget('scan', { width: 1600, height: 1200 }, canvas);

		expect(steps).toEqual(['draw 1600 × 1200', ...everyQuality]);
		expect(photo.jpeg.size).toBe(5_000_000);
	});
});
