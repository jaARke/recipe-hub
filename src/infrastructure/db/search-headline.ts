import 'server-only';
import type { HighlightedText } from '@/application/ports/recipe-search';

// Matches are marked with control characters and split into segments, so recipe text is never
// read as markup.
const matchStart = '\u0002';
const matchStop = '\u0003';
const marks = new RegExp(`(${matchStart}|${matchStop})`);

const ellipsis = '…';
const fragmentDelimiter = ` ${ellipsis} `;

const markOptions = `StartSel=${matchStart}, StopSel=${matchStop}`;

export const titleHeadlineOptions = `${markOptions}, HighlightAll=true`;
// Fragments would otherwise drop words of three letters or fewer from their edges, even when the
// whole passage fits.
export const passageHeadlineOptions = `${markOptions}, MaxWords=24, MinWords=10, MaxFragments=2, FragmentDelimiter="${fragmentDelimiter}", ShortWord=0`;

function words(text: string): string[] {
	return text.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function startsWithWords(text: string[], start: string[]): boolean {
	return start.length <= text.length && start.every((word, index) => text[index] === word);
}

function endsWithWords(text: string[], end: string[]): boolean {
	const offset = text.length - end.length;
	return offset >= 0 && end.every((word, index) => text[offset + index] === word);
}

export function plainText(text: string): HighlightedText {
	return [{ text, highlighted: false }];
}

export function hasMatch(headline: string): boolean {
	return headline.includes(matchStart);
}

export function toHighlightedText(headline: string): HighlightedText {
	const segments: HighlightedText = [];
	let highlighted = false;
	for (const part of headline.split(marks)) {
		if (part === matchStart || part === matchStop) {
			highlighted = part === matchStart;
		} else if (part !== '') {
			segments.push({ text: part, highlighted });
		}
	}
	return segments;
}

// ts_headline cuts fragments without a sign and drops their edge punctuation and markup, so words
// decide whether a fragment starts or ends inside the text.
export function toSnippet(headline: string, text: string): HighlightedText {
	const fragments = headline.split(fragmentDelimiter);
	const textWords = words(text);
	const opening = startsWithWords(textWords, words(fragments[0] ?? '')) ? '' : `${ellipsis} `;
	const closing = endsWithWords(textWords, words(fragments.at(-1) ?? '')) ? '' : ` ${ellipsis}`;
	return toHighlightedText(`${opening}${headline}${closing}`);
}
