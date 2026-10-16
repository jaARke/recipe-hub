import { z } from 'zod';
import { recipeImageRoleSchema } from '@/domain/recipe/recipe-image';
import { branchFolder } from '@/lib/branch-folder';
import { previewImageEnvironmentPrefix, roleFolder, trashFolder } from '@/lib/image-paths';

// What the previews job did with a branch's previews: left them, as the branch keeps a preview,
// deleted every one, or failed to delete one.
export const branchOutcomeSchema = z.object({
	branch: z.string().min(1),
	previews: z.enum(['kept', 'deleted', 'delete-failed']),
});

export type BranchOutcome = z.infer<typeof branchOutcomeSchema>;

export type StoredImage = {
	pathname: string;
	uploadedAt: Date;
};

// The preview store, as the cleanup reads and deletes it.
export interface PreviewStore {
	// The folders directly under a prefix, each as its full path ending in a slash.
	listFolders(prefix: string): Promise<string[]>;
	// Every image under a folder, however deep.
	listImages(folder: string): Promise<StoredImage[]>;
	delete(pathnames: readonly string[]): Promise<void>;
}

export type ClearOptions = {
	// Each branch the previews job decided on, and what became of its previews.
	branches: readonly BranchOutcome[];
	// When the previews job listed the previews.
	listedAt: Date;
	// A closed pull request's or a deleted branch's name: only that branch's folders are cleared.
	// Without one, the sweep also clears the folders of every branch no listed preview had.
	eventBranch?: string;
};

export type FolderOutcome =
	// Its branch keeps a preview, or still has one the previews job failed to delete.
	| { kind: 'kept'; folder: string; reason: 'has-preview' | 'previews-left'; branch: string }
	// Its branch is cleared, or no listed preview had its branch, but an image was uploaded to it
	// since the previews were listed, for a preview the listing could not have seen.
	| { kind: 'kept'; folder: string; reason: 'written-since-listing' }
	// Its images deleted: a cleared branch's folder, or one of a branch no listed preview had.
	| { kind: 'cleared'; folder: string; images: number; branch?: string }
	| { kind: 'failed'; folder: string; error: string };

// A preview's images sit in a folder named for its branch under each of these: each role's folder
// of preview environments, and that folder's trash.
const previewPrefixes = recipeImageRoleSchema.options.flatMap((role) => {
	const folder = roleFolder(role, previewImageEnvironmentPrefix);
	return [folder, `${trashFolder}${folder}`];
});

// Blob stamps an upload by its own clock, so an image uploaded this long before the previews were
// listed counts as uploaded since, in case that clock and the runner's differ.
const uploadClockGraceMs = 5 * 60 * 1000;

// The folder's name under the prefix it was listed by. A folder anywhere else breaks the store's
// promise, and clearing it could reach images that are no preview's, such as the seed's.
function folderName(prefix: string, folder: string): string {
	const name = folder.slice(prefix.length, -1);
	if (!folder.startsWith(prefix) || !folder.endsWith('/') || name === '' || name.includes('/')) {
		throw new Error(
			`Listing ${prefix} returned ${folder}, which is not a folder directly under it`
		);
	}
	return name;
}

async function clearFolder(
	store: PreviewStore,
	folder: string,
	decided: BranchOutcome | undefined,
	newSince: number
): Promise<FolderOutcome> {
	if (decided?.previews === 'kept') {
		return { kind: 'kept', folder, reason: 'has-preview', branch: decided.branch };
	}
	if (decided?.previews === 'delete-failed') {
		return { kind: 'kept', folder, reason: 'previews-left', branch: decided.branch };
	}

	try {
		const images = await store.listImages(folder);
		// A push right after a pull request closes, or a new branch's first preview, uploads images
		// for a preview the listing could not have seen, so the next run decides on the folder.
		if (images.some(({ uploadedAt }) => uploadedAt.getTime() >= newSince)) {
			return { kind: 'kept', folder, reason: 'written-since-listing' };
		}
		await store.delete(images.map(({ pathname }) => pathname));
		return {
			kind: 'cleared',
			folder,
			images: images.length,
			...(decided !== undefined && { branch: decided.branch }),
		};
	} catch (error) {
		// The error's name and message, which name a pathname at most.
		return { kind: 'failed', folder, error: String(error) };
	}
}

// Clears every folder of each branch whose previews are all gone, and in the sweep every folder of
// a branch no listed preview had, matching a folder by the whole name branchFolder gives its
// branch. A folder that fails is reported and the rest carry on; a listing that fails throws.
export async function clearPreviewFolders(
	store: PreviewStore,
	options: ClearOptions
): Promise<FolderOutcome[]> {
	const decidedByFolder = new Map(
		options.branches.map((outcome) => [branchFolder(outcome.branch), outcome])
	);
	const newSince = options.listedAt.getTime() - uploadClockGraceMs;
	const outcomes: FolderOutcome[] = [];
	for (const prefix of previewPrefixes) {
		for (const folder of await store.listFolders(prefix)) {
			const decided = decidedByFolder.get(folderName(prefix, folder));
			if (decided === undefined && options.eventBranch !== undefined) {
				continue;
			}
			outcomes.push(await clearFolder(store, folder, decided, newSince));
		}
	}
	return outcomes;
}

function imageCount(count: number): string {
	return `${count} image${count === 1 ? '' : 's'}`;
}

function keptReason(outcome: Extract<FolderOutcome, { kind: 'kept' }>): string {
	switch (outcome.reason) {
		case 'has-preview':
			return `${outcome.branch} has a preview`;
		case 'previews-left':
			return `a preview of ${outcome.branch} failed to delete`;
		case 'written-since-listing':
			return 'written to since the previews were listed';
	}
}

function outcomeLine(outcome: FolderOutcome): string {
	switch (outcome.kind) {
		case 'kept':
			return `Keeping ${outcome.folder} (${keptReason(outcome)})`;
		case 'cleared': {
			const reason =
				outcome.branch === undefined ? 'no preview' : `branch ${outcome.branch} cleared`;
			return `Clearing ${outcome.folder}: ${imageCount(outcome.images)} (${reason})`;
		}
		case 'failed':
			return `::error::Clearing ${outcome.folder} failed: ${outcome.error}`;
	}
}

// One line per folder for the workflow's log, a failure as an error annotation. An event that found
// no folder of its branch says so.
export function previewFoldersReport(
	outcomes: readonly FolderOutcome[],
	eventBranch?: string
): string {
	const lines = outcomes.map(outcomeLine);
	if (eventBranch !== undefined && outcomes.length === 0) {
		lines.push(`No image folders of ${eventBranch}`);
	}
	return lines.join('\n');
}
