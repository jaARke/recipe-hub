import 'server-only';
import type { CleanupCounts, CleanupReport } from '@/application/cleanup/cleanup-dtos';
import { savedDraftCutoff } from '@/application/drafts/saved-draft';
import type { RecipeImportService } from '@/application/ingestion/recipe-import-service';
import type { InviteRepository } from '@/application/ports/invite-repository';
import type { SavedDraftRepository } from '@/application/ports/saved-draft-repository';
import type { SignInRepository } from '@/application/ports/sign-in-repository';
import type { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { closedInviteCutoff } from '@/domain/member/invite';
import { getLogger } from '@/lib/logger';

const logger = getLogger('cleanup');

type CleanupStep = keyof CleanupCounts;

// A step that fails is logged and reported as failed, and the run carries on. Every step finds its
// own work, so the next run picks up what this one left.
async function runStep<Step extends CleanupStep>(
	step: Step,
	run: () => Promise<CleanupCounts[Step]>
): Promise<CleanupReport[Step]> {
	try {
		return await run();
	} catch (err) {
		logger.error('Cleanup step failed', { step, err });
		return 'failed';
	}
}

// The time-based cleanup, which production's daily cron runs: each step through the service or
// repository that owns what it deletes. Readers already ignore what has expired, so a step that runs
// late changes only how long the data is kept.
export class CleanupService {
	private readonly imports: RecipeImportService;
	private readonly drafts: SavedDraftRepository;
	private readonly invites: InviteRepository;
	private readonly signIns: SignInRepository;
	private readonly images: RecipeImageService;

	constructor(
		imports: RecipeImportService,
		drafts: SavedDraftRepository,
		invites: InviteRepository,
		signIns: SignInRepository,
		images: RecipeImageService
	) {
		this.imports = imports;
		this.drafts = drafts;
		this.invites = invites;
		this.signIns = signIns;
		this.images = images;
	}

	// A system use case with no actor. The rows go first and the image sweep, the longest step, last,
	// so a run its function's time limit ends has still deleted them.
	async runCleanup(): Promise<CleanupReport> {
		const now = new Date();
		const report: CleanupReport = {
			interruptedImports: await runStep('interruptedImports', async () => ({
				settledCount: await this.imports.settleInterruptedImports(),
			})),
			savedDrafts: await runStep('savedDrafts', async () => ({
				deletedCount: await this.drafts.deleteSavedBefore(savedDraftCutoff(now)),
			})),
			invites: await runStep('invites', async () => ({
				deletedCount: await this.invites.deleteUnusedClosedBefore(closedInviteCutoff(now)),
			})),
			sessions: await runStep('sessions', async () => ({
				deletedCount: await this.signIns.deleteSessionsExpiredBefore(now),
			})),
			verifications: await runStep('verifications', async () => ({
				deletedCount: await this.signIns.deleteVerificationsExpiredBefore(now),
			})),
			imageSweep: await runStep('imageSweep', async () => {
				const attempt = await this.images.sweepImages();
				return attempt.status === 'ran' ? attempt.result : 'skipped';
			}),
		};
		logger.info('Cleanup finished', report);
		return report;
	}
}
