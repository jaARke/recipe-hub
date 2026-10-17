import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

// The site's own stylesheet, which a long-running dev server can keep serving as it was when the
// server started, while the utility classes it compiles stay current.
const globalsCssPath = 'src/app/globals.css';

// Each declaration globals.css makes that the page's served stylesheets lack, as "selector {
// property }". The browser parses the source, dropping Tailwind's at-rules, so both sides name
// selectors alike; values are compiled (oklch to hex, say), so only property names are compared.
export async function stylesheetDeclarationsNotServed(page: Page): Promise<string[]> {
	const source = await readFile(globalsCssPath, 'utf8');
	return page.evaluate((sourceText) => {
		function collect(rules: CSSRuleList, into: Map<string, Set<string>>) {
			for (const rule of rules) {
				if (rule instanceof CSSStyleRule) {
					const properties = into.get(rule.selectorText) ?? new Set<string>();
					for (const property of rule.style) {
						properties.add(property);
					}
					into.set(rule.selectorText, properties);
				}
				if ('cssRules' in rule && rule.cssRules instanceof CSSRuleList) {
					collect(rule.cssRules, into);
				}
			}
			return into;
		}

		const sourceSheet = new CSSStyleSheet();
		sourceSheet.replaceSync(sourceText);
		const declared = collect(sourceSheet.cssRules, new Map());
		const served = new Map<string, Set<string>>();
		for (const sheet of document.styleSheets) {
			collect(sheet.cssRules, served);
		}

		return [...declared].flatMap(([selector, properties]) =>
			[...properties]
				.filter((property) => served.get(selector)?.has(property) !== true)
				.map((property) => `${selector} { ${property} }`)
		);
	}, source);
}
