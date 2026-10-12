import 'server-only';
import { z } from 'zod';
import {
	recipeImageRoleSchema,
	recipeImageSchema,
	type RecipeImageRole,
} from '@/domain/recipe/recipe-image';

// What the browser names an upload: crypto.randomUUID() and the extension of the JPEG it encoded.
const uploadIdSchema = z.uuidv4();
const uploadExtension = '.jpg';

// One store serves every environment, so each writes and deletes images only in its own folder under
// each role's: dish/production/, scan/preview/<branch>/, or dish/seed/ for the seed's photos.
export class ImageFolders {
	private readonly environment: string;

	constructor(environment: string) {
		this.environment = environment;
	}

	uploadFolder(role: RecipeImageRole): string {
		return `${role}/${this.environment}/`;
	}

	// Plain segments only, so a pathname cannot climb out of the folder it starts in.
	contains(pathname: string): boolean {
		return recipeImageRoleSchema.options.some(
			(role) =>
				pathname.startsWith(this.uploadFolder(role)) &&
				recipeImageSchema.safeParse({ role, pathname }).success
		);
	}

	// Exactly a new upload's pathname: <role folder><uuid>.jpg.
	isUploadName(pathname: string): boolean {
		return recipeImageRoleSchema.options.some((role) => {
			const folder = this.uploadFolder(role);
			const name = pathname.slice(folder.length);
			return (
				pathname.startsWith(folder) &&
				name.endsWith(uploadExtension) &&
				uploadIdSchema.safeParse(name.slice(0, -uploadExtension.length)).success
			);
		});
	}
}
