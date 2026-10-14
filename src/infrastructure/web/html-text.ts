import 'server-only';

// What every reading of a page's HTML as text, through html-to-text, shares.

// How deep into nested elements the text reaches. Real pages nest far less, and deeper nesting is
// cut short rather than overflowing the stack.
export const maxHtmlDepth = 500;

// The library's default whitespace and the no-break space, which entities like &nbsp; leave inside
// lines.
export const htmlWhitespaceCharacters = ' \t\r\n\f​ ';
