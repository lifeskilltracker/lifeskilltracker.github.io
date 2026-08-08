import { describe, expect, it } from 'vitest';
import {
	APP_TITLE,
	BASE_PATH_ENV,
	PRERENDER_ROOT,
	STATIC_ADAPTER_FALLBACK
} from './config';

describe('scaffold config contract', () => {
	it('declares adapter-static fallback for GitHub Pages', () => {
		expect(STATIC_ADAPTER_FALLBACK).toBe('404.html');
	});

	it('names the base-path environment variable', () => {
		expect(BASE_PATH_ENV).toBe('BASE_PATH');
	});

	it('exports a non-empty application title', () => {
		expect(APP_TITLE.length).toBeGreaterThan(0);
	});

	it('prerenders the root route for index.html output', () => {
		expect(PRERENDER_ROOT).toBe(true);
	});
});
