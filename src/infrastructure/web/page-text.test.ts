import { describe, expect, it } from 'vitest';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { sampleButtermilkBiscuits } from '@/domain/recipe/samples/sample-recipes';
import { pageText } from '@/infrastructure/web/page-text';

const pageUrl = 'https://blog.example.com/buttermilk-biscuits/';

const lines = sampleButtermilkBiscuits.ingredientSections.flatMap((section) =>
	section.lines.map((line) => line.text)
);
const steps = sampleButtermilkBiscuits.instructionSections.flatMap((section) =>
	section.steps.map((step) => step.text)
);

function pageWith(body: string, url = pageUrl): WebPage {
	return {
		url,
		html: `<!doctype html><html><head><title>Biscuits</title><style>p { color: red }</style></head><body>${body}</body></html>`,
	};
}

// A blog post as WordPress themes lay one out, with the recipe card after the story.
const blogPost = `
	<header><nav><a href="/">Home</a> <a href="/recipes/">Recipes</a></nav></header>
	<main>
		<h1>${sampleButtermilkBiscuits.title}</h1>
		<p>${sampleButtermilkBiscuits.description}</p>
		<img src="/biscuits.jpg" alt="A plate of biscuits">
		<script>window.ads = ['Buy now'];</script>
		<div class="recipe-card" id="recipe">
			<h2>Ingredients</h2>
			<ul>${lines.map((line) => `<li><span class="amount">${line}</span></li>`).join('')}</ul>
			<h2>Instructions</h2>
			<ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol>
			<p>Adapted from <a href="https://cookbook.example.com/">an old cookbook</a>.</p>
		</div>
	</main>
	<footer>Comments</footer>
`;

describe('pageText', () => {
	it('keeps every heading, ingredient, and step on a line of its own', () => {
		const text = pageText(pageWith(blogPost)).split('\n');

		expect(text).toContain(sampleButtermilkBiscuits.title);
		expect(text).toContain('Ingredients');
		expect(text).toEqual(expect.arrayContaining(lines.map((line) => ` * ${line}`)));
		expect(text).toEqual(
			expect.arrayContaining(steps.map((step, index) => ` ${index + 1}. ${step}`))
		);
	});

	it('keeps a link’s text without its address, and leaves out images, scripts, and styles', () => {
		const text = pageText(pageWith(blogPost));

		expect(text).toContain('Adapted from an old cookbook.');
		expect(text).not.toMatch(/cookbook\.example\.com|biscuits\.jpg|A plate of biscuits/);
		expect(text).not.toMatch(/Buy now|color: red/);
	});

	it('starts at the element the address’s fragment names', () => {
		const text = pageText(pageWith(blogPost, `${pageUrl}#recipe`));

		expect(text.startsWith('Ingredients\n')).toBe(true);
		expect(text).not.toContain(sampleButtermilkBiscuits.title);
	});

	it('starts mid-paragraph at an anchor, as books mark their pages', () => {
		const page = pageWith(
			'<p>The end of the cake chapter. <a id="Page 485"></a>Biscuits come next.</p><p>Biscuits</p>',
			`${pageUrl}#Page%20485`
		);

		expect(pageText(page)).toBe('Biscuits come next.\n\nBiscuits');
	});

	it('reads the whole body when no element has the fragment’s id', () => {
		expect(pageText(pageWith(blogPost, `${pageUrl}#comments`))).toBe(pageText(pageWith(blogPost)));
	});

	it('cuts short nesting far deeper than real pages, rather than failing', () => {
		const body = `<p>Biscuits</p>${'<div>'.repeat(20_000)}lost${'</div>'.repeat(20_000)}`;

		expect(pageText(pageWith(body)).startsWith('Biscuits')).toBe(true);
	});

	it('stops at the last whole line within 100,000 characters', () => {
		const line = 'Stir in the buttermilk with a fork until a shaggy dough forms.';
		const body = Array.from({ length: 2000 }, (_, index) => `<p>${index} ${line}</p>`).join('');

		const text = pageText(pageWith(body));

		expect(text.length).toBeLessThanOrEqual(100_000);
		expect(text.length).toBeGreaterThan(99_000);
		expect(text.split('\n').at(-1)).toMatch(new RegExp(`^\\d+ ${line}$`));
	});
});
