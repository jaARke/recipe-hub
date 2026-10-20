import type { Page } from '@playwright/test';

// The phone widths every page fits, from the narrowest phone in use to the widest.
const phoneWidths = { narrowest: 320, widest: 430 } as const;

// The widths between them a page is laid out at, every 10 px, so a wrap that fails at one is found.
const phoneWidthStep = 10;

export function phoneWidthsToCheck(): number[] {
	const widths: number[] = [];
	for (let width = phoneWidths.narrowest; width <= phoneWidths.widest; width += phoneWidthStep) {
		widths.push(width);
	}
	return widths;
}

// WCAG 2.2's minimum target size (2.5.8), in CSS pixels.
export const minimumTargetSize = 24;

// What each check found, run in the page, which describes an element by its tag, its id, and its
// accessible name or text, so a failure names what to fix.
type LayoutFindings = {
	horizontalOverflow: string[];
	smallTargets: string[];
	clippedText: string[];
};

export async function checkLayout(page: Page): Promise<LayoutFindings> {
	return page.evaluate((targetSize) => {
		const viewportWidth = document.documentElement.clientWidth;

		function describe(element: Element): string {
			const name =
				element.getAttribute('aria-label') ??
				(element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
			const id = element.id === '' ? '' : `#${element.id}`;
			return `<${element.tagName.toLowerCase()}${id}> "${name}"`;
		}

		// Visually hidden content, such as sr-only text or a custom control's native input, is cut to a
		// pixel on purpose.
		function visuallyHidden(element: Element): boolean {
			const rect = element.getBoundingClientRect();
			return (
				getComputedStyle(element).visibility === 'hidden' || (rect.width <= 1 && rect.height <= 1)
			);
		}

		function rendered(element: Element): boolean {
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0 && !visuallyHidden(element);
		}

		// The area a press lands on: the element's box, grown by an ::after placed around it, as the
		// checkbox and radio draw a small box but take presses across a larger one.
		function pressableSize(element: Element): { width: number; height: number } {
			const rect = element.getBoundingClientRect();
			const after = getComputedStyle(element, '::after');
			if (
				after.content === 'none' ||
				after.position !== 'absolute' ||
				getComputedStyle(element).position === 'static'
			) {
				return rect;
			}
			const outset = (inset: string) => Math.max(0, -Number.parseFloat(inset) || 0);
			return {
				width: rect.width + outset(after.left) + outset(after.right),
				height: rect.height + outset(after.top) + outset(after.bottom),
			};
		}

		// An ancestor that clips or scrolls its content sideways, such as a filmstrip, holds what
		// passes its edge, so only the ancestor itself must fit.
		function heldByAncestor(element: Element): boolean {
			for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
				if (parent === document.body || parent === document.documentElement) {
					return false;
				}
				if (getComputedStyle(parent).overflowX !== 'visible') {
					return true;
				}
			}
			return false;
		}

		const all = [...document.body.querySelectorAll('*')].filter(rendered);

		const overflowing = all.filter((element) => {
			const rect = element.getBoundingClientRect();
			return (rect.right > viewportWidth + 0.5 || rect.left < -0.5) && !heldByAncestor(element);
		});
		// The outermost of each, since what an overflowing element holds passes the edge with it.
		const horizontalOverflow = overflowing
			.filter(
				(element) => !overflowing.some((other) => other !== element && other.contains(element))
			)
			.map((element) => {
				const rect = element.getBoundingClientRect();
				return `${describe(element)} spans ${Math.round(rect.left)} to ${Math.round(rect.right)} px of ${viewportWidth}`;
			});
		if (horizontalOverflow.length === 0 && document.documentElement.scrollWidth > viewportWidth) {
			horizontalOverflow.push(
				`the page scrolls sideways to ${document.documentElement.scrollWidth} px of ${viewportWidth}`
			);
		}

		const targetSelector = [
			'a[href]',
			'button',
			'input:not([type="hidden"])',
			'select',
			'textarea',
			'summary',
			'[role="button"]',
			'[role="checkbox"]',
			'[role="combobox"]',
			'[role="link"]',
			'[role="menuitem"]',
			'[role="radio"]',
			'[role="switch"]',
			'[role="tab"]',
		].join(', ');
		const smallTargets = all
			.filter((element) => element.matches(targetSelector))
			// A link in a run of text is exempt (WCAG's inline exception).
			.filter((element) => getComputedStyle(element).display !== 'inline')
			.flatMap((element) => {
				// A control inside its label is pressed through the label too.
				const target = element.closest('label') ?? element;
				const size = pressableSize(target);
				return size.width + 0.5 < targetSize || size.height + 0.5 < targetSize
					? [`${describe(element)} is ${Math.round(size.width)} by ${Math.round(size.height)} px`]
					: [];
			});

		// Text an element hides past its edge, other than an ellipsis or a line clamp that says so.
		const clippedText = all
			.filter((element) => {
				const style = getComputedStyle(element);
				const clips =
					['hidden', 'clip'].includes(style.overflowX) ||
					['hidden', 'clip'].includes(style.overflowY);
				return (
					clips &&
					style.textOverflow !== 'ellipsis' &&
					style.webkitLineClamp === 'none' &&
					(element.textContent ?? '').trim() !== '' &&
					(element.scrollWidth > element.clientWidth + 1 ||
						element.scrollHeight > element.clientHeight + 1)
				);
			})
			.map(
				(element) =>
					`${describe(element)} shows ${element.clientWidth} by ${element.clientHeight} px of ${element.scrollWidth} by ${element.scrollHeight}`
			);

		return { horizontalOverflow, smallTargets, clippedText };
	}, minimumTargetSize);
}
