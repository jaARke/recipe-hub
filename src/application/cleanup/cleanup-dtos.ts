import 'server-only';
import type { ImageSweepCounts } from '@/application/recipes/recipe-dtos';

// What each cleanup step did when it ran.
export type CleanupCounts = {
	// Imports still running past their lease, recorded as failed.
	interruptedImports: { settledCount: number };
	// Imports whose drafts and source URLs expired, now cleared.
	importDrafts: { clearedCount: number };
	// Drafts members saved from the recipe form, past their lifetime.
	savedDrafts: { deletedCount: number };
	// Invites no account used, closed for an invite lifetime.
	invites: { deletedCount: number };
	sessions: { deletedCount: number };
	verifications: { deletedCount: number };
	// Skipped while another image move runs.
	imageSweep: ImageSweepCounts | 'skipped';
};

// Every step, with what it did, or failed when it threw.
export type CleanupReport = { [Step in keyof CleanupCounts]: CleanupCounts[Step] | 'failed' };
