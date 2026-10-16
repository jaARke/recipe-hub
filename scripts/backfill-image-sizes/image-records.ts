import { eq, isNotNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { ImageSize } from '@/domain/recipe/recipe-image';
import { recipeDrafts, recipeImports, recipes } from '@/infrastructure/db/schema';
import {
	imageRecordKinds,
	unsizedPathnames,
	withImageSizes,
	type ImageRecordKind,
	type ImageRecordStore,
	type KeptImage,
	type UnsizedRecord,
} from './backfill';

type Database = PgDatabase<PgQueryResultHKT>;

// A record's row as listed: what the report calls it, and the JSON column that names its images.
type ListedRow = Omit<UnsizedRecord, 'kind' | 'pathnames'> & { document: unknown };

// Each column is read only as far as its images, and everything else in it is written back as it
// was read, so a field this script does not know survives.
const keptImageSchema = z.looseObject({
	pathname: z.string().optional(),
	size: z.unknown().optional(),
}) satisfies z.ZodType<KeptImage>;
const keptImagesSchema = z.array(keptImageSchema);
type StoredImageEntry = z.infer<typeof keptImageSchema>;

const recipeContentSchema = z.looseObject({
	title: z.string().optional(),
	images: keptImagesSchema,
});
const importDraftSchema = z.looseObject({
	content: z.looseObject({ title: z.string().optional(), images: keptImagesSchema.optional() }),
});
// The recipe form's values, whose photos have a pathname once stored.
const savedDraftValuesSchema = z.looseObject({
	photos: z.looseObject({ dish: keptImagesSchema, scan: keptImagesSchema }),
});

type MapImages = (images: StoredImageEntry[]) => StoredImageEntry[];

// Where one kind of record keeps its images: its rows, and its JSON column, locked for an update.
type RecordTable = {
	listRows(db: Database): Promise<ListedRow[]>;
	lockDocument(tx: Database, id: string): Promise<unknown>;
	writeDocument(tx: Database, id: string, document: unknown): Promise<void>;
	// The images the document names, or undefined for a document of a shape the script cannot read,
	// which it leaves alone.
	images(document: unknown): StoredImageEntry[] | undefined;
	withImages(document: unknown, map: MapImages): unknown;
};

// The backfill writes only the column that names the images. Each row's times stay as they were: a
// recipe's updatedAt is the date its page says it was edited, and a saved draft expires from its own.
const recordTables: Record<ImageRecordKind, RecordTable> = {
	recipe: {
		async listRows(db) {
			const rows = await db
				.select({ id: recipes.id, name: recipes.slug, document: recipes.content })
				.from(recipes)
				.orderBy(recipes.id);
			return rows.map(({ id, name, document }) => ({
				id,
				name,
				title: recipeContentSchema.safeParse(document).data?.title,
				document,
			}));
		},
		async lockDocument(tx, id) {
			const [row] = await tx
				.select({ document: recipes.content })
				.from(recipes)
				.where(eq(recipes.id, id))
				.for('update');
			return row?.document;
		},
		async writeDocument(tx, id, document) {
			await tx.update(recipes).set({ content: document }).where(eq(recipes.id, id));
		},
		images: (document) => recipeContentSchema.safeParse(document).data?.images,
		withImages(document, map) {
			const content = recipeContentSchema.parse(document);
			return { ...content, images: map(content.images) };
		},
	},
	'import-draft': {
		async listRows(db) {
			const rows = await db
				.select({ id: recipeImports.id, document: recipeImports.draft })
				.from(recipeImports)
				.where(isNotNull(recipeImports.draft))
				.orderBy(recipeImports.id);
			return rows.map(({ id, document }) => ({
				id,
				name: id,
				title: importDraftSchema.safeParse(document).data?.content.title,
				document,
			}));
		},
		async lockDocument(tx, id) {
			const [row] = await tx
				.select({ document: recipeImports.draft })
				.from(recipeImports)
				.where(eq(recipeImports.id, id))
				.for('update');
			return row?.document ?? undefined;
		},
		async writeDocument(tx, id, document) {
			await tx.update(recipeImports).set({ draft: document }).where(eq(recipeImports.id, id));
		},
		images: (document) => importDraftSchema.safeParse(document).data?.content.images,
		withImages(document, map) {
			const draft = importDraftSchema.parse(document);
			const images = draft.content.images ?? [];
			return { ...draft, content: { ...draft.content, images: map(images) } };
		},
	},
	'saved-draft': {
		async listRows(db) {
			const rows = await db
				.select({ id: recipeDrafts.id, title: recipeDrafts.title, document: recipeDrafts.values })
				.from(recipeDrafts)
				.orderBy(recipeDrafts.id);
			return rows.map(({ id, title, document }) => ({
				id,
				name: id,
				title: title ?? undefined,
				document,
			}));
		},
		async lockDocument(tx, id) {
			const [row] = await tx
				.select({ document: recipeDrafts.values })
				.from(recipeDrafts)
				.where(eq(recipeDrafts.id, id))
				.for('update');
			return row?.document;
		},
		async writeDocument(tx, id, document) {
			await tx.update(recipeDrafts).set({ values: document }).where(eq(recipeDrafts.id, id));
		},
		images(document) {
			const photos = savedDraftValuesSchema.safeParse(document).data?.photos;
			return photos === undefined ? undefined : [...photos.dish, ...photos.scan];
		},
		withImages(document, map) {
			const values = savedDraftValuesSchema.parse(document);
			return {
				...values,
				photos: { ...values.photos, dish: map(values.photos.dish), scan: map(values.photos.scan) },
			};
		},
	},
};

// The recipes, imports' drafts, and saved drafts in Postgres. Each write locks its row, then gives
// the sizes to the images it names without one as it stands then, so an edit made since the row was
// listed is kept, and an image it no longer names is left out. Pathnames are never reused, so a size
// read for one is right wherever it is named.
export class DrizzleImageRecordStore implements ImageRecordStore {
	private readonly db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	async listUnsized(): Promise<UnsizedRecord[]> {
		const records: UnsizedRecord[] = [];
		for (const kind of imageRecordKinds) {
			const table = recordTables[kind];
			for (const { document, ...row } of await table.listRows(this.db)) {
				const pathnames = unsizedPathnames(table.images(document) ?? []);
				if (pathnames.length > 0) {
					records.push({ kind, ...row, pathnames });
				}
			}
		}
		return records;
	}

	async writeSizes(record: UnsizedRecord, sizes: ReadonlyMap<string, ImageSize>): Promise<number> {
		const table = recordTables[record.kind];
		return this.db.transaction(async (tx) => {
			const document = await table.lockDocument(tx, record.id);
			const sized = unsizedPathnames(table.images(document) ?? []).filter((pathname) =>
				sizes.has(pathname)
			).length;
			if (sized > 0) {
				const sizedDocument = table.withImages(document, (images) => withImageSizes(images, sizes));
				await table.writeDocument(tx, record.id, sizedDocument);
			}
			return sized;
		});
	}
}
