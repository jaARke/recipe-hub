import { z } from 'zod';

// A single quantity, or a range when max is present.
export const amountSchema = z
	.object({
		min: z.number().positive('Enter an amount greater than zero.'),
		max: z.number().optional(),
	})
	.refine((amount) => amount.max === undefined || amount.max > amount.min, {
		message: 'Make the end of the range larger than the start.',
		path: ['max'],
	});
export type Amount = z.infer<typeof amountSchema>;
