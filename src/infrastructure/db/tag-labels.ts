import 'server-only';
import { count, desc, sql, type SQL } from 'drizzle-orm';
import { recipes } from '@/infrastructure/db/schema';

// The one rule for labeling and ordering tags, which search facets and the recipe form's suggestions
// share. A query cross joins recipeTags, groups by tagKeyColumn, and selects tagLabel.

// Each tag of each recipe as a row of its key and label.
export const recipeTags = sql`unnest(${recipes.tagKeys}, ${recipes.tags}) as tag(key, label)`;

export const tagKeyColumn = sql`tag.key`;

// The earliest recipe's spelling, so a later spelling never relabels a tag.
export const tagLabel = sql<string>`(array_agg(tag.label order by ${recipes.createdAt}, ${recipes.id}))[1]`;

// Most used first, and tags used as often by key: the label ignoring case.
export const tagOrder: SQL[] = [desc(count()), tagKeyColumn];
