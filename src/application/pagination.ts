import 'server-only';
import { z } from 'zod';

// A public URL chooses the page, and every listed recipe loads its whole document.
const maxPageLimit = 100;

export const paginationSchema = z.object({
	limit: z.int().positive().max(maxPageLimit),
	offset: z.int().nonnegative(),
});
