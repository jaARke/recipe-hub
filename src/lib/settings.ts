import type { z } from 'zod';
import type { settingsSchema } from '@/lib/settings-schema';

// Product policy: the values the owner tunes, each beside its reason. The site's name and description
// are in src/lib/site.ts, secrets and per-environment values in src/lib/env.ts, and engineering bounds
// beside the code they protect. Client code, scripts, and next.config.ts import this file, so it holds
// plain values; next.config.ts checks them against src/lib/settings-schema.ts, so a value outside its
// range fails `pnpm dev`, `pnpm test`, and `pnpm build`.
export const settings: z.output<typeof settingsSchema> = {
	photos: {
		// The most dish photos one recipe shows: the finished dish and its steps, few enough to page
		// through.
		maxDishPhotosPerRecipe: 12,
		// The most scans one recipe keeps: every page of a written recipe, imported or added in the form.
		maxScansPerRecipe: 12,
		// The pages one photo import reads together, such as both sides of a recipe card.
		maxScansPerImport: 6,
	},
	imports: {
		// Imports a member may start in any rolling 24 hours, so one account cannot spend the AI budget
		// alone. Admins have no limit.
		maxImportsPerDay: 50,
		// The unsaved drafts listed beside the import forms, newest first: the ones a member is likely
		// still reviewing.
		maxUnsavedImports: 10,
		// How long a member has to review an import's draft and save it as a recipe; then the draft and
		// its source URL are cleared.
		importDraftLifetimeDays: 7,
	},
	ai: {
		// The AI Gateway models that read a page's text and photos of a written recipe, chosen by
		// `pnpm evaluate` and tuned independently. Composition passes them to the extractors, since the
		// evaluation passes its own.
		pageModelId: 'anthropic/claude-sonnet-5.5',
		scanModelId: 'anthropic/claude-sonnet-5.5',
		// Bounds a model call and its retries. Several pages of handwriting take the longest.
		extractionTimeoutMs: 90_000,
	},
	accounts: {
		// How long an invite link works: long enough for the invitee to get to it, short enough that a
		// forgotten link stops working.
		inviteLifetimeDays: 7,
		// How long an emailed sign-in code works: time for an unhurried reader to find the email, perhaps
		// in spam, and type the code. Better Auth enforces it and the email states it.
		signInCodeLifetimeMinutes: 30,
		// How long a session lasts without a visit; each day's first visit renews it, so a member who
		// cooks from the site now and then stays signed in.
		sessionLifetimeDays: 180,
	},
	favorites: {
		// The most favorites a signed-out reader's device keeps: as many as its one cookie holds. A
		// member's account keeps any number.
		maxPerDevice: 100,
	},
	cooking: {
		// How long a recipe's checked rows in cooking mode last on a device after the last change: through
		// a dish made over two days, but gone by the next time it is made.
		progressLifetimeHours: 48,
	},
	retention: {
		// How long a removed photo or scan is kept before it is deleted for good: past Neon's 35-day
		// snapshots, so restoring a deleted recipe from one brings its images back.
		removedImageLifetimeDays: 40,
		// How long an upload that no recipe or import draft names is kept, so a recipe being written can
		// still save it.
		unusedImageLifetimeDays: 1,
		// How long an image in an expiring environment's folders, such as a preview's, is kept after it
		// was uploaded or removed. Nothing says when a branch's previews are gone, so its images go by age.
		expiringImageLifetimeDays: 30,
	},
	display: {
		// Recipes on each page of the home page and search: a multiple of six, so a full page ends on a
		// full row at every grid width.
		recipesPerPage: 24,
		// Every date shows in this zone, because the server runs in UTC and an evening date would read as
		// the next day.
		timeZone: 'America/New_York',
	},
	recipeLimits: {
		// Generous caps, checked when a recipe or an import's draft is written: real recipes stay far
		// inside them, and a runaway paste does not. A stored recipe past a lowered limit still loads,
		// and its next save names the field.

		// Room for a long name, such as one that names its cook.
		maxTitleLength: 200,
		// A paragraph or two introducing the recipe.
		maxDescriptionLength: 2_000,
		// The story behind a recipe, pages long if need be.
		maxNotesLength: 20_000,
		// A person, or a cookbook and its page.
		maxSourceLength: 300,
		// Words such as "9-inch pie" or "dozen cookies".
		maxYieldUnitLength: 100,
		// A heading such as "For the glaze".
		maxSectionHeadingLength: 200,
		// Any ingredient as written, with its notes.
		maxIngredientLineLength: 500,
		// A long step written as one paragraph.
		maxStepLength: 5_000,
		// A label for browsing, such as "Weeknight", which search lists as a filter.
		maxTagLength: 50,
		// A description of a photo for someone who can't see it.
		maxImageAltLength: 1_000,
		// Ingredients across all a recipe's sections, more than any recipe needs.
		maxIngredientLinesPerRecipe: 300,
		// Steps across all a recipe's sections, more than any recipe needs.
		maxStepsPerRecipe: 300,
		// Sections in the ingredients, and in the steps: one for each part of a dish and then some.
		maxSectionsPerList: 30,
		// Enough to file a recipe under every course, occasion, and cook it belongs to.
		maxTagsPerRecipe: 30,
	},
};
