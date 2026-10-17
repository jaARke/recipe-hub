import { afterEach, beforeEach } from 'vitest';
import { page, server } from 'vitest/browser';
// The site's stylesheet, without which sr-only text joins accessible names and nothing is laid out.
import './src/app/globals.css';

// A reader's page has focus, which a test's frame lacks until it asks, and without which Firefox
// leaves focus() undone.
beforeEach(() => {
	window.focus();
});

// Vitest sets the configured viewport once per file, so a test that sets its own hands it back here.
afterEach(async () => {
	const { width, height } = server.config.browser.viewport;
	await page.viewport(width, height);
});
