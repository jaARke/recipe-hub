import { describe, expect, it } from 'vitest';
import {
	editScanImport,
	emptyScanImport,
	scanImportProblems,
	scanImportSubmission,
	type ScanImportEdit,
	type ScanImportValues,
} from '@/components/recipe-import/scan-import-values';

function edited(values: ScanImportValues, ...edits: ScanImportEdit[]): ScanImportValues {
	return edits.reduce(editScanImport, values);
}

const photoFile = new File(['jpeg'], 'page.jpg', { type: 'image/jpeg' });

function uploaded(photoId: number, pathname: string): ScanImportEdit[] {
	return [
		{ type: 'startPhotoUpload', photoId, pathname, file: photoFile },
		{ type: 'finishPhotoUpload', photoId },
	];
}

// Three pages chosen in order (ids 0 to 2): the first and third uploaded, the second unreadable.
function threePages(): ScanImportValues {
	return edited(
		emptyScanImport,
		{ type: 'addPhotos', role: 'scan', fileNames: ['front.jpg', 'back.heic', 'notes.jpg'] },
		...uploaded(0, 'scan/development/front.jpg'),
		{ type: 'failPhoto', photoId: 1, failure: 'unreadable' },
		...uploaded(2, 'scan/development/notes.jpg')
	);
}

describe('scanImportSubmission', () => {
	it('sends stored pages in order, each under the path its problems take', () => {
		const { pathnames, targets } = scanImportSubmission(threePages());

		expect(pathnames).toEqual(['scan/development/front.jpg', 'scan/development/notes.jpg']);
		expect([...targets]).toEqual([
			['scans.0', 0],
			['scans.1', 2],
		]);
	});

	it('follows the pages’ order as they move', () => {
		const moved = edited(threePages(), { type: 'movePhoto', photoId: 2, toIndex: 0 });

		expect(scanImportSubmission(moved).pathnames).toEqual([
			'scan/development/notes.jpg',
			'scan/development/front.jpg',
		]);
	});

	it('sends nothing before a page is stored', () => {
		const chosen = edited(emptyScanImport, {
			type: 'addPhotos',
			role: 'scan',
			fileNames: ['front.jpg'],
		});

		expect(scanImportSubmission(chosen)).toEqual({ pathnames: [], targets: new Map() });
	});
});

describe('scanImportProblems', () => {
	it('asks for a photo when there is none', () => {
		expect(scanImportProblems(emptyScanImport)).toEqual({ scans: 'Add at least one photo.' });
	});

	it('asks for photos whose uploads failed to be added again when no page is stored', () => {
		const failed = (count: number) =>
			edited(
				emptyScanImport,
				{
					type: 'addPhotos',
					role: 'scan',
					fileNames: Array.from({ length: count }, (_, index) => `page-${index}.jpg`),
				},
				...Array.from({ length: count }, (_, photoId): ScanImportEdit => ({
					type: 'failPhoto',
					photoId,
					failure: 'upload',
				}))
			);

		expect(scanImportProblems(failed(1))).toEqual({
			scans: 'The photo didn’t upload. Remove it and add it again.',
		});
		expect(scanImportProblems(failed(2))).toEqual({
			scans: 'The photos didn’t upload. Remove them and add them again.',
		});
	});

	it('finds nothing once a page is stored, though another failed', () => {
		expect(scanImportProblems(threePages())).toEqual({});
	});
});

describe('editScanImport', () => {
	it('puts a page’s problems on its photo and the others on the pages together', () => {
		const values = threePages();
		const { targets } = scanImportSubmission(values);

		const failed = editScanImport(values, {
			type: 'attachErrors',
			fieldErrors: {
				'scans.1': 'This page is not in storage.',
				'scans.1.size': 'This page is too large.',
				scans: 'Add at most 6 pages.',
				url: 'Something else.',
			},
			targets,
		});

		expect(failed.photos.scan.map((photo) => photo.error)).toEqual([
			undefined,
			undefined,
			'This page is not in storage.',
		]);
		expect(failed.error).toBe('Add at most 6 pages.');
	});

	it('clears earlier errors', () => {
		const values = threePages();
		const { targets } = scanImportSubmission(values);
		const failed = editScanImport(values, {
			type: 'attachErrors',
			fieldErrors: { 'scans.0': 'Check this page.', scans: 'Add at most 6 pages.' },
			targets,
		});

		const cleared = editScanImport(failed, { type: 'attachErrors', fieldErrors: {}, targets });

		expect(cleared.photos.scan.map((photo) => photo.error)).toEqual([
			undefined,
			undefined,
			undefined,
		]);
		expect(cleared.error).toBeUndefined();
	});
});
