import 'server-only';
import { z } from 'zod';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

// A member's draft: the recipe form's values, incomplete ones included, which only the form reads, so
// this layer keeps them as they came, or what an import read until the form first saves it. It is
// kept for a while after its last change.

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
