import { z } from 'zod';
import { storedContent, type ContentLimits } from '@/domain/recipe/content-limits';
import { normalizeTagLabel, uniqueTagLabels } from '@/domain/recipe/tag-normalization';
import { limitMessage } from '@/domain/text';
import { settings } from '@/lib/settings';

export const tagLabelSchema = z.string().overwrite(normalizeTagLabel).min(1, 'Enter a tag.');

// Counted once repeats are dropped.
export function tagListSchemaFor(limits: ContentLimits) {
	return z
		.array(limits.text(settings.recipeLimits.maxTagLength, tagLabelSchema))
		.overwrite(uniqueTagLabels)
		.refine(
			(tags) => !limits.exceeds(tags.length, settings.recipeLimits.maxTagsPerRecipe),
			limitMessage(settings.recipeLimits.maxTagsPerRecipe, 'tags')
		);
}

// Tags as recipes store them, which search filters name whatever the limits are now.
export const storedTagListSchema = tagListSchemaFor(storedContent);
