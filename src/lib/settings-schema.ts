import { z } from 'zod';

// The safe range of each value in src/lib/settings.ts and the rules between them. next.config.ts
// parses the settings against it when the dev server or a build starts; client code never imports it,
// so zod stays out of the browser.

// Neon keeps a daily snapshot for 35 days.
const neonSnapshotLifetimeDays = 35;

const modelIdSchema = z
	.string()
	.regex(
		/^[a-z\d-]+\/[\w.-]+$/,
		'Use an AI Gateway model id, such as anthropic/claude-sonnet-5.5.'
	);

const timeZoneSchema = z.string().refine((timeZone) => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}, 'Use an IANA time zone, such as America/New_York.');

export const settingsSchema = z
	.object({
		photos: z.object({
			maxDishPhotosPerRecipe: z.int().positive(),
			maxScansPerRecipe: z.int().positive(),
			// The model reads every scan in one request, which the Claude API caps at 32 MB, and a scan
			// takes up to 5 MB once encoded (maxImportScanSizeInBytes in src/domain/recipe/import-limits.ts).
			maxScansPerImport: z.int().positive().max(6),
		}),
		imports: z.object({
			maxImportsPerDay: z.int().positive(),
			maxUnsavedImports: z.int().positive(),
			importDraftLifetimeDays: z.int().positive(),
		}),
		ai: z.object({
			pageModelId: modelIdSchema,
			scanModelId: modelIdSchema,
			// An import's time limit, importTimeLimitMs in recipe-import-service.ts, is 110 seconds and
			// must outlast a 10-second page fetch and then the model call.
			extractionTimeoutMs: z.int().positive().max(100_000),
		}),
		accounts: z.object({
			inviteLifetimeDays: z.int().positive(),
			// Two hours at most, since an unread code can sit in an inbox others see.
			signInCodeLifetimeMinutes: z.int().positive().max(120),
			// Longer than a day, the age at which Better Auth renews a session; browsers keep a cookie
			// for 400 days at most.
			sessionLifetimeDays: z.int().min(2).max(400),
		}),
		favorites: z.object({
			// One cookie holds the device's favorites, and browsers keep a cookie only up to 4,096 bytes
			// with its name and attributes. An id takes 37 bytes, a uuid and its separator, so 100 take
			// about 3,700 and leave room for the rest.
			maxPerDevice: z.int().positive().max(100),
		}),
		cooking: z.object({
			progressLifetimeHours: z.int().positive(),
		}),
		retention: z.object({
			removedImageLifetimeDays: z
				.int()
				.gt(neonSnapshotLifetimeDays, "Keep removed images past Neon's 35-day snapshots."),
			unusedImageLifetimeDays: z.int().positive(),
			// A week at least, as long as Vercel keeps a preview deployment, so a live preview keeps its
			// images.
			expiringImageLifetimeDays: z.int().min(7),
		}),
		display: z.object({
			// A page is one query, which the pagination schema's maxPageLimit in
			// src/application/pagination.ts caps at 100 recipes.
			recipesPerPage: z.int().positive().max(100),
			timeZone: timeZoneSchema,
		}),
		recipeLimits: z.object({
			maxTitleLength: z.int().positive(),
			maxDescriptionLength: z.int().positive(),
			maxNotesLength: z.int().positive(),
			maxSourceLength: z.int().positive(),
			maxYieldUnitLength: z.int().positive(),
			maxSectionHeadingLength: z.int().positive(),
			maxIngredientLineLength: z.int().positive(),
			maxStepLength: z.int().positive(),
			// A tag's search key past about 2,700 bytes fails the insert on recipes_tag_keys_idx, and a
			// character takes up to four bytes.
			maxTagLength: z.int().positive().max(500),
			maxImageAltLength: z.int().positive(),
			maxIngredientLinesPerRecipe: z.int().positive(),
			maxStepsPerRecipe: z.int().positive(),
			maxSectionsPerList: z.int().positive(),
			maxTagsPerRecipe: z.int().positive(),
		}),
	})
	.refine(({ photos }) => photos.maxScansPerImport <= photos.maxScansPerRecipe, {
		message: "Keep an import's scans within a recipe's: maxScansPerRecipe or fewer.",
		path: ['photos', 'maxScansPerImport'],
	});
