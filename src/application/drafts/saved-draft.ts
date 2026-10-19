import 'server-only';
import { z } from 'zod';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

// A draft a member saves from the recipe form: the form's values, incomplete ones included, which
// only the form reads, so this layer keeps them as they came. It is kept for a while after its last
// save, and an import's review saved as a draft continues that import.

export const savedDraftIdSchema = z.uuid().brand<'SavedDraftId'>();
export type SavedDraftId = z.infer<typeof savedDraftIdSchema>;

// Drafts last saved before this time have expired.
export function savedDraftCutoff(now: Date): Date {
	return new Date(now.getTime() - daysInMilliseconds(settings.drafts.draftLifetimeDays));
}

// When a draft last saved at this time expires.
export function savedDraftExpiry(savedAt: Date): Date {
	return new Date(savedAt.getTime() + daysInMilliseconds(settings.drafts.draftLifetimeDays));
}
