import { describe, expect, it } from 'vitest';
import {
	imagePositionLabel,
	imageViewerLabels,
	showImageLabel,
	viewImageLabel,
} from '@/components/recipe/recipe-image-viewer-labels';

describe('imageViewerLabels', () => {
	it.each([
		['dish', { region: 'Photos', previous: 'Previous photo', next: 'Next photo' }],
		['scan', { region: 'Pages', previous: 'Previous page', next: 'Next page' }],
	] as const)('words the %s viewer', (role, expected) => {
		expect(imageViewerLabels(role)).toEqual(expected);
	});
});

describe('imagePositionLabel', () => {
	it('counts from one', () => {
		expect(imagePositionLabel('dish', 1, 4)).toBe('Photo 2 of 4');
		expect(imagePositionLabel('scan', 0, 3)).toBe('Page 1 of 3');
	});
});

describe('showImageLabel', () => {
	it('names the image a thumbnail shows by its place', () => {
		expect(showImageLabel('dish', 1, 4)).toBe('Show photo 2 of 4');
		expect(showImageLabel('scan', 0, 2)).toBe('Show page 1 of 2');
	});
});

describe('viewImageLabel', () => {
	it('names the image by its place among several', () => {
		expect(viewImageLabel('dish', 1, 4, undefined)).toBe('View photo 2 of 4');
		expect(viewImageLabel('scan', 2, 3, undefined)).toBe('View page 3 of 3');
	});

	it('adds the description when there is one', () => {
		expect(viewImageLabel('dish', 0, 4, 'A split biscuit with honey')).toBe(
			'View photo 1 of 4: A split biscuit with honey'
		);
	});

	it('leaves out the count for a lone image', () => {
		expect(viewImageLabel('dish', 0, 1, undefined)).toBe('View photo');
		expect(viewImageLabel('dish', 0, 1, 'A bowl of soup')).toBe('View photo: A bowl of soup');
		expect(viewImageLabel('scan', 0, 1, undefined)).toBe('View page');
	});
});
