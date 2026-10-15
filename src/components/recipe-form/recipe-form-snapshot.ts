import { z } from 'zod';
import {
	storedPathname,
	type PhotoUpload,
	type ProblemKey,
	type RecipeFormErrorField,
	type RecipeFormList,
	type RecipeFormListName,
	type RecipeFormPhoto,
	type RecipeFormReviewNote,
	type RecipeFormRowKind,
	type RecipeFormText,
	type RecipeFormValues,
	type RecipeYieldKind,
} from '@/components/recipe-form/recipe-form-values';
import { InvalidRecipeError } from '@/domain/recipe/errors';

// The recipe form's values as they are kept outside the page: in this browser as the member edits,
// and on the server as a draft they save. It holds what the member typed and chose and each review
// note's state, never what a save said or a photo's file, and is read back only once its shape is
// checked. Pure, so the rules are tested without a browser.

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

const textFields = textSchema.keyof().options;

// The fields a note can be on, which the text fields and the tags are.
const errorFields = [
	...textSchema.keyof().exclude(['tagDraft']).options,
	'tags',
] as const satisfies readonly RecipeFormErrorField[];

// The keys problemKey gives, so a note comes back on the place it was on.
const problemKeySchema = z.union([
	z.literal('form'),
	z.templateLiteral(['field:', z.enum(errorFields)]),
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

const snapshotFields = z.object({
	text: textSchema,
	yieldKind: z.enum(['servings', 'makes']) satisfies z.ZodType<RecipeYieldKind>,
	ingredientSections: listSchema,
	instructionSections: listSchema,
	tags: z.array(z.object({ id: idSchema, label: z.string() })),
	photos: z.object({ dish: z.array(photoSchema), scan: z.array(photoSchema) }),
	reviewNotes: z.array(z.tuple([problemKeySchema, reviewNoteSchema])),
	nextId: idSchema,
});

export type RecipeFormSnapshot = z.infer<typeof snapshotFields>;

type SnapshotPhoto = z.infer<typeof photoSchema>;

// Rows, tags, and photos share one run of ids.
function formIds({
	ingredientSections,
	instructionSections,
	tags,
	photos,
}: RecipeFormSnapshot): number[] {
	return [
		...ingredientSections.rows,
		...instructionSections.rows,
		...tags,
		...photos.dish,
		...photos.scan,
	].map(({ id }) => id);
}

export const recipeFormSnapshotSchema = snapshotFields.refine((form) => {
	const ids = formIds(form);
	return new Set(ids).size === ids.length;
});

// The form always sends this shape, so anything else came from an out-of-date page.
const unreadableSnapshotProblem = {
	path: '',
	message: 'We couldn’t read the draft. Reload the page and try again.',
};

// The form as kept, without a save's errors or a photo's file. A photo keeps its pathname once
// stored, so one still on its way, which a page hidden mid-upload stops, comes back as one that
// didn't upload.
export function recipeFormSnapshot(values: RecipeFormValues): RecipeFormSnapshot {
	const list = ({ rows }: RecipeFormList) => ({
		rows: rows.map(({ kind, id, text }) => ({ kind, id, text })),
	});
	const photo = (shown: RecipeFormPhoto): SnapshotPhoto => ({
		id: shown.id,
		fileName: shown.fileName,
		alt: shown.alt,
		pathname: storedPathname(shown),
	});
	return {
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

// What a saved draft keeps: the form without the photos only this browser holds, which never
// uploaded.
export function savedDraftSnapshot(values: RecipeFormValues): RecipeFormSnapshot {
	const snapshot = recipeFormSnapshot(values);
	const stored = (photos: readonly SnapshotPhoto[]) =>
		photos.filter(({ pathname }) => pathname !== undefined);
	return {
		...snapshot,
		photos: { dish: stored(snapshot.photos.dish), scan: stored(snapshot.photos.scan) },
	};
}

// A posted draft's snapshot, for the Server Action that receives it. Throws InvalidRecipeError when
// it can't be read.
export function recipeFormSnapshotFromForm(json: string): RecipeFormSnapshot {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		throw new InvalidRecipeError([unreadableSnapshotProblem]);
	}
	const result = recipeFormSnapshotSchema.safeParse(data);
	if (!result.success) {
		throw new InvalidRecipeError([unreadableSnapshotProblem]);
	}
	return result.data;
}

// The snapshot a draft keeps, or undefined where it can't be read, as after a change to what the form
// keeps.
export function readRecipeFormSnapshot(data: unknown): RecipeFormSnapshot | undefined {
	const result = recipeFormSnapshotSchema.safeParse(data);
	return result.success ? result.data : undefined;
}

// The title a list of drafts shows, or undefined while there is none.
export function recipeFormSnapshotTitle(snapshot: RecipeFormSnapshot): string | undefined {
	const title = snapshot.text.title.trim();
	return title === '' ? undefined : title;
}

// Every stored photo's pathname, dish photos then scans, as the recipe would list them.
export function recipeFormSnapshotImages(snapshot: RecipeFormSnapshot): string[] {
	return [...snapshot.photos.dish, ...snapshot.photos.scan].flatMap(({ pathname }) =>
		pathname === undefined ? [] : [pathname]
	);
}

// What the member sees of the form, as text that two forms showing the same share: each field as
// it reads, each list's rows that hold text in order, the tags, the photos by what they show, and
// the notes still open on each place. Ids, the next id, blank rows, and a hidden yield unit are no
// part of it, so a row added and removed again, or a blank one moved, changes nothing.
function shownRecipeForm(snapshot: RecipeFormSnapshot): string {
	const notes = new Map(snapshot.reviewNotes);
	const openNote = (key: ProblemKey) => {
		const note = notes.get(key);
		return note?.status === 'open' ? note.message : undefined;
	};
	const shownText = (field: keyof RecipeFormText) => snapshot.text[field].trim();
	const shownList = (name: RecipeFormListName) => ({
		note: openNote(`list:${name}`),
		rows: snapshot[name].rows
			.filter(({ text }) => text.trim() !== '')
			.map(({ kind, id, text }) => ({
				kind,
				text: text.trim(),
				note: openNote(`row:${id}`),
				sectionNote: kind === 'heading' ? openNote(`section:${id}`) : undefined,
			})),
	});
	const shownPhotos = (photos: readonly SnapshotPhoto[], described: boolean) =>
		photos.map(({ id, pathname, alt }) => ({
			pathname: pathname ?? null,
			alt: described ? alt.trim() : undefined,
			note: openNote(`photo:${id}`),
		}));
	return JSON.stringify({
		text: textFields.map((field) =>
			field === 'yieldUnit' && snapshot.yieldKind !== 'makes' ? '' : shownText(field)
		),
		yieldKind: snapshot.yieldKind,
		formNote: openNote('form'),
		fieldNotes: errorFields.map((field) => openNote(`field:${field}`)),
		ingredientSections: shownList('ingredientSections'),
		instructionSections: shownList('instructionSections'),
		tags: snapshot.tags.map(({ label }) => label),
		photos: {
			dish: shownPhotos(snapshot.photos.dish, true),
			scan: shownPhotos(snapshot.photos.scan, false),
		},
	});
}

// Whether two forms show the member the same thing, so keeping one in place of the other changes
// nothing they would notice.
export function showSameRecipeForm(a: RecipeFormSnapshot, b: RecipeFormSnapshot): boolean {
	return shownRecipeForm(a) === shownRecipeForm(b);
}

// The photos the recipe or draft the form loaded names, which the image sweep keeps.
export function loadedPathnames(initial: RecipeFormValues): Set<string> {
	return new Set(
		[...initial.photos.dish, ...initial.photos.scan].flatMap(({ upload }) =>
			upload.status === 'saved' ? [upload.pathname] : []
		)
	);
}

// The kept form in place of the one that loaded. A photo the form loaded with is saved, a stored
// upload shows from storage, and one never stored comes back as one that didn't upload, which saving
// leaves out. Ids go on above every restored one, so nothing new takes the id, or the note, of
// something removed.
export function restoredRecipeForm(
	snapshot: RecipeFormSnapshot,
	initial: RecipeFormValues
): RecipeFormValues {
	const loaded = loadedPathnames(initial);
	const upload = (pathname: string | undefined): PhotoUpload => {
		if (pathname === undefined) {
			return { status: 'failed', failure: 'upload' };
		}
		return loaded.has(pathname) ? { status: 'saved', pathname } : { status: 'uploaded', pathname };
	};
	const photo = ({ pathname, ...kept }: SnapshotPhoto): RecipeFormPhoto => ({
		...kept,
		upload: upload(pathname),
	});
	return {
		text: snapshot.text,
		yieldKind: snapshot.yieldKind,
		ingredientSections: { rows: snapshot.ingredientSections.rows },
		instructionSections: { rows: snapshot.instructionSections.rows },
		tags: snapshot.tags,
		photos: { dish: snapshot.photos.dish.map(photo), scan: snapshot.photos.scan.map(photo) },
		fieldErrors: {},
		reviewNotes: new Map(snapshot.reviewNotes),
		nextId: Math.max(snapshot.nextId, ...formIds(snapshot).map((id) => id + 1)),
	};
}
