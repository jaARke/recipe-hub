// C0 controls and DEL, except tab, line feed, and carriage return: invisible, and NUL cannot be stored.
const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// A Windows or old Mac line break.
const carriageReturns = /\r\n?/g;

// Tabs and every space separator, the no-break spaces included.
const spaceRuns = /[\t\p{Zs}]+/gu;

// The one space left at either end of a line once runs are collapsed.
const lineEndSpaces = /^ | ?\n ?| $/g;

function isTrailingCharacter(character: string, punctuation: string): boolean {
	return punctuation.includes(character) || /\s/u.test(character);
}

// Composed (NFC), so text that reads the same is stored the same and filters as one source. Line
// breaks stay, as LF; runs of spaces and tabs become one space, and none starts or ends a line.
export function normalizeText(text: string): string {
	return text
		.replace(controlCharacters, '')
		.normalize('NFC')
		.replace(carriageReturns, '\n')
		.replace(spaceRuns, ' ')
		.replace(lineEndSpaces, (match) => (match.includes('\n') ? '\n' : ''));
}

// The text without the given punctuation, or whitespace among it, at its end: "Salt;" is "Salt". A
// loop, since a pattern such as /[;,\s]+$/ takes quadratic time on a long run short of the end.
export function withoutTrailingPunctuation(text: string, punctuation: string): string {
	let end = text.length;
	while (end > 0 && isTrailingCharacter(text.charAt(end - 1), punctuation)) {
		end -= 1;
	}
	return text.slice(0, end);
}
