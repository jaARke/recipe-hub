// Whether the reader asked for less motion, for what animates in script: the reduced-motion rule in
// globals.css reaches only CSS animations and transitions. Browser only.
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
	return window.matchMedia(reducedMotionQuery).matches;
}

export function subscribeToReducedMotion(onChange: () => void): () => void {
	const query = window.matchMedia(reducedMotionQuery);
	query.addEventListener('change', onChange);
	return () => query.removeEventListener('change', onChange);
}
