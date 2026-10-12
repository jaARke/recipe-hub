import { Fragment } from 'react';
import type { HighlightedText } from '@/application/ports/recipe-search';

// Every run renders as text, never as markup, so recipe text cannot inject elements.
function HighlightedSegments({ text }: { text: HighlightedText }) {
	return text.map((segment, index) =>
		segment.highlighted ? (
			<mark key={index}>{segment.text}</mark>
		) : (
			<Fragment key={index}>{segment.text}</Fragment>
		)
	);
}

export { HighlightedSegments };
