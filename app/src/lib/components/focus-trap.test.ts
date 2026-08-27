// @vitest-environment jsdom

/**
 * The shared modal focus cycle (§15.3). Asserted over real DOM rather than a
 * mounted component: the question is "where does Tab go", and every edge of it
 * is reachable here without either dialogue being involved.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { focusableWithin, tabTarget } from './focus-trap.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function dialogWith(inner: string): HTMLElement {
  const container = document.createElement('div');
  container.tabIndex = -1;
  container.innerHTML = inner;
  document.body.append(container);
  return container;
}

describe('focusableWithin', () => {
  it('finds buttons, links and fields in document order', () => {
    const container = dialogWith(
      '<button id="a">a</button><a id="b" href="/x">b</a><input id="c" />',
    );
    expect(focusableWithin(container).map((el) => el.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips disabled controls and tabindex="-1"', () => {
    const container = dialogWith(
      '<button id="a">a</button><button disabled>no</button><div tabindex="-1">no</div>',
    );
    expect(focusableWithin(container).map((el) => el.id)).toEqual(['a']);
  });

  it('never counts the container itself, which is focusable but not a stop', () => {
    const container = dialogWith('<button id="a">a</button>');
    expect(focusableWithin(container)).not.toContain(container);
  });

  it('is empty for a null container rather than throwing', () => {
    expect(focusableWithin(null)).toEqual([]);
  });
});

describe('tabTarget', () => {
  it('wraps forward from the last stop to the first', () => {
    const container = dialogWith('<button id="a">a</button><button id="b">b</button>');
    const [first, last] = focusableWithin(container);
    expect(tabTarget(container, last, false)).toBe(first);
  });

  it('wraps backward from the first stop to the last', () => {
    const container = dialogWith('<button id="a">a</button><button id="b">b</button>');
    const [first, last] = focusableWithin(container);
    expect(tabTarget(container, first, true)).toBe(last);
  });

  it('wraps backward from the container itself', () => {
    // A dialogue focuses its own container on open so the label is announced
    // before the first control; Shift+Tab from there must not leave.
    const container = dialogWith('<button id="a">a</button><button id="b">b</button>');
    const last = focusableWithin(container)[1];
    expect(tabTarget(container, container, true)).toBe(last);
  });

  it('yields to the browser in the middle of the cycle', () => {
    const container = dialogWith(
      '<button id="a">a</button><button id="b">b</button><button id="c">c</button>',
    );
    const middle = focusableWithin(container)[1];
    expect(tabTarget(container, middle, false)).toBeNull();
    expect(tabTarget(container, middle, true)).toBeNull();
  });

  it('has nothing to say about a dialogue with no controls', () => {
    const container = dialogWith('<p>nothing here</p>');
    expect(tabTarget(container, container, false)).toBeNull();
    expect(tabTarget(container, container, true)).toBeNull();
  });

  it('holds a single stop in place in both directions', () => {
    const container = dialogWith('<button id="only">only</button>');
    const only = focusableWithin(container)[0];
    expect(tabTarget(container, only, false)).toBe(only);
    expect(tabTarget(container, only, true)).toBe(only);
  });
});
