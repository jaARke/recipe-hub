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

// An environment's own folders take its name and a slash. A shorter prefix, such as preview/, takes in
// every environment whose name starts with it.
function environmentPrefix(environment: string): string {
	return `${environment}/`;
}

function roleFolder(role: RecipeImageRole, prefix: string): string {
	return `${role}/${prefix}`;
}

// Plain segments only, so a pathname cannot climb out of the folder it starts in.
function isUnderPrefix(pathname: string, prefix: string): boolean {
	return recipeImageRoleSchema.options.some(
		(role) =>
			pathname.startsWith(roleFolder(role, prefix)) &&
			recipeImageSchema.safeParse({ role, pathname }).success
	);
}

// Environments share a store, as production and previews do, so each writes and deletes images
// only in its own folder under each role's: dish/production/, scan/preview/<branch>/, or dish/seed/
// for the seed's photos. The one exception is the expiring environments' folders, where a
// deployment deletes old images for good.
export class ImageFolders {
	private readonly environment: string;
	private readonly readableEnvironments: readonly string[];
	private readonly expiringEnvironmentPrefixes: readonly string[];

	// Besides its own, an environment reads the readable environments' images, such as production's
	// photos that a preview's copied recipes name, and deletes the old images of every environment
	// whose name starts with an expiring prefix, such as production deleting previews'. By default it
	// reads and deletes only in its own folders.
	constructor(
		environment: string,
		readableEnvironments: readonly string[] = [],
		expiringEnvironmentPrefixes: readonly string[] = []
	) {
		this.environment = environment;
		this.readableEnvironments = readableEnvironments;
		this.expiringEnvironmentPrefixes = expiringEnvironmentPrefixes;
	}

	uploadFolder(role: RecipeImageRole): string {
		return roleFolder(role, environmentPrefix(this.environment));
	}

	// This environment's folder under each role's.
	environmentFolders(): string[] {
		return recipeImageRoleSchema.options.map((role) => this.uploadFolder(role));
	}

	// The expiring environments' folder under each role's, such as dish/preview/ and scan/preview/.
	expiringFolders(): string[] {
		return this.expiringEnvironmentPrefixes.flatMap((prefix) =>
			recipeImageRoleSchema.options.map((role) => roleFolder(role, prefix))
		);
	}

	contains(pathname: string): boolean {
		return isUnderPrefix(pathname, environmentPrefix(this.environment));
	}

	isExpiring(pathname: string): boolean {
		return this.expiringEnvironmentPrefixes.some((prefix) => isUnderPrefix(pathname, prefix));
	}

	// What this environment serves: its own images and the readable environments'.
	isReadable(pathname: string): boolean {
		return [this.environment, ...this.readableEnvironments].some((environment) =>
			isUnderPrefix(pathname, environmentPrefix(environment))
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
