import 'server-only';
import { z } from 'zod';

// What an editor sends as the version it loaded or last saved, a recipe's or a draft's: its
// updatedAt from Date.toISOString(), so a save can be refused when it no longer matches.
export const editVersionSchema = z.iso.datetime().transform((value) => new Date(value));
