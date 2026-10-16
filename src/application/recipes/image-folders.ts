import 'server-only';
import { z } from 'zod';
import {
	imagePathnameSchema,
	recipeImageRoleSchema,
	type RecipeImageRole,
} from '@/domain/recipe/recipe-image';

// What the browser names an upload: crypto.randomUUID() and the extension of the JPEG it encoded.
const uploadIdSchema = z.uuidv4();
const uploadExtension = '.jpg';

// An environment's folders take its name and a slash, so preview/feature-x's never take in
// preview/feature-xy's.
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
			imagePathnameSchema.safeParse(pathname).success
	);
}

// Environments share a store, as every preview and the seed's photos share the preview store, so
// each writes and deletes images only in its own folder under each role's: dish/production/,
// scan/preview/<branch>/, or dish/seed/ for the seed's photos.
export class ImageFolders {
	private readonly environment: string;
	private readonly readableEnvironments: readonly string[];
	private readonly fetchedFromProduction: readonly string[];

	// Besides its own, an environment serves the readable environments' images from its store, such
	// as the seed's photos, and those of the environments it fetches from production's public image
	// route, such as production's photos that a preview's copied recipes name. By default it serves
	// only its own.
	constructor(
		environment: string,
		readableEnvironments: readonly string[] = [],
		fetchedFromProduction: readonly string[] = []
	) {
		this.environment = environment;
		this.readableEnvironments = readableEnvironments;
		this.fetchedFromProduction = fetchedFromProduction;
	}

	uploadFolder(role: RecipeImageRole): string {
		return roleFolder(role, environmentPrefix(this.environment));
	}

	// This environment's folder under each role's.
	environmentFolders(): string[] {
		return recipeImageRoleSchema.options.map((role) => this.uploadFolder(role));
	}

	contains(pathname: string): boolean {
		return isUnderPrefix(pathname, environmentPrefix(this.environment));
	}

	// What this environment serves from its store: its own images and the readable environments'.
	isReadable(pathname: string): boolean {
		return [this.environment, ...this.readableEnvironments].some((environment) =>
			isUnderPrefix(pathname, environmentPrefix(environment))
		);
	}

	// What this environment serves from production's public image route.
	isFetchedFromProduction(pathname: string): boolean {
		return this.fetchedFromProduction.some((environment) =>
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
