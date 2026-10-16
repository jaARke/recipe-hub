import 'server-only';
import type { ImageStore } from '@/application/ports/image-store';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SavedDraftRepository } from '@/application/ports/saved-draft-repository';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imagesInUse } from '@/application/recipes/images-in-use';
import type { MemberId } from '@/domain/member/member';
import type { Problem } from '@/domain/problem';
import { unstoredImageMessage } from '@/domain/recipe/recipe-image';

// Where an image to attach is looked for: this environment's folders and store, and everything that
// names images.
export type ImageAttachmentSources = {
	folders: ImageFolders;
	images: ImageStore;
	recipes: RecipeRepository;
	imports: RecipeImportRepository;
	drafts: SavedDraftRepository;
};

// A problem at images.<index>.pathname for each image a recipe or saved draft may not name. Each one
// it does not already name must be an upload this environment stored, not one it removed, that no
// other member's recipe or draft names, since an image anything names is never removed, and naming
// theirs would keep it from them. Images it already names stay as they are, such as production's
// photos on a preview's copy. Only the member's own recipes and drafts may name them already, so an
// admin's edit adds only what the contributor could. Another member's photo is told the same, so the
// refusal tells nothing about their photos.
export async function unattachableImageProblems(
	pathnames: readonly string[],
	existing: readonly string[],
	memberId: MemberId,
	{ folders, images, recipes, imports, drafts }: ImageAttachmentSources
): Promise<Problem[]> {
	const existingPathnames = new Set(existing);
	const added = pathnames.filter(
		(pathname) => !existingPathnames.has(pathname) && folders.contains(pathname)
	);
	const othersImages = await imagesInUse(added, recipes, imports, drafts, new Date(), memberId);
	const attachable = await Promise.all(
		pathnames.map(
			async (pathname) =>
				existingPathnames.has(pathname) ||
				(folders.contains(pathname) && !othersImages.has(pathname) && (await images.has(pathname)))
		)
	);
	return attachable.flatMap((isAttachable, index) =>
		isAttachable ? [] : [{ path: `images.${index}.pathname`, message: unstoredImageMessage }]
	);
}
