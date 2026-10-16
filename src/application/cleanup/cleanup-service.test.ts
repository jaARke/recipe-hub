import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { CleanupReport } from '@/application/cleanup/cleanup-dtos';
import { CleanupService } from '@/application/cleanup/cleanup-service';
import { RecipeImportService } from '@/application/ingestion/recipe-import-service';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import {
	FixedPageRecipeExtractor,
	FixedScanRecipeExtractor,
} from '@/application/testing/fixed-recipe-extractors';
import { FixedWebPageFetcher } from '@/application/testing/fixed-web-page-fetcher';
import { InMemoryImageMoveLock } from '@/application/testing/in-memory-image-move-lock';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { InMemorySignInRepository } from '@/application/testing/in-memory-sign-in-repository';
import { memberIdSchema } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

const folders = new ImageFolders('production');
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const unusedUpload = 'dish/production/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const sourceUrl = 'https://recipes.example.com/fresh-lemonade';
const inviteLifetime = settings.accounts.inviteLifetimeDays;

let consoleInfo: MockInstance<typeof console.info>;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
	// Keeps log lines out of the test output; the tests that check logging read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

function daysAgo(days: number): Date {
	return new Date(Date.now() - daysInMilliseconds(days));
}

function logLines(spy: MockInstance<(...args: unknown[]) => void>): unknown[] {
	return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

// Production's stores, as its cron finds them: in each, something past its lifetime beside something
// within it.
async function createCleanup() {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const drafts = new InMemorySavedDraftRepository();
	const invites = new InMemoryInviteRepository();
	const signIns = new InMemorySignInRepository();
	const images = new InMemoryImageStore(folders);
	const lock = new InMemoryImageMoveLock();
	const actors = new FixedActorProvider(anonymousActor());
	const { memberId } = memberActor();

	const startImport = async (): Promise<RecipeImportId> => {
		const started = await imports.start({ memberId, mode: 'url' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		return started.id;
	};
	const importWithDraft = async (startedAt: Date): Promise<RecipeImportId> => {
		const id = await startImport();
		await imports.recordSuccess(id, {
			draft: { content: { title: 'Fresh lemonade' }, problems: [] },
			sourceUrl,
		});
		imports.backdate(id, startedAt);
		return id;
	};
	const interruptedImport = await startImport();
	imports.backdate(interruptedImport, new Date(Date.now() - 11 * 60 * 1000));
	const runningImport = await startImport();
	const expiredImport = await importWithDraft(
		daysAgo(settings.imports.importDraftLifetimeDays + 1)
	);
	const recentImport = await importWithDraft(daysAgo(settings.imports.importDraftLifetimeDays - 1));

	const saveDraft = async (savedAt: Date) => {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [] });
		if (draft === null) {
			throw new Error('The draft was refused');
		}
		drafts.backdate(draft.id, savedAt);
		return draft.id;
	};
	const savedDraftLifetime = settings.drafts.savedDraftLifetimeDays;
	const expiredDraft = await saveDraft(daysAgo(savedDraftLifetime + 1));
	const recentDraft = await saveDraft(daysAgo(savedDraftLifetime - 1));

	// An invite issued at the time, closed by its revocation or its expiry, or used.
	const invite = async (
		name: string,
		expiresAt: Date,
		closing: { revokedAt?: Date; used?: boolean } = {}
	): Promise<string> => {
		const tokenHash = `${name}-token-hash`;
		const issued = await invites.create({
			tokenHash,
			displayName: name,
			role: 'member',
			createdBy: memberId,
			expiresAt,
		});
		if (closing.revokedAt !== undefined) {
			await invites.revoke(issued.id, closing.revokedAt);
		}
		if (closing.used === true) {
			invites.accept(issued.id, memberIdSchema.parse(crypto.randomUUID()));
		}
		return tokenHash;
	};
	const invitesByFate = {
		deleted: [
			// Revoked over a lifetime ago, though it would only lately have expired.
			await invite('revoked-long-ago', daysAgo(1), { revokedAt: daysAgo(inviteLifetime + 1) }),
			await invite('expired-long-ago', daysAgo(inviteLifetime + 1)),
		],
		kept: [
			await invite('revoked-lately', daysAgo(-1), { revokedAt: daysAgo(inviteLifetime - 1) }),
			await invite('expired-lately', daysAgo(inviteLifetime - 1)),
			await invite('used-long-ago', daysAgo(inviteLifetime + 30), { used: true }),
			await invite('open', daysAgo(-inviteLifetime)),
		],
	};

	signIns.addSession(daysAgo(1));
	signIns.addSession(daysAgo(-1));
	signIns.addVerification(daysAgo(1));
	signIns.addVerification(daysAgo(2));
	signIns.addVerification(daysAgo(-1));

	await images.put(unusedUpload, jpeg, 'image/jpeg');
	images.backdateUpload(unusedUpload, daysAgo(settings.retention.unusedImageLifetimeDays + 1));

	const importService = new RecipeImportService(
		recipes,
		imports,
		drafts,
		new FixedWebPageFetcher(new Error('The cleanup reads no page')),
		new FixedPageRecipeExtractor(null),
		new FixedPageRecipeExtractor(null),
		new FixedScanRecipeExtractor(null),
		images,
		actors,
		folders
	);
	const imageService = new RecipeImageService(
		recipes,
		imports,
		drafts,
		images,
		actors,
		folders,
		lock,
		() => {},
		false
	);
	const service = new CleanupService(importService, drafts, invites, signIns, imageService);
	const remainingInvites = async (tokenHashes: readonly string[]): Promise<string[]> => {
		const found = await Promise.all(tokenHashes.map((hash) => invites.findByTokenHash(hash)));
		return tokenHashes.filter((_hash, index) => found[index] !== null);
	};

	return {
		service,
		imports,
		drafts,
		invites,
		signIns,
		images,
		lock,
		interruptedImport,
		runningImport,
		expiredImport,
		recentImport,
		expiredDraft,
		recentDraft,
		invitesByFate,
		remainingInvites,
	};
}

// A run in which every step deletes what createCleanup left past its lifetime.
const fullReport: CleanupReport = {
	interruptedImports: { settledCount: 1 },
	importDrafts: { clearedCount: 1 },
	savedDrafts: { deletedCount: 1 },
	invites: { deletedCount: 2 },
	sessions: { deletedCount: 1 },
	verifications: { deletedCount: 2 },
	imageSweep: {
		restoredCount: 0,
		deletedCount: 0,
		removedCount: 1,
		expiredCount: 0,
		failedCount: 0,
	},
};

describe('runCleanup', () => {
	it('deletes what is past its lifetime in every step, keeps the rest, and logs one line', async () => {
		const cleanup = await createCleanup();

		const report = await cleanup.service.runCleanup();

		expect(report).toEqual(fullReport);
		expect(await cleanup.imports.findById(cleanup.interruptedImport)).toMatchObject({
			status: 'failed',
			failure: 'import.interrupted',
		});
		expect(await cleanup.imports.findById(cleanup.runningImport)).toMatchObject({
			status: 'running',
		});
		expect(await cleanup.imports.findById(cleanup.expiredImport)).not.toHaveProperty('draft');
		expect(await cleanup.imports.findById(cleanup.recentImport)).toMatchObject({ sourceUrl });
		expect(await cleanup.drafts.findById(cleanup.expiredDraft)).toBeNull();
		expect(await cleanup.drafts.findById(cleanup.recentDraft)).not.toBeNull();
		expect(await cleanup.remainingInvites(cleanup.invitesByFate.deleted)).toEqual([]);
		expect(await cleanup.remainingInvites(cleanup.invitesByFate.kept)).toEqual(
			cleanup.invitesByFate.kept
		);
		expect([cleanup.signIns.sessionCount, cleanup.signIns.verificationCount]).toEqual([1, 1]);
		expect(cleanup.images.removedPathnames).toEqual([unusedUpload]);
		expect(logLines(consoleInfo)).toContainEqual({
			level: 'info',
			logger: 'cleanup',
			message: 'Cleanup finished',
			...fullReport,
		});
	});

	it('deletes nothing more on a second run, so a repeated delivery is harmless', async () => {
		const cleanup = await createCleanup();
		await cleanup.service.runCleanup();

		expect(await cleanup.service.runCleanup()).toEqual({
			interruptedImports: { settledCount: 0 },
			importDrafts: { clearedCount: 0 },
			savedDrafts: { deletedCount: 0 },
			invites: { deletedCount: 0 },
			sessions: { deletedCount: 0 },
			verifications: { deletedCount: 0 },
			imageSweep: {
				restoredCount: 0,
				deletedCount: 0,
				removedCount: 0,
				expiredCount: 0,
				failedCount: 0,
			},
		});
	});

	it("reports a failing step as failed, logs its error, and keeps the other steps' counts", async () => {
		const cleanup = await createCleanup();
		vi.spyOn(cleanup.invites, 'deleteUnusedClosedBefore').mockRejectedValueOnce(
			new Error('Database is unreachable')
		);

		const report = await cleanup.service.runCleanup();

		expect(report).toEqual({ ...fullReport, invites: 'failed' });
		expect(logLines(consoleError)).toEqual([
			expect.objectContaining({
				level: 'error',
				logger: 'cleanup',
				message: 'Cleanup step failed',
				step: 'invites',
				err: expect.objectContaining({ message: 'Database is unreachable' }),
			}),
		]);
		expect(logLines(consoleInfo)).toContainEqual(
			expect.objectContaining({ message: 'Cleanup finished', invites: 'failed' })
		);
		expect(await cleanup.remainingInvites(cleanup.invitesByFate.deleted)).toEqual(
			cleanup.invitesByFate.deleted
		);
	});

	it('reports the image sweep skipped while another image move holds the lock', async () => {
		const cleanup = await createCleanup();
		const move = Promise.withResolvers<void>();
		const moving = cleanup.lock.tryRun(() => move.promise);

		const report = await cleanup.service.runCleanup();
		move.resolve();
		await moving;

		expect(report).toEqual({ ...fullReport, imageSweep: 'skipped' });
		expect(await cleanup.images.has(unusedUpload)).toBe(true);
	});
});
