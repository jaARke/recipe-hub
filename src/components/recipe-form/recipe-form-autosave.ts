import { z } from 'zod';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	storedPathname,
	type PhotoUpload,
	type ProblemKey,
	type RecipeFormList,
	type RecipeFormListName,
	type RecipeFormPhoto,
	type RecipeFormReviewNote,
	type RecipeFormRowKind,
	type RecipeFormText,
	type RecipeFormValues,
	type RecipeYieldKind,
} from '@/components/recipe-form/recipe-form-values';
import { memberBrowserStorageKey } from '@/lib/browser-storage';

// What the recipe form keeps in the browser as the member edits it, so a reload, a closed tab, or a
// tab the phone discarded gives back what they entered. Pure, so the rules are tested without a
// browser. An entry holds what the member typed and chose and each review note's state, never what
// a save said, and the form reads it back only once it has checked its shape.

// What a form edits, which names its entry: a new recipe, an import's draft under review, or a
// recipe at the version the edit loaded.
export type RecipeFormSubject =
	| { kind: 'new' }
	| { kind: 'import'; importId: string }
	| { kind: 'recipe'; recipeId: string; version: string };

const keyPrefix = 'recipe-form';

const idSchema = z.number().int().nonnegative();

const textSchema = z.object({
	title: z.string(),
	description: z.string(),
	source: z.string(),
	notes: z.string(),
	prepMinutes: z.string(),
	cookMinutes: z.string(),
	totalMinutes: z.string(),
	yieldAmount: z.string(),
	yieldUnit: z.string(),
	tagDraft: z.string(),
}) satisfies z.ZodType<RecipeFormText>;

const listNameSchema = z.enum([
	'ingredientSections',
	'instructionSections',
]) satisfies z.ZodType<RecipeFormListName>;

// The keys problemKey gives, so a note comes back on the place it was on.
const problemKeySchema = z.union([
	z.literal('form'),
	z.templateLiteral([
		'field:',
		z.enum([...textSchema.keyof().exclude(['tagDraft']).options, 'tags']),
	]),
	z.templateLiteral(['list:', listNameSchema]),
	z.templateLiteral([z.enum(['row', 'section', 'photo']), ':', idSchema]),
]) satisfies z.ZodType<ProblemKey>;

const listSchema = z.object({
	rows: z.array(
		z.object({
			kind: z.enum(['item', 'heading']) satisfies z.ZodType<RecipeFormRowKind>,
			id: idSchema,
			text: z.string(),
		})
	),
});

const photoSchema = z.object({
	id: idSchema,
	fileName: z.string().optional(),
	alt: z.string(),
	// Absent for a photo that was never stored: one that failed, or one still on its way.
	pathname: z.string().optional(),
});

const reviewNoteSchema = z.object({
	message: z.string(),
	status: z.enum(['open', 'resolved']),
}) satisfies z.ZodType<RecipeFormReviewNote>;

const entrySchema = z.object({
	// The version of the recipe an edit loaded; a new recipe's and an import's entries have none.
	version: z.string().optional(),
	text: textSchema,
	yieldKind: z.enum(['servings', 'makes']) satisfies z.ZodType<RecipeYieldKind>,
	ingredientSections: listSchema,
	instructionSections: listSchema,
	tags: z.array(z.object({ id: idSchema, label: z.string() })),
	photos: z.object({ dish: z.array(photoSchema), scan: z.array(photoSchema) }),
	reviewNotes: z.array(z.tuple([problemKeySchema, reviewNoteSchema])),
	nextId: idSchema,
});

export type AutosavedRecipeForm = z.infer<typeof entrySchema>;

type AutosavedPhoto = z.infer<typeof photoSchema>;

// An upload stored since the form loaded, by the photo that shows it.
export type UnsavedUpload = { photoId: number; pathname: string };

// Rows, tags, and photos share one run of ids.
function formIds({
	ingredientSections,
	instructionSections,
	tags,
	photos,
}: AutosavedRecipeForm): number[] {
	return [
		...ingredientSections.rows,
		...instructionSections.rows,
		...tags,
		...photos.dish,
		...photos.scan,
	].map(({ id }) => id);
}

const readableEntrySchema = entrySchema.refine((form) => {
	const ids = formIds(form);
	return new Set(ids).size === ids.length;
});

// One entry for each form, so an edit's entry for an older version of the recipe is replaced. The key
// names the recipe and not the version, so a recipe's entry is found without one.
export function recipeFormAutosaveKey(
	subject: Exclude<RecipeFormSubject, { kind: 'recipe' }> | { kind: 'recipe'; recipeId: string }
): string {
	switch (subject.kind) {
		case 'new':
			return memberBrowserStorageKey(`${keyPrefix}:new`);
		case 'import':
			return memberBrowserStorageKey(`${keyPrefix}:import:${subject.importId}`);
		case 'recipe':
			return memberBrowserStorageKey(`${keyPrefix}:recipe:${subject.recipeId}`);
	}
}

// The version an edit's entry names, so changes made to one version never come back over another.
export function recipeFormAutosaveVersion(subject: RecipeFormSubject): string | undefined {
	return subject.kind === 'recipe' ? subject.version : undefined;
}

// What the form edits, from what it is given: a recipe to edit, an import to review, or neither.
export function recipeFormSubject({
	editing,
	importId,
}: {
	editing?: Pick<EditedRecipe, 'id' | 'version'>;
	importId?: string;
}): RecipeFormSubject {
	if (editing !== undefined) {
		return { kind: 'recipe', recipeId: editing.id, version: editing.version };
	}
	return importId === undefined ? { kind: 'new' } : { kind: 'import', importId };
}

// The form as its entry keeps it, without a save's errors or a photo's file. A photo keeps its
// pathname once stored, so one still on its way, which a page hidden mid-upload stops, comes back
// as one that didn't upload.
export function autosavedRecipeForm(
	values: RecipeFormValues,
	version: string | undefined
): AutosavedRecipeForm {
	const list = ({ rows }: RecipeFormList) => ({
		rows: rows.map(({ kind, id, text }) => ({ kind, id, text })),
	});
	const photo = (shown: RecipeFormPhoto): AutosavedPhoto => ({
		id: shown.id,
		fileName: shown.fileName,
		alt: shown.alt,
		pathname: storedPathname(shown),
	});
	return {
		version,
		text: values.text,
		yieldKind: values.yieldKind,
		ingredientSections: list(values.ingredientSections),
		instructionSections: list(values.instructionSections),
		tags: values.tags.map(({ id, label }) => ({ id, label })),
		photos: { dish: values.photos.dish.map(photo), scan: values.photos.scan.map(photo) },
		reviewNotes: [...values.reviewNotes],
		nextId: values.nextId,
	};
}

// Whether the form holds just what it loaded with, so there is nothing to keep. Its next id is no
// part of that, since a row added and removed again leaves it higher.
export function isAsLoaded(entry: AutosavedRecipeForm, loaded: AutosavedRecipeForm): boolean {
	return JSON.stringify({ ...entry, nextId: 0 }) === JSON.stringify({ ...loaded, nextId: 0 });
}

// The stored entry, or undefined where there is none, where it can't be read (as after a change to
// what the form keeps), or where it is about another version of the recipe.
export function readAutosavedRecipeForm(
	entry: string | undefined,
	version: string | undefined
): AutosavedRecipeForm | undefined {
	if (entry === undefined) {
		return undefined;
	}
	let data: unknown;
	try {
		data = JSON.parse(entry);
	} catch {
		return undefined;
	}
	const result = readableEntrySchema.safeParse(data);
	return result.success && result.data.version === version ? result.data : undefined;
}

// The photos the recipe or draft the form loaded names, which the image sweep keeps.
function loadedPathnames(initial: RecipeFormValues): Set<string> {
	return new Set(
		[...initial.photos.dish, ...initial.photos.scan].flatMap(({ upload }) =>
			upload.status === 'saved' ? [upload.pathname] : []
		)
	);
}

// The stored uploads the form didn't load with. The image sweep removes an upload a day after nothing
// names it, so each is looked up once it is back.
export function unsavedUploads(
	stored: AutosavedRecipeForm,
	initial: RecipeFormValues
): UnsavedUpload[] {
	const loaded = loadedPathnames(initial);
	return [...stored.photos.dish, ...stored.photos.scan].flatMap(({ id, pathname }) =>
		pathname === undefined || loaded.has(pathname) ? [] : [{ photoId: id, pathname }]
	);
}

// The stored form in place of the one that loaded. A photo the form loaded with is saved, a stored
// upload shows from storage until its lookup says it is gone, and one never stored comes back as one
// that didn't upload, which saving leaves out. Ids go on above every restored one, so nothing new
// takes the id, or the note, of something removed.
export function restoredRecipeForm(
	stored: AutosavedRecipeForm,
	initial: RecipeFormValues
): RecipeFormValues {
	const loaded = loadedPathnames(initial);
	const upload = (pathname: string | undefined): PhotoUpload => {
		if (pathname === undefined) {
			return { status: 'failed', failure: 'upload' };
		}
		return loaded.has(pathname) ? { status: 'saved', pathname } : { status: 'uploaded', pathname };
	};
	const photo = ({ pathname, ...kept }: AutosavedPhoto): RecipeFormPhoto => ({
		...kept,
		upload: upload(pathname),
	});
	return {
		text: stored.text,
		yieldKind: stored.yieldKind,
		ingredientSections: { rows: stored.ingredientSections.rows },
		instructionSections: { rows: stored.instructionSections.rows },
		tags: stored.tags,
		photos: { dish: stored.photos.dish.map(photo), scan: stored.photos.scan.map(photo) },
		fieldErrors: {},
		reviewNotes: new Map(stored.reviewNotes),
		nextId: Math.max(stored.nextId, ...formIds(stored).map((id) => id + 1)),
	};
}
