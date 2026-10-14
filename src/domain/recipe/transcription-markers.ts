// What the scan extractor writes in place of text it can't read, and after a reading it is unsure
// of. Its prompt asks for these, and the recipe form flags each one left in a recipe, since a
// marker saved as written shows on the recipe page.
export const transcriptionMarkers = {
	illegible: '[illegible]',
	unsure: '[?]',
} as const;

export type TranscriptionMarker = keyof typeof transcriptionMarkers;

// What the member does about each marker, which the form says where one is left.
export const transcriptionMarkerFixes = {
	illegible: `Type what the original says in place of ${transcriptionMarkers.illegible}.`,
	unsure: `Check the word before ${transcriptionMarkers.unsure} against the original, then delete the ${transcriptionMarkers.unsure}.`,
} as const satisfies Record<TranscriptionMarker, string>;

// A run of text, which is a marker or holds none.
export type TranscriptionMarkerRun = {
	text: string;
	marker?: TranscriptionMarker;
};

const markerEntries = Object.entries(transcriptionMarkers) as [TranscriptionMarker, string][];

const markersByText = new Map(markerEntries.map(([marker, text]) => [text.toLowerCase(), marker]));

function escapedPattern(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Captures each marker, so splitting keeps it as a run of its own. A model may capitalize one.
const markerSplitter = new RegExp(
	`(${markerEntries.map(([, text]) => escapedPattern(text)).join('|')})`,
	'i'
);

// The text in runs, each marker a run of its own, so a preview can mark where they are.
export function transcriptionMarkerRuns(text: string): TranscriptionMarkerRun[] {
	return text.split(markerSplitter).flatMap((run, index): TranscriptionMarkerRun[] => {
		if (run === '') {
			return [];
		}
		// Splitting on a capture puts every captured marker at an odd index.
		return index % 2 === 1
			? [{ text: run, marker: markersByText.get(run.toLowerCase()) }]
			: [{ text: run }];
	});
}

// Each kind of marker the text holds, in the order the table lists them.
export function transcriptionMarkersIn(text: string): TranscriptionMarker[] {
	const found = new Set(transcriptionMarkerRuns(text).flatMap(({ marker }) => marker ?? []));
	return markerEntries.flatMap(([marker]) => (found.has(marker) ? [marker] : []));
}
