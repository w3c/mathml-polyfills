// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

/*
 * Restores MathML 3 / MathML 4 maction behavior on MathML Core.
 *
 * MathML Core lays maction out like mrow and its user-agent stylesheet hides
 * every child except the first. actiontype and selection have no effect.
 * MathML 4 still requires the selected sub-expression to be shown (1-based
 * selection, default 1). It names the MathML 3 actions toggle, statusline,
 * tooltip, and input, and leaves their behavior platform-specific. This
 * polyfill implements selection for every maction, and restores toggle and
 * tooltip with DOM events.
 *
 * Behavior
 * --------
 * Keep the maction element in the tree. Do not rewrite it to mrow. malign
 * already reads selection and walks only that branch, and MathML 4 treats
 * maction as the place actions attach.
 *
 * Count MathML-namespace element children only. selection defaults to 1.
 * A missing or unrecognized actiontype shows that child.
 *
 * MathML 4 compares an enumerated list of string values ASCII
 * case-insensitively, for compatibility with HTML. actiontype is an open
 * string, not an enumerated list, so toggle, tooltip, statusline, and input
 * are matched after trim and the match is case-sensitive. "Toggle" is not
 * toggle.
 *
 * HTML ASCII-lowercases attribute names while parsing (then restores
 * definitionURL). ActionType in an HTML page is therefore the actiontype
 * attribute. XML keeps the authored name, and this polyfill reads the DOM
 * name actiontype.
 *
 * tooltip and statusline show the first child. The second child is the
 * message. tooltip opens a popup after a short hover or on keyboard focus,
 * containing a math clone of that child so the message is rendered, not
 * flattened to a string. aria-describedby points at the popup.
 *
 * statusline does not set window.status. MathML Core's security notes call
 * out status-line spoofing, and browsers ignore window.status. The second
 * child's text is shown in a small page-owned status region on hover or focus.
 *
 * input does not turn the expression into an editor. The selected child is
 * shown and actiontype="input" stays in the markup.
 *
 * An invalid selection (not a positive integer, or out of range) or no
 * element children shows an merror with a short message. The original maction
 * stays in the tree. tooltip and statusline do not use selection; a bad
 * selection attribute on those does not become an error.
 *
 * toggle: click, Enter, or Space increments selection and wraps to 1. The new
 * value is written back to the attribute (MathML 3's clipboard rule).
 * cursor:pointer, tabindex="0", and role="button" mark it as activatable.
 * If nested mactions share an action type, only the innermost handles that event.
 *
 * The chosen child gets an inline display value that overrides the user-agent
 * rule hiding every non-first child. Chrome accepts display:block math.
 * Firefox rejects that value, so the assignment would be ignored and the
 * child would stay hidden; display:inline keeps Firefox's math layout and
 * still wins over that rule. The other children get display:none.
 *
 * Each maction is marked after the first pass so a second transform (the
 * acid-test button) does not stack listeners. Visibility is applied again.
 *
 * On later toggles, only the visibility and the selection attribute change.
 * Branches that were display:none during the first pass can have bad
 * measurements from later polyfills. This module does not re-run them.
 *
 * Import this module immediately after mstyle and before measuring polyfills
 * so the selected child is visible when they measure. Core has already hidden
 * non-first children before any plugin runs.
 */

import { _MathTransforms, MATHML_NS, cloneElementWithShadowRoot } from '../common/math-transforms.js';

const BOUND = 'data-maction-bound';
const ERROR_ATTR = 'data-maction-error';
const ERROR_TEXT = 'invalid selection';
const HIDDEN = 'none';

/**
 * Display value for the shown child. `block math` is the MathML Core box.
 * Firefox does not accept it, and an ignored value leaves the user-agent
 * display:none in place.
 * @param {string} value
 * @returns {boolean}
 */
function cssDisplayAccepted(value) {
  const probe = document.createElementNS(MATHML_NS, 'mrow');
  probe.style.display = value;
  return probe.style.display === value;
}

/** @type {string} */
export const SHOWN = cssDisplayAccepted('block math') ? 'block math' : 'inline';
/** Hover delay before a tooltip popup opens. Focus opens it immediately. */
export const TOOLTIP_DELAY_MS = 400;

const TOOLTIP_ID = 'maction-polyfill-tooltip';
const STATUS_ID = 'maction-polyfill-statusline';

/** @type {HTMLElement | null} */
let tooltipEl = null;
/** @type {Element | null} */
let tooltipOwner = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let tooltipTimer = null;
/** @type {Element | null} */
let tooltipPending = null;

/** @type {HTMLElement | null} */
let statusEl = null;
/** @type {Element | null} */
let statusOwner = null;

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isMathMLElement(el) {
  return el.namespaceURI === MATHML_NS;
}

/**
 * Element arguments of an maction. Ignores text, non-MathML elements, and the
 * error message this polyfill may have inserted.
 * @param {Element} el
 * @returns {Element[]}
 */
function mathChildren(el) {
  return [...el.children].filter((child) =>
    isMathMLElement(child) && !child.hasAttribute(ERROR_ATTR)
  );
}

/**
 * Trimmed actiontype. Callers compare it case-sensitively: MathML 4
 * case-folds enumerated values only, and actiontype is an open string.
 * Missing becomes ''.
 * @param {Element} el
 * @returns {string}
 */
function actionType(el) {
  const raw = el.getAttribute('actiontype');
  if (raw == null) return '';
  return raw.trim();
}

/**
 * Innermost maction of this action type at or above node.
 * Nested mactions of the same type: only that innermost one responds.
 * @param {EventTarget | null} node
 * @param {string} type
 * @returns {Element | null}
 */
function nearestMactionOfType(node, type) {
  let el = node instanceof Element ? node : null;
  while (el) {
    if (isMathMLElement(el) && el.localName === 'maction' && actionType(el) === type) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * 1-based selected child, or null when the attribute is not a positive integer
 * in range. A missing attribute defaults to 1.
 * @param {Element} el
 * @param {number} count
 * @returns {number | null}
 */
function selectedNumber(el, count) {
  if (!el.hasAttribute('selection')) {
    return count >= 1 ? 1 : null;
  }
  const raw = /** @type {string} */ (el.getAttribute('selection')).trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  if (n > count) return null;
  return n;
}

/**
 * @param {Element} el
 * @param {Element | null} shown
 */
function showOnly(el, shown) {
  for (const child of el.children) {
    child.style.display = child === shown ? SHOWN : HIDDEN;
  }
}

/**
 * @param {Element} el
 */
function clearError(el) {
  const err = el.querySelector(':scope > [' + ERROR_ATTR + ']');
  if (err) err.remove();
}

/**
 * Visible merror, with the original children kept and hidden.
 * @param {Element} el
 */
function showError(el) {
  let err = el.querySelector(':scope > [' + ERROR_ATTR + ']');
  if (!err) {
    err = document.createElementNS(MATHML_NS, 'merror');
    err.setAttribute(ERROR_ATTR, '');
    const msg = document.createElementNS(MATHML_NS, 'mtext');
    msg.textContent = ERROR_TEXT;
    err.appendChild(msg);
    el.appendChild(err);
  }
  showOnly(el, err);
}

/**
 * @param {Element} el
 * @returns {Element | null}
 */
function shownChild(el) {
  const children = mathChildren(el);
  const type = actionType(el);
  // tooltip and statusline always present the first child. selection does not apply.
  if (type === 'tooltip' || type === 'statusline') {
    return children[0] || null;
  }
  const n = selectedNumber(el, children.length);
  if (n == null) return null;
  return children[n - 1] || null;
}

/**
 * @param {Element} el
 */
function applyVisibility(el) {
  const shown = shownChild(el);
  if (!shown) {
    showError(el);
    return;
  }
  clearError(el);
  showOnly(el, shown);
}

/**
 * @param {Element} el
 */
function cycleToggle(el) {
  const children = mathChildren(el);
  if (children.length === 0) return;
  const n = selectedNumber(el, children.length) || 1;
  const next = n >= children.length ? 1 : n + 1;
  el.setAttribute('selection', String(next));
  applyVisibility(el);
}

/**
 * @param {Element} el
 * @returns {string}
 */
function messageText(el) {
  const msg = mathChildren(el)[1];
  if (!msg) return '';
  return (msg.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * @returns {HTMLElement}
 */
function ensureStatus() {
  if (statusEl) return statusEl;
  const region = document.createElement('div');
  region.id = STATUS_ID;
  region.className = 'maction-statusline';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.hidden = true;
  Object.assign(region.style, {
    position: 'fixed',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '10000',
    background: '#f4f4f4',
    borderTop: '1px solid #bbb',
    padding: '0.25em 0.75em',
    font: '14px system-ui, sans-serif',
  });
  document.body.appendChild(region);
  statusEl = region;
  return region;
}

/**
 * @param {Element} el
 */
function showStatus(el) {
  const region = ensureStatus();
  // Never assign window.status. The region is the whole status-line stand-in.
  region.textContent = messageText(el);
  region.hidden = false;
  statusOwner = el;
}

/**
 * @param {Element} el
 */
function hideStatus(el) {
  if (statusOwner !== el || !statusEl) return;
  statusEl.textContent = '';
  statusEl.hidden = true;
  statusOwner = null;
}

/**
 * @returns {HTMLElement}
 */
function ensureTooltip() {
  if (tooltipEl) return tooltipEl;
  const tip = document.createElement('div');
  tip.id = TOOLTIP_ID;
  tip.className = 'maction-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  Object.assign(tip.style, {
    position: 'fixed',
    zIndex: '10000',
    background: '#fffef5',
    border: '1px solid #888',
    padding: '0.3em 0.5em',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    maxWidth: '40em',
  });
  document.body.appendChild(tip);
  tooltipEl = tip;
  return tip;
}

/**
 * @param {Element} el
 */
function openTooltip(el) {
  const tip = ensureTooltip();
  const message = mathChildren(el)[1];
  tip.replaceChildren();
  const math = document.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'inline');
  if (message) {
    const clone = cloneElementWithShadowRoot(message);
    // The live message is display:none. Drop that so the popup can show it.
    clone.style.display = '';
    math.appendChild(clone);
  }
  tip.appendChild(math);
  const rect = el.getBoundingClientRect();
  tip.style.left = rect.left + 'px';
  tip.style.top = (rect.bottom + 4) + 'px';
  tip.hidden = false;
  if (tooltipOwner && tooltipOwner !== el) {
    tooltipOwner.removeAttribute('aria-describedby');
  }
  tooltipOwner = el;
  el.setAttribute('aria-describedby', TOOLTIP_ID);
}

/**
 * @param {Element} el
 */
function closeTooltip(el) {
  if (tooltipPending === el) {
    if (tooltipTimer != null) clearTimeout(tooltipTimer);
    tooltipTimer = null;
    tooltipPending = null;
  }
  if (tooltipOwner !== el) return;
  if (tooltipEl) tooltipEl.hidden = true;
  el.removeAttribute('aria-describedby');
  tooltipOwner = null;
}

/**
 * @param {Element} el
 */
function scheduleTooltip(el) {
  if (tooltipOwner === el && tooltipEl && !tooltipEl.hidden) return;
  if (tooltipPending === el) return;
  if (tooltipTimer != null) clearTimeout(tooltipTimer);
  if (tooltipOwner && tooltipOwner !== el) closeTooltip(tooltipOwner);
  tooltipPending = el;
  tooltipTimer = setTimeout(() => {
    tooltipTimer = null;
    tooltipPending = null;
    openTooltip(el);
  }, TOOLTIP_DELAY_MS);
}

/**
 * @param {Element} el
 * @param {string} type
 */
function bindOnce(el, type) {
  if (el.hasAttribute(BOUND)) return;
  el.setAttribute(BOUND, type);

  if (type === 'toggle') {
    el.addEventListener('click', (event) => {
      if (nearestMactionOfType(event.target, 'toggle') !== el) return;
      cycleToggle(el);
    });
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (nearestMactionOfType(event.target, 'toggle') !== el) return;
      event.preventDefault();
      cycleToggle(el);
    });
    return;
  }

  if (type === 'tooltip') {
    el.addEventListener('pointerover', (event) => {
      if (nearestMactionOfType(event.target, 'tooltip') !== el) return;
      scheduleTooltip(el);
    });
    el.addEventListener('pointerout', (event) => {
      if (nearestMactionOfType(event.target, 'tooltip') !== el) return;
      const rel = event.relatedTarget;
      if (rel instanceof Node && el.contains(rel)) return;
      closeTooltip(el);
    });
    el.addEventListener('focus', () => openTooltip(el));
    el.addEventListener('blur', () => closeTooltip(el));
    return;
  }

  if (type === 'statusline') {
    el.addEventListener('pointerover', (event) => {
      if (nearestMactionOfType(event.target, 'statusline') !== el) return;
      showStatus(el);
    });
    el.addEventListener('pointerout', (event) => {
      if (nearestMactionOfType(event.target, 'statusline') !== el) return;
      const rel = event.relatedTarget;
      if (rel instanceof Node && el.contains(rel)) return;
      hideStatus(el);
    });
    el.addEventListener('focus', () => showStatus(el));
    el.addEventListener('blur', () => hideStatus(el));
  }
}

/**
 * @param {Element} el
 * @returns {Element}
 */
const transformMaction = (el) => {
  if (!isMathMLElement(el) || el.localName !== 'maction') return el;

  const type = actionType(el);
  el.setAttribute('data-maction-polyfill', type);

  applyVisibility(el);

  const interactive = type === 'toggle' || type === 'tooltip' || type === 'statusline';
  const shown = shownChild(el);
  if (interactive && shown) {
    if (type === 'toggle') {
      el.style.cursor = 'pointer';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
    } else {
      // Focusable so the keyboard can open the tooltip or status text.
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    }
    bindOnce(el, type);
  }

  return el;
};

const MACTION_CSS = `
maction[data-maction-polyfill="toggle"] {
  cursor: pointer;
}
.maction-tooltip {
  position: fixed;
  z-index: 10000;
  background: #fffef5;
  border: 1px solid #888;
  padding: 0.3em 0.5em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  max-width: 40em;
}
.maction-statusline {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: #f4f4f4;
  border-top: 1px solid #bbb;
  padding: 0.25em 0.75em;
  font: 14px system-ui, sans-serif;
}
`;

_MathTransforms.add('maction', transformMaction, MACTION_CSS);
