import 'server-only';
import type { RecipeTextQuery } from '@/application/ports/recipe-search';

// Phones type curly quotes, which websearch_to_tsquery would not read as a phrase.
const typographicQuotes = /[“”„‟]/g;

// tsquery operators, which websearch_to_tsquery skips between terms and which end a word.
const skippedOperators = new Set(['!', '&', '|', '(', ')', '<']);

type SearchTerm = {
	text: string;
	quoted: boolean;
	excluded: boolean;
};

// Postgres splits terms on ASCII whitespace only, so other spaces stay inside a word.
function isSpace(character: string): boolean {
	return /^[ \t\n\v\f\r]$/.test(character);
}

function isSeparator(character: string): boolean {
	return isSpace(character) || skippedOperators.has(character);
}

// A colon ends a word too, and then starts the next one.
function endsWord(character: string): boolean {
	return isSeparator(character) || character === '"' || character === ':';
}

function indexOrEnd(
	characters: readonly string[],
	from: number,
	matches: (character: string) => boolean
): number {
	const offset = characters.slice(from).findIndex(matches);
	return offset === -1 ? characters.length : from + offset;
}

// As in Postgres, "or" is an operator only as a whole word with something after it.
function isOrOperator(characters: readonly string[], index: number): boolean {
	const operator = characters.slice(index, index + 2).join('');
	const next = characters[index + 2];
	return (
		operator.toLowerCase() === 'or' &&
		next !== undefined &&
		!/^[\p{L}\p{N}_-]$/u.test(next) &&
		characters.slice(index + 3).some((character) => !isSpace(character))
	);
}

// Skips what follows a term up to the next one, including an "or" operator.
function nextTermStart(characters: readonly string[], from: number): number {
	const index = indexOrEnd(characters, from, (character) => !isSeparator(character));
	return isOrOperator(characters, index) ? index + 2 : index;
}

// Mirrors websearch_to_tsquery's tokenizer, so these are the terms Postgres searches for.
function searchTerms(text: string): SearchTerm[] {
	const characters = Array.from(text);
	const terms: SearchTerm[] = [];
	let excluded = false;
	let index = 0;

	for (let character = characters[index]; character !== undefined; character = characters[index]) {
		if (character === '-') {
			// Each dash negates, so a doubled dash cancels as it does in Postgres.
			excluded = !excluded;
			index += 1;
		} else if (isSeparator(character)) {
			index += 1;
		} else if (character === '"') {
			// An unclosed phrase runs to the end of the text.
			const end = indexOrEnd(characters, index + 1, (candidate) => candidate === '"');
			terms.push({ text: characters.slice(index + 1, end).join(''), quoted: true, excluded });
			excluded = false;
			index = nextTermStart(characters, end + 1);
		} else {
			const end = indexOrEnd(characters, index + 1, endsWord);
			terms.push({ text: characters.slice(index, end).join(''), quoted: false, excluded });
			excluded = false;
			index = nextTermStart(characters, end);
		}
	}

	return terms;
}

// Composed first, so a decomposed accent stays inside its word.
function termWords(text: string): string[] {
	return text.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Postgres parses the text itself; the words and exclusions here serve close matches.
export function parseRecipeTextQuery(text: string): RecipeTextQuery | undefined {
	const trimmed = text.trim().replace(typographicQuotes, '"');
	if (trimmed === '') {
		return undefined;
	}

	const terms = searchTerms(trimmed);
	return {
		text: trimmed,
		includedWords: terms.filter((term) => !term.excluded).flatMap((term) => termWords(term.text)),
		// A term without letters or numbers excludes nothing in Postgres either.
		excludedTerms: terms
			.filter((term) => term.excluded && termWords(term.text).length > 0)
			.map((term) => (term.quoted ? `"${term.text}"` : term.text)),
	};
}
