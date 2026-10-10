import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']),
	// Set by Vercel on deployments; absent when running Next.js directly.
	VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
});

export const env = envSchema.parse(process.env);
