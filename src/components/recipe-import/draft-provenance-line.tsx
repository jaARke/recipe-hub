import { RecipeImportedFrom } from '@/components/recipe/recipe-detail';
import type { RecipeImportMode } from '@/domain/recipe/recipe-import';

type DraftProvenanceLineProps = {
	// How the import the draft came from read the recipe; absent for a draft entered by hand.
	mode: RecipeImportMode | undefined;
	// For a URL import, the page the recipe was read from.
	sourceUrl: string | undefined;
};

// Where an import's draft came from, under the heading of the page that opens it: an import's
// review, or a draft saved from one. A draft entered by hand shows nothing.
function DraftProvenanceLine({ mode, sourceUrl }: DraftProvenanceLineProps) {
	if (mode === 'photo') {
		return <p className="text-sm text-muted-foreground">Read from your photos</p>;
	}
	return mode === 'url' && sourceUrl !== undefined ? (
		<RecipeImportedFrom sourceUrl={sourceUrl} />
	) : null;
}

export { DraftProvenanceLine };
