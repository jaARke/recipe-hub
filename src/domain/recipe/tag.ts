import { z } from 'zod';
import { normalizeTagLabel, uniqueTagLabels } from '@/domain/recipe/tag-normalization';

export const tagLabelSchema = z.string().overwrite(normalizeTagLabel).min(1, 'Enter a tag.');

export const tagListSchema = z.array(tagLabelSchema).overwrite(uniqueTagLabels);
