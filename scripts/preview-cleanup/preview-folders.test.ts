import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearPreviewFolders,
	previewFoldersReport,
	type FolderOutcome,
	type PreviewStore,
	type StoredImage,
} from './preview-folders';

const listedAt = new Date('2026-10-16T10:17:00Z');
const longAgo = new Date('2026-10-15T10:17:00Z');
const afterListing = new Date('2026-10-16T10:18:00Z');
// Within the five minutes before the listing that count as after it, and past them.
const withinGrace = new Date('2026-10-16T10:15:00Z');
const beforeGrace = new Date('2026-10-16T10:07:00Z');

// Folder names as branchFolder gives them, each hash from sha256sum. The two review branches share
// their hash, so only the readable part tells their folders apart.
const featX = 'feat-x-79b4cc55';
const featDashX = 'feat-x-5b66f324';
const main = 'main-0d6e4079';
const nihon = 'cf2abf0c';
const review94325 = 'review-branch-94325-2481685f';
const review143353 = 'review-branch-143353-2481685f';

// Blob's folders, played in memory: a folder is the next segment of any pathname under a prefix.
// Listing or deleting under a folder whose name says so fails.
class FakePreviewStore implements PreviewStore {
	readonly images = new Map<string, Date>();
	readonly listedPrefixes: string[] = [];

	constructor(images: Record<string, Date>) {
		for (const [pathname, uploadedAt] of Object.entries(images)) {
			this.images.set(pathname, uploadedAt);
		}
	}

	async listFolders(prefix: string): Promise<string[]> {
		this.listedPrefixes.push(prefix);
		const folders = [...this.images.keys()]
			.filter(
				(pathname) => pathname.startsWith(prefix) && pathname.slice(prefix.length).includes('/')
			)
			.map((pathname) => `${prefix}${pathname.slice(prefix.length).split('/')[0]}/`);
		return [...new Set(folders)].sort();
	}

	async listImages(folder: string): Promise<StoredImage[]> {
		if (folder.includes('unlistable')) {
			throw new Error('Vercel Blob: listing broke');
		}
		return [...this.images]
			.filter(([pathname]) => pathname.startsWith(folder))
			.map(([pathname, uploadedAt]) => ({ pathname, uploadedAt }));
	}

	async delete(pathnames: readonly string[]): Promise<void> {
		if (pathnames.some((pathname) => pathname.includes('undeletable'))) {
			throw new Error(
				'Vercel Blob: Access denied, please provide a valid token for this resource.'
			);
		}
		for (const pathname of pathnames) {
			this.images.delete(pathname);
		}
	}

	pathnames(): string[] {
		return [...this.images.keys()].sort();
	}
}

// The seed's photos and anything outside the preview folders, which no run may touch.
const untouchable = {
	'dish/seed/pancakes.jpg': longAgo,
	'scan/seed/card.jpg': longAgo,
	'dish/production/soup.jpg': longAgo,
};

let store: FakePreviewStore;

describe('clearPreviewFolders on a closed pull request or a deleted branch', () => {
	beforeEach(() => {
		store = new FakePreviewStore({
			...untouchable,
			[`dish/preview/${featX}/a.jpg`]: longAgo,
			[`dish/preview/${featX}/b.jpg`]: longAgo,
			[`scan/preview/${featX}/card.jpg`]: longAgo,
			[`trash/dish/preview/${featX}/c.jpg`]: longAgo,
			[`trash/scan/preview/${featX}/old-card.jpg`]: longAgo,
			[`dish/preview/${featDashX}/d.jpg`]: longAgo,
			[`dish/preview/${main}/e.jpg`]: longAgo,
		});
	});

	it("clears the branch's folder under each role and its trash, and nothing else", async () => {
		const outcomes = await clearPreviewFolders(store, {
			branches: [{ branch: 'feat/x', previews: 'deleted' }],
			listedAt,
			eventBranch: 'feat/x',
		});

		expect(outcomes).toEqual([
			{ kind: 'cleared', folder: `dish/preview/${featX}/`, images: 2, branch: 'feat/x' },
			{ kind: 'cleared', folder: `trash/dish/preview/${featX}/`, images: 1, branch: 'feat/x' },
			{ kind: 'cleared', folder: `scan/preview/${featX}/`, images: 1, branch: 'feat/x' },
			{ kind: 'cleared', folder: `trash/scan/preview/${featX}/`, images: 1, branch: 'feat/x' },
		]);
		expect(store.pathnames()).toEqual(
			[
				...Object.keys(untouchable),
				`dish/preview/${featDashX}/d.jpg`,
				`dish/preview/${main}/e.jpg`,
			].sort()
		);
		expect(store.listedPrefixes).toEqual([
			'dish/preview/',
			'trash/dish/preview/',
			'scan/preview/',
			'trash/scan/preview/',
		]);
	});

	it("never clears another branch's folder whose name shares the branch's hash", async () => {
		store = new FakePreviewStore({
			[`dish/preview/${review94325}/a.jpg`]: longAgo,
			[`dish/preview/${review143353}/b.jpg`]: longAgo,
		});

		const outcomes = await clearPreviewFolders(store, {
			branches: [{ branch: 'review-branch-143353', previews: 'deleted' }],
			listedAt,
			eventBranch: 'review-branch-143353',
		});

		expect(outcomes).toEqual([
			{
				kind: 'cleared',
				folder: `dish/preview/${review143353}/`,
				images: 1,
				branch: 'review-branch-143353',
			},
		]);
		expect(store.pathnames()).toEqual([`dish/preview/${review94325}/a.jpg`]);
	});

	it('keeps the folders of a branch whose previews were not all deleted', async () => {
		const outcomes = await clearPreviewFolders(store, {
			branches: [{ branch: 'feat/x', previews: 'delete-failed' }],
			listedAt,
			eventBranch: 'feat/x',
		});

		expect(outcomes).toHaveLength(4);
		expect(outcomes[0]).toEqual({
			kind: 'kept',
			folder: `dish/preview/${featX}/`,
			reason: 'previews-left',
			branch: 'feat/x',
		});
		expect(store.images.size).toBe(10);
	});

	it("keeps a cleared branch's folder written to since the previews were listed", async () => {
		store.images.set(`scan/preview/${featX}/new-card.jpg`, afterListing);

		const outcomes = await clearPreviewFolders(store, {
			branches: [{ branch: 'feat/x', previews: 'deleted' }],
			listedAt,
			eventBranch: 'feat/x',
		});

		expect(outcomes).toContainEqual({
			kind: 'kept',
			folder: `scan/preview/${featX}/`,
			reason: 'written-since-listing',
		});
		expect(store.pathnames()).toContain(`scan/preview/${featX}/card.jpg`);
		expect(store.pathnames()).not.toContain(`dish/preview/${featX}/a.jpg`);
	});
});

describe('clearPreviewFolders in the daily sweep', () => {
	beforeEach(() => {
		store = new FakePreviewStore({
			...untouchable,
			[`dish/preview/${main}/a.jpg`]: longAgo,
			[`trash/scan/preview/${main}/b.jpg`]: longAgo,
			[`dish/preview/${nihon}/c.jpg`]: longAgo,
			[`dish/preview/${review94325}/d.jpg`]: longAgo,
			[`dish/preview/${review143353}/e.jpg`]: longAgo,
			['dish/preview/gone-283bb9de/f.jpg']: longAgo,
			['scan/preview/gone-283bb9de/g.jpg']: longAgo,
			['dish/preview/stuck-9c05ce79/h.jpg']: longAgo,
			['dish/preview/old-branch-78407175/i.jpg']: longAgo,
			['dish/preview/manual/j.jpg']: longAgo,
		});
	});

	const branches = [
		{ branch: 'main', previews: 'kept' },
		{ branch: '日本', previews: 'kept' },
		{ branch: 'review-branch-94325', previews: 'kept' },
		{ branch: 'gone', previews: 'deleted' },
		{ branch: 'stuck', previews: 'delete-failed' },
	] as const;

	it('keeps the folders of each branch with a preview, by their whole names', async () => {
		const outcomes = await clearPreviewFolders(store, { branches, listedAt });

		expect(outcomes).toContainEqual({
			kind: 'kept',
			folder: `dish/preview/${nihon}/`,
			reason: 'has-preview',
			branch: '日本',
		});
		expect(outcomes).toContainEqual({
			kind: 'kept',
			folder: `trash/scan/preview/${main}/`,
			reason: 'has-preview',
			branch: 'main',
		});
		expect(outcomes).toContainEqual({
			kind: 'kept',
			folder: `dish/preview/${review94325}/`,
			reason: 'has-preview',
			branch: 'review-branch-94325',
		});
		expect(outcomes).toContainEqual({
			kind: 'kept',
			folder: 'dish/preview/stuck-9c05ce79/',
			reason: 'previews-left',
			branch: 'stuck',
		});
	});

	it("clears a cleared branch's folders and every folder of a branch no listed preview had", async () => {
		const outcomes = await clearPreviewFolders(store, { branches, listedAt });

		expect(outcomes).toContainEqual({
			kind: 'cleared',
			folder: 'scan/preview/gone-283bb9de/',
			images: 1,
			branch: 'gone',
		});
		// Its hash matches a kept branch's, but its whole name matches no listed preview's branch.
		expect(outcomes).toContainEqual({
			kind: 'cleared',
			folder: `dish/preview/${review143353}/`,
			images: 1,
		});
		expect(store.pathnames()).toEqual(
			[
				...Object.keys(untouchable),
				`dish/preview/${main}/a.jpg`,
				`trash/scan/preview/${main}/b.jpg`,
				`dish/preview/${nihon}/c.jpg`,
				`dish/preview/${review94325}/d.jpg`,
				'dish/preview/stuck-9c05ce79/h.jpg',
			].sort()
		);
	});

	it('keeps a folder no listed preview had while it holds an image uploaded since the listing', async () => {
		store = new FakePreviewStore({
			['dish/preview/new-branch-ed28ca18/a.jpg']: afterListing,
			['dish/preview/mixed-branch-813814e8/old.jpg']: longAgo,
			['dish/preview/mixed-branch-813814e8/new.jpg']: afterListing,
			['dish/preview/recent-branch-5c15476c/b.jpg']: withinGrace,
			['dish/preview/stale-branch-74d7c734/c.jpg']: beforeGrace,
		});

		const outcomes = await clearPreviewFolders(store, { branches: [], listedAt });

		expect(outcomes).toEqual([
			{
				kind: 'kept',
				folder: 'dish/preview/mixed-branch-813814e8/',
				reason: 'written-since-listing',
			},
			{
				kind: 'kept',
				folder: 'dish/preview/new-branch-ed28ca18/',
				reason: 'written-since-listing',
			},
			{
				kind: 'kept',
				folder: 'dish/preview/recent-branch-5c15476c/',
				reason: 'written-since-listing',
			},
			{ kind: 'cleared', folder: 'dish/preview/stale-branch-74d7c734/', images: 1 },
		]);
		expect(store.images.size).toBe(4);
	});

	it('reports a folder it could not list or delete, and clears the rest', async () => {
		store = new FakePreviewStore({
			['dish/preview/undeletable-11111111/a.jpg']: longAgo,
			['dish/preview/unlistable-22222222/b.jpg']: longAgo,
			['dish/preview/orphan-33333333/c.jpg']: longAgo,
		});

		const outcomes = await clearPreviewFolders(store, { branches: [], listedAt });

		expect(outcomes).toEqual([
			{ kind: 'cleared', folder: 'dish/preview/orphan-33333333/', images: 1 },
			{
				kind: 'failed',
				folder: 'dish/preview/undeletable-11111111/',
				error: 'Error: Vercel Blob: Access denied, please provide a valid token for this resource.',
			},
			{
				kind: 'failed',
				folder: 'dish/preview/unlistable-22222222/',
				error: 'Error: Vercel Blob: listing broke',
			},
		]);
	});

	it('fails when listing the folders fails', async () => {
		store.listFolders = async () => {
			throw new Error(
				'Vercel Blob: Access denied, please provide a valid token for this resource.'
			);
		};

		await expect(clearPreviewFolders(store, { branches, listedAt })).rejects.toThrow(
			'Access denied'
		);
		expect(store.images.size).toBe(13);
	});

	it('refuses a folder listed outside its prefix rather than clear it', async () => {
		store.listFolders = async () => ['dish/seed/'];

		await expect(clearPreviewFolders(store, { branches, listedAt })).rejects.toThrow(
			'Listing dish/preview/ returned dish/seed/, which is not a folder directly under it'
		);
		expect(store.pathnames()).toContain('dish/seed/pancakes.jpg');
	});
});

describe('previewFoldersReport', () => {
	it('gives one line per folder, with its reason and what it deleted', () => {
		const outcomes: FolderOutcome[] = [
			{
				kind: 'kept',
				folder: 'dish/preview/main-0d6e4079/',
				reason: 'has-preview',
				branch: 'main',
			},
			{
				kind: 'kept',
				folder: 'dish/preview/stuck-9c05ce79/',
				reason: 'previews-left',
				branch: 'stuck',
			},
			{ kind: 'kept', folder: 'dish/preview/new-ed28ca18/', reason: 'written-since-listing' },
			{ kind: 'cleared', folder: 'dish/preview/gone-283bb9de/', images: 3, branch: 'gone' },
			{ kind: 'cleared', folder: 'scan/preview/old-78407175/', images: 1 },
			{ kind: 'failed', folder: 'scan/preview/gone-283bb9de/', error: 'Error: Access denied' },
		];

		expect(previewFoldersReport(outcomes).split('\n')).toEqual([
			'Keeping dish/preview/main-0d6e4079/ (main has a preview)',
			'Keeping dish/preview/stuck-9c05ce79/ (a preview of stuck failed to delete)',
			'Keeping dish/preview/new-ed28ca18/ (written to since the previews were listed)',
			'Clearing dish/preview/gone-283bb9de/: 3 images (branch gone cleared)',
			'Clearing scan/preview/old-78407175/: 1 image (no preview)',
			'::error::Clearing scan/preview/gone-283bb9de/ failed: Error: Access denied',
		]);
	});

	it('says when an event found no folder of its branch, and the sweep nothing when it found none', () => {
		expect(previewFoldersReport([], 'feat/x')).toBe('No image folders of feat/x');
		expect(previewFoldersReport([])).toBe('');
	});
});
