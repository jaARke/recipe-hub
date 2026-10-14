// C0 controls and DEL, except tab, line feed, and carriage return: invisible, and NUL cannot be stored.
const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Composed (NFC), so text that reads the same is stored the same and filters as one source.
export function normalizeText(text: string): string {
	return text.replace(controlCharacters, '').normalize('NFC');
}
