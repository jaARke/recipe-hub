import 'server-only';
import { z } from 'zod';
import {
	recipeImageRoleSchema,
	recipeImageSchema,
	type RecipeImageRole,
} from '@/domain/recipe/recipe-image';
import { previewImageEnvironmentPrefix } from '@/lib/image-paths';

// What the browser names an upload: crypto.randomUUID() and the extension of the JPEG it encoded.
const uploadIdSchema = z.uuidv4();
const uploadExtension = '.jpg';

function environmentFolder(role: RecipeImageRole, environment: string): string {
	return `${role}/${environment}/`;
}

// Plain segments only, so a pathname cannot climb out of the folder it starts in.
function isInEnvironment(pathname: string, environment: string): boolean {
	return recipeImageRoleSchema.options.some(
		(role) =>
			pathname.startsWith(environmentFolder(role, environment)) &&
			recipeImageSchema.safeParse({ role, pathname }).success
	);
}

// One store serves every environment, so each writes and deletes images only in its own folder under
// each role's: dish/production/, scan/preview/<branch>/, or dish/seed/ for the seed's photos.
export class ImageFolders {
	private readonly environment: string;
	private readonly readableEnvironments: readonly string[];

	// Besides its own, an environment reads the readable environments' images, such as production's
	// photos that a preview's copied recipes name. By default it reads only its own folders.
	constructor(environment: string, readableEnvironments: readonly string[] = []) {
		this.environment = environment;
		this.readableEnvironments = readableEnvironments;
	}

	uploadFolder(role: RecipeImageRole): string {
		return environmentFolder(role, this.environment);
	}

	// This environment's folder under each role's.
	environmentFolders(): string[] {
		return recipeImageRoleSchema.options.map((role) => this.uploadFolder(role));
	}

	// A preview's folders hold only its branch's images, so they can go when its pull request closes.
	isPreview(): boolean {
		return this.environment.startsWith(previewImageEnvironmentPrefix);
	}

	contains(pathname: string): boolean {
		return isInEnvironment(pathname, this.environment);
	}

	// What this environment serves: its own images and the readable environments'.
	isReadable(pathname: string): boolean {
		return [this.environment, ...this.readableEnvironments].some((environment) =>
			isInEnvironment(pathname, environment)
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
