import { z } from 'zod';

export const durationMinutesSchema = z
	.int('Enter whole minutes.')
	.nonnegative('Enter zero or more minutes.');

export const recipeTimesSchema = z.object({
	prepMinutes: durationMinutesSchema.optional(),
	cookMinutes: durationMinutesSchema.optional(),
	totalMinutes: durationMinutesSchema.optional(),
});
export type RecipeTimes = z.infer<typeof recipeTimesSchema>;

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;

	if (hours === 0) {
		return `${remainder} min`;
	}

	if (remainder === 0) {
		return `${hours} hr`;
	}

	return `${hours} hr ${remainder} min`;
}

// ISO 8601, the form schema.org Recipe times take.
export function toIsoDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;

	if (hours === 0) {
		return `PT${remainder}M`;
	}

	if (remainder === 0) {
		return `PT${hours}H`;
	}

	return `PT${hours}H${remainder}M`;
}

// The stated total wins, since it can include time that is neither prep nor cooking, such as chilling.
export function totalMinutes(times: RecipeTimes): number | undefined {
	if (times.totalMinutes !== undefined) {
		return times.totalMinutes;
	}

	if (times.prepMinutes === undefined && times.cookMinutes === undefined) {
		return undefined;
	}

	return (times.prepMinutes ?? 0) + (times.cookMinutes ?? 0);
}
