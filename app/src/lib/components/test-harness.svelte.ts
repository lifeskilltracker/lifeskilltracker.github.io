/**
 * The component test harness (T08).
 *
 * The repository had no way to test a rendered component before this file: the
 * engines are arithmetic and the loader and store are testable in node, so
 * nothing had yet needed a DOM. §9's renderer is the first thing whose whole
 * contract — glyphs, borders, `aria-hidden`, focus behaviour — exists only once
 * it is mounted.
 *
 * It is deliberately thin. `mount`/`unmount` are Svelte's own client API, and
 * props are handed over as a `$state` proxy so a test can drive a re-render the
 * way the application does — by changing a prop — rather than by re-mounting,
 * which would destroy the DOM identity §9.3's "class change, never DOM
 * re-creation" guarantee is stated in terms of.
 *
 * Requires `// @vitest-environment jsdom` in the calling file.
 */

import { flushSync, mount, unmount, type Component } from 'svelte';

export interface Mounted<Props extends Record<string, unknown>> {
	/** The element the component was mounted into. */
	container: HTMLElement;
	/** Live, reactive props: assign to one and the component re-renders. */
	props: Props;
	/**
	 * The component's own exports — what a caller gets from `bind:this`.
	 *
	 * Added by T34, whose level camera is an instance method rather than a prop:
	 * the camera moves a scroll container the component owns, and §7 puts the
	 * *controls* on the page around it, so the page has to be able to ask. A test
	 * that drove it only through a rendered button would be testing the button.
	 */
	instance: Record<string, unknown>;
	destroy(): void;
}

const mountedTargets: (() => void)[] = [];

export function render<Props extends Record<string, unknown>>(
	component: Component<Props>,
	initial: Props
): Mounted<Props> {
	const container = document.createElement('div');
	document.body.appendChild(container);

	const props = $state({ ...initial });
	const instance = mount(component, { target: container, props });
	// Mount schedules effects; a test that queried before they ran would see the
	// tree as it is before the page registers it, which is never what a user sees.
	flushSync();

	const destroy = () => {
		unmount(instance);
		container.remove();
	};
	mountedTargets.push(destroy);

	return { container, props, instance: instance as Record<string, unknown>, destroy };
}

/** Call from `afterEach`; leaked components would share `document`. */
export function cleanup(): void {
	while (mountedTargets.length > 0) mountedTargets.pop()?.();
}

/** Fire a real event and let Svelte settle, as a click in a browser would. */
export function fire(target: EventTarget, event: Event): void {
	target.dispatchEvent(event);
	flushSync();
}

export function click(element: Element): void {
	fire(element, new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function press(element: Element, key: string): void {
	fire(element, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

export function focus(element: Element): void {
	(element as HTMLElement).focus?.();
	fire(element, new FocusEvent('focusin', { bubbles: true }));
}

export { flushSync };
