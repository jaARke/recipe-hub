import { z } from 'zod';

// Text is trimmed and never blank; an optional text field is omitted rather than left empty.
export const nonEmptyTextSchema = z.string().trim().min(1, 'Enter some text.');
