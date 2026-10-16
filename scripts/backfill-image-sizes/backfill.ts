import type { ImageSize } from '@/domain/recipe/recipe-image';
import { getLogger } from '@/lib/logger';

export type BackfillOptions = {
	// Without it, a dry run: every image is read and its size listed, and none is written.
	write: boolean;
};

// What names images: a recipe, an import's draft awaiting review, or a draft a member saved.
export const imageRecordKinds = ['recipe', 'import-draft', 'saved-draft'] as const;
export type ImageRecordKind = (typeof imageRecordKinds)[number];

// A record that names images without a size.
export type UnsizedRecord = {
	kind: ImageRecordKind;
	// A recipe's slug, or a draft's id.
	name: string;
	id: string;
	title?: string;
	// The images it names without a size, each once, in the record's order.
	pathnames: readonly string[];
};

// Where the records are stored.
export interface ImageRecordStore {
	// Every record that names an image without a size, as stored now.
	listUnsized(): Promise<UnsizedRecord[]>;
	// Gives each image the record names without a size the size given for its pathname, and returns
	// how many it gave a size: none when the record was deleted, or edited so it no longer names them
	// without one, since it was listed.
	writeSizes(record: UnsizedRecord, sizes: ReadonlyMap<string, ImageSize>): Promise<number>;
}

// What reading a stored image found.
export type ImageReading =
	| { kind: 'sized'; size: ImageSize }
	// Storage holds no image under the pathname: the sweep removed it, or this environment's store
	// never held it, as for a recipe copied from production into develop.
	| { kind: 'missing' }
	// The read failed or outlasted its time limit, or the image holds no size.
	| { kind: 'unreadable'; message: string };

export type ImageSizeReader = (pathname: string) => Promise<ImageReading>;

// An image as a record keeps it: a recipe's or an import draft's image, or a saved draft's photo,
// which has no pathname until it is stored. Whatever else it holds is kept as it is.
export type KeptImage = { pathname?: string; size?: unknown };

export type BackfilledImage = {
	pathname: string;
	reading: ImageReading;
};

export type BackfillOutcome =
	// Sizes were read, and left unwritten by a dry run.
	| { kind: 'pending' }
	| { kind: 'written' }
	// No image's size could be read, so there is nothing to write.
	| { kind: 'skipped'; reason: 'unread' }
	// Deleted, or edited so it no longer names these images without a size, after it was listed.
	| { kind: 'skipped'; reason: 'changed' };

export type BackfilledRecord = Omit<UnsizedRecord, 'pathnames'> & {
	images: BackfilledImage[];
	outcome: BackfillOutcome;
};

export type BackfillResult = {
	write: boolean;
	// In the order they were listed: recipes, then imports' drafts, then saved drafts.
	records: BackfilledRecord[];
};

const logger = getLogger('backfill-image-sizes');

// The pathnames of the images without a size, each once, in order.
export function unsizedPathnames(images: readonly KeptImage[]): string[] {
	return [
		...new Set(
			images.flatMap(({ pathname, size }) =>
				pathname !== undefined && size === undefined ? [pathname] : []
			)
		),
	];
}

// The images with each one that has no size given the size for its pathname, if there is one.
export function withImageSizes<Image extends KeptImage>(
	images: readonly Image[],
	sizes: ReadonlyMap<string, ImageSize>
): Image[] {
	return images.map((image) => {
		const size =
			image.pathname === undefined || image.size !== undefined
				? undefined
				: sizes.get(image.pathname);
		return size === undefined ? image : { ...image, size };
	});
}

// The size of each image that was read. One that was not keeps no size, and the next run reads it
// again.
export function sizesToWrite(images: readonly BackfilledImage[]): Map<string, ImageSize> {
	return new Map(
		images.flatMap(({ pathname, reading }) =>
			reading.kind === 'sized' ? [[pathname, reading.size]] : []
		)
	);
}

async function backfillOutcome(
	records: ImageRecordStore,
	record: UnsizedRecord,
	sizes: ReadonlyMap<string, ImageSize>,
	options: BackfillOptions
): Promise<BackfillOutcome> {
	if (sizes.size === 0) {
		return { kind: 'skipped', reason: 'unread' };
	}

	if (!options.write) {
		return { kind: 'pending' };
	}

	const written = await records.writeSizes(record, sizes);
	return written === 0 ? { kind: 'skipped', reason: 'changed' } : { kind: 'written' };
}

function logRecord(record: BackfilledRecord): void {
	for (const { pathname, reading } of record.images) {
		if (reading.kind !== 'sized') {
			logger.warn('Image size not read', {
				kind: record.kind,
				id: record.id,
				pathname,
				reason: reading.kind,
				...(reading.kind === 'unreadable' && { detail: reading.message }),
			});
		}
	}

	const { outcome } = record;
	switch (outcome.kind) {
		case 'pending':
			return;
		case 'written':
			logger.info('Image sizes written', {
				kind: record.kind,
				id: record.id,
				imagesSized: sizesToWrite(record.images).size,
			});
			return;
		case 'skipped':
			logger.warn('Image sizes skipped', {
				kind: record.kind,
				id: record.id,
				reason: outcome.reason,
			});
			return;
	}
}

function countOf(result: BackfillResult, kind: BackfillOutcome['kind']): number {
	return result.records.filter((record) => record.outcome.kind === kind).length;
}

function unreadImages(result: BackfillResult): BackfilledImage[] {
	return result.records.flatMap(({ images }) =>
		images.filter(({ reading }) => reading.kind !== 'sized')
	);
}

// Reads the size of every stored image a record names without one, and with options.write writes
// each size into its record. Each image is read once, however many records name it. An image that
// cannot be read is recorded and left without a size, and the run carries on. A second run reads
// only what the first could not.
export async function backfillImageSizes(
	records: ImageRecordStore,
	readSize: ImageSizeReader,
	options: BackfillOptions
): Promise<BackfillResult> {
	const result: BackfillResult = { write: options.write, records: [] };
	const readings = new Map<string, Promise<ImageReading>>();
	const reading = (pathname: string) => {
		const read = readings.get(pathname) ?? readSize(pathname);
		readings.set(pathname, read);
		return read;
	};

	for (const record of await records.listUnsized()) {
		const images: BackfilledImage[] = [];
		for (const pathname of record.pathnames) {
			images.push({ pathname, reading: await reading(pathname) });
		}

		const { kind, name, id, title } = record;
		const backfilled: BackfilledRecord = {
			kind,
			name,
			id,
			title,
			images,
			outcome: await backfillOutcome(records, record, sizesToWrite(images), options),
		};
		logRecord(backfilled);
		result.records.push(backfilled);
	}

	logger.info('Image size backfill finished', {
		write: result.write,
		recordsFound: result.records.length,
		recordsWritten: countOf(result, 'written'),
		recordsSkipped: countOf(result, 'skipped'),
		imagesUnread: unreadImages(result).length,
	});
	return result;
}

function plural(count: number, noun: string): string {
	return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

const kindLabels: Record<ImageRecordKind, string> = {
	recipe: 'recipe',
	'import-draft': 'import draft',
	'saved-draft': 'saved draft',
};

function readingText(reading: ImageReading): string {
	switch (reading.kind) {
		case 'sized':
			return `${reading.size.width} × ${reading.size.height}`;
		case 'missing':
			return 'not in storage, left without a size';
		case 'unreadable':
			return `could not be read (${reading.message}), left without a size`;
	}
}

function outcomeText(outcome: BackfillOutcome): string {
	switch (outcome.kind) {
		case 'pending':
			return 'to write';
		case 'written':
			return 'written';
		case 'skipped':
			return outcome.reason === 'unread'
				? 'skipped, no size could be read'
				: 'skipped, deleted or edited during the run';
	}
}

function recordText(record: BackfilledRecord): string {
	const title = record.title === undefined ? '' : ` (${record.title})`;
	return [
		`${kindLabels[record.kind]} ${record.name}${title}: ${outcomeText(record.outcome)}`,
		...record.images.map(({ pathname, reading }) => `  ${pathname}: ${readingText(reading)}`),
	].join('\n');
}

function closingText(result: BackfillResult): string[] {
	const pending = countOf(result, 'pending');
	const written = countOf(result, 'written');
	const unread = unreadImages(result).length;
	const unreadText =
		unread === 0
			? []
			: [
					`${plural(unread, 'image')} could not be read. One not in storage keeps no size: its photo shows as missing, and saving its recipe or draft asks for it to be added again. One that could not be read is read again by the next run.`,
				];
	if (!result.write) {
		return [
			`Dry run: nothing was written. With --write, this run would write sizes into ${plural(pending, 'record')}.`,
			...unreadText,
		];
	}

	const wroteRecipes = result.records.some(
		({ kind, outcome }) => kind === 'recipe' && outcome.kind === 'written'
	);
	return [
		`Wrote sizes into ${plural(written, 'record')}.`,
		...(wroteRecipes
			? [
					'Cached recipe pages lay out their photos without the sizes until this environment is redeployed: redeploy it now.',
				]
			: []),
		...unreadText,
	];
}

// What a person reviews: each record's images and the size read for each, what came of the record,
// and what to do next.
export function backfillReport(result: BackfillResult): string {
	const imageCount = result.records.reduce((count, { images }) => count + images.length, 0);
	const summary = `Found ${plural(result.records.length, 'record')} naming ${plural(imageCount, 'image')} without a size.`;
	if (result.records.length === 0) {
		return [summary, 'Nothing to change.'].join('\n\n');
	}

	return [summary, ...result.records.map(recordText), ...closingText(result)].join('\n\n');
}
