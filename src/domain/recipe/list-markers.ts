// Bullets, checkboxes, and step numbers that start a copied line, such as "• ", "▢ ", "2. ", "3: ",
// or "Step 4:", which the recipe page draws or numbers itself. An amount such as "1.5 cups" or a
// time such as "2:30" is no step number.
const listMarkers =
	/^\s*(?:[•·◦‣▪▫■□▢☐●○–—]\s*|[-*+](?:\s+|$)|\d+[.):](?:\s+|$)|step\s*\d+\b[\s.:)–—-]*)+/iu;

// The line without the markers that open it: "1. • 2 eggs" is "2 eggs".
export function withoutListMarkers(line: string): string {
	return line.replace(listMarkers, '');
}
