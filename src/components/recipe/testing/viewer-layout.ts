import { vi } from 'vitest';

// The width and height every slide, image frame, and image at 100% is given.
export const stubbedFrame = { width: 400, height: 300 };

function laidOutWidth(element: HTMLElement): number {
	const slot = element.dataset.slot;
	if (
		slot === 'carousel-item' ||
		element.parentElement?.dataset.slot === 'carousel-content' ||
		element.dataset.slot === 'carousel-content' ||
		element.classList.contains('react-transform-component')
	) {
		return stubbedFrame.width;
	}
	return 0;
}

// happy-dom lays nothing out, so this lays out what the viewer measures: the carousel's slides side
// by side, each one frame wide, as Embla reads them, and each image whole in a frame of the same
// size, as react-zoom-pan-pinch reads them. Undo it with the function it returns.
export function stubViewerLayout(): () => void {
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		return laidOutWidth(this);
	});
	vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		return laidOutWidth(this) === 0 ? 0 : stubbedFrame.height;
	});
	vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		if (this.dataset.slot !== 'carousel-item' || this.parentElement === null) {
			return 0;
		}
		return Array.prototype.indexOf.call(this.parentElement.children, this) * stubbedFrame.width;
	});
	// No stylesheet is applied, so a margin reads empty, which Embla would read as NaN.
	const getPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
	vi.spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue').mockImplementation(function (
		this: CSSStyleDeclaration,
		property: string
	) {
		const value = getPropertyValue.call(this, property);
		return value === '' && property.startsWith('margin-') ? '0px' : value;
	});
	// happy-dom has no offsetParent, without which Embla takes no drags.
	Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
		configurable: true,
		get(this: HTMLElement) {
			return this.parentElement;
		},
	});
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		return this.classList.contains('react-transform-wrapper') ? stubbedFrame.width : 0;
	});
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		return this.classList.contains('react-transform-wrapper') ? stubbedFrame.height : 0;
	});
	return () => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(HTMLElement.prototype, 'offsetParent');
	};
}
