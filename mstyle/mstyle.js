// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

/*
 * Restores MathML 3 mstyle behavior on MathML Core (MathML 3 §3.3.4).
 *
 * Core lays mstyle out as an mrow and only inherits displaystyle, scriptlevel,
 * mathcolor, mathbackground, mathsize, and dir (via CSS presentational hints).
 * Those stay on mstyle / math. Copying them onto descendants would fight that
 * inheritance. decimalpoint also stays put: malign and elementary math read it
 * from the ancestor mstyle. This module does not unwrap mstyle into mrow.
 *
 * Attribute push-down
 * -------------------
 * For each attribute on the mstyle or math that is in the map below, set it on
 * each descendant whose local name is a target, only when that descendant does
 * not already have the attribute. Explicit values win. _MathTransforms walks
 * each selector inner-first, and this file is imported before the other
 * polyfills, so the closest mstyle runs first and later polyfills (linethickness,
 * bevelled, horiz-align, scriptshift, mfenced, menclose, mtable, mathvariant,
 * namedspace, ms) see the copied attributes. Do not copy across into a nested
 * math.
 *
 * Targets (MathML 3 §3.3.4.1 restrictions):
 *   mo: form, fence, separator, lspace, rspace, stretchy, symmetric, maxsize,
 *       minsize, largeop, movablelimits, accent, linebreak, linebreakstyle,
 *       indentalign, indentshift, and the *first / *last indent variants
 *   mspace only: width, height, depth
 *       (not mpadded, mglyph, or mtable — so mtable@width is not a target)
 *   mfrac: linethickness, bevelled, numalign, denomalign
 *   msub, msubsup: subscriptshift
 *   msup, msubsup: superscriptshift
 *   munder, mover, munderover only: align (not mtable or mstack);
 *       accent / accentunder on the elements that accept them
 *   mtable only: rowalign, columnalign, groupalign, alignmentscope, columnwidth,
 *       rowspacing, columnspacing, rowlines, columnlines, frame, framespacing,
 *       equalrows, equalcolumns, side, minlabelspacing
 *   mtd: columnspan, rowspan
 *   menclose: notation
 *   mfenced: open, close, separators
 *   mi, mn, mo, mtext, ms: mathvariant
 *   ms: lquote, rquote
 *   infix mo only: infixlinebreakstyle is written as linebreakstyle when the mo
 *       does not already have linebreakstyle and is not form="prefix" or
 *       form="postfix" (linebreaking.js reads linebreakstyle on the operator)
 *
 * Not copied: voffset; required src, alt, actiontype; deprecated index;
 * deprecated named-space rebinding (veryverythinmathspace … veryverythickmathspace),
 * which MathML 3 says must have no effect.
 *
 * scriptsizemultiplier and scriptminsize are not a copy. Core already scales
 * scripts from the font's OpenType MATH values (the 0.71 / 8pt MathML 3 initials
 * are only fallbacks, and a given font may differ). An omitted attribute is left
 * entirely to that native scaling. A set scriptsizemultiplier replaces the scale
 * at script depth d with base * multiplier^d. A set scriptminsize is a floor:
 * alone, it only raises a script whose Core font-size is already below it.
 * The base is this element's computed font-size (Core has already applied its
 * mathsize and scriptlevel). Setting only the script root is not enough when the
 * multiplier is set: the UA stylesheet sets font-size:math on every MathML
 * element, so nested scripts would scale again by the UA factor. Accents are
 * left alone (Core uses font-size:inherit).
 */

import { _MathTransforms, MATHML_NS, convertToPx, forceLayout } from '../common/math-transforms.js';

/** @type {Record<string, readonly string[]>} */
const TARGETS = {
  form: ['mo'],
  fence: ['mo'],
  separator: ['mo'],
  lspace: ['mo'],
  rspace: ['mo'],
  stretchy: ['mo'],
  symmetric: ['mo'],
  maxsize: ['mo'],
  minsize: ['mo'],
  largeop: ['mo'],
  movablelimits: ['mo'],
  accent: ['mo', 'mover', 'munderover'],
  linebreak: ['mo'],
  linebreakstyle: ['mo'],
  indentalign: ['mo'],
  indentshift: ['mo'],
  indentalignfirst: ['mo'],
  indentshiftfirst: ['mo'],
  indentalignlast: ['mo'],
  indentshiftlast: ['mo'],
  // height/depth/width on mstyle apply only to mspace, not mpadded, mglyph, or mtable.
  width: ['mspace'],
  height: ['mspace'],
  depth: ['mspace'],
  linethickness: ['mfrac'],
  bevelled: ['mfrac'],
  numalign: ['mfrac'],
  denomalign: ['mfrac'],
  subscriptshift: ['msub', 'msubsup'],
  superscriptshift: ['msup', 'msubsup'],
  align: ['munder', 'mover', 'munderover'],
  accentunder: ['munder', 'munderover'],
  rowalign: ['mtable'],
  columnalign: ['mtable'],
  groupalign: ['mtable'],
  alignmentscope: ['mtable'],
  columnwidth: ['mtable'],
  rowspacing: ['mtable'],
  columnspacing: ['mtable'],
  rowlines: ['mtable'],
  columnlines: ['mtable'],
  frame: ['mtable'],
  framespacing: ['mtable'],
  equalrows: ['mtable'],
  equalcolumns: ['mtable'],
  side: ['mtable'],
  minlabelspacing: ['mtable'],
  columnspan: ['mtd'],
  rowspan: ['mtd'],
  notation: ['menclose'],
  open: ['mfenced'],
  close: ['mfenced'],
  separators: ['mfenced'],
  mathvariant: ['mi', 'mn', 'mo', 'mtext', 'ms'],
  lquote: ['ms'],
  rquote: ['ms'],
};

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isMath(el) {
  return el.namespaceURI === MATHML_NS;
}

/**
 * True when this element sets a usable scriptsizemultiplier or scriptminsize.
 * An omitted attribute is not treated as the MathML 3 initial value: Core's
 * OpenType scale may not be 0.71, and it does not apply an 8pt floor.
 * @param {Element} el
 * @returns {boolean}
 */
function hasActiveScriptSizing(el) {
  if (el.hasAttribute('scriptsizemultiplier')) {
    const mult = parseFloat(el.getAttribute('scriptsizemultiplier') || '');
    if (Number.isFinite(mult) && mult > 0) return true;
  }
  if (el.hasAttribute('scriptminsize')) {
    const minPx = convertToPx(el, el.getAttribute('scriptminsize') || '');
    if (Number.isFinite(minPx) && minPx > 0) return true;
  }
  return false;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function ancestorHasActiveScriptSizing(el) {
  let parent = el.parentElement;
  while (parent) {
    if (isMath(parent) && (parent.localName === 'mstyle' || parent.localName === 'math') && hasActiveScriptSizing(parent)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Accent scripts keep Core's font-size:inherit (they are not script-scaled).
 * @param {Element} el
 * @returns {boolean}
 */
function isAccentScript(el) {
  const parent = el.parentElement;
  if (!parent || !isMath(parent)) return false;
  const childIndex = Array.prototype.indexOf.call(parent.children, el);
  const flag = (/** @type {string} */ name) => (parent.getAttribute(name) || '').toLowerCase() === 'true';
  const parentName = parent.localName;
  if (parentName === 'munder' && childIndex === 1 && flag('accentunder')) return true;
  if (parentName === 'mover' && childIndex === 1 && flag('accent')) return true;
  if (parentName === 'munderover' && childIndex === 1 && flag('accentunder')) return true;
  if (parentName === 'munderover' && childIndex === 2 && flag('accent')) return true;
  return false;
}

/**
 * Copy one inheritance root's attributes onto descendants that do not yet have them.
 * @param {Element} root
 * @returns {void}
 */
function pushDown(root) {
  /** @type {{ name: string, value: string, targets: readonly string[] }[]} */
  const attrs = [];
  for (const attr of root.attributes) {
    if (attr.namespaceURI) continue;
    const targets = TARGETS[attr.localName];
    if (targets) attrs.push({ name: attr.localName, value: attr.value, targets });
  }
  const infix = root.getAttribute('infixlinebreakstyle');

  /**
   * @param {Element} el
   * @returns {void}
   */
  function walk(el) {
    for (const child of el.children) {
      if (!isMath(child) || child.localName === 'math') continue;
      for (const attr of attrs) {
        if (attr.targets.includes(child.localName) && !child.hasAttribute(attr.name)) {
          child.setAttribute(attr.name, attr.value);
        }
      }
      if (infix && child.localName === 'mo' && !child.hasAttribute('linebreakstyle')) {
        const form = (child.getAttribute('form') || '').toLowerCase();
        if (form !== 'prefix' && form !== 'postfix') {
          child.setAttribute('linebreakstyle', infix);
        }
      }
      walk(child);
    }
  }
  walk(root);
}

/**
 * @param {Element} el
 * @returns {number | null}
 */
function readMathDepth(el) {
  const raw = getComputedStyle(el).getPropertyValue('math-depth').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Element} el
 * @param {number} depth
 * @param {number} basePx
 * @param {number | null} multiplier null when scriptsizemultiplier is not set
 * @param {number | null} minPx null when scriptminsize is not set
 * @returns {void}
 */
function setScriptFontSize(el, depth, basePx, multiplier, minPx) {
  if (depth <= 0 || el.hasAttribute('mathsize') || isAccentScript(el)) return;
  /** @type {number | null} */
  let px = null;
  if (multiplier != null) {
    px = basePx * multiplier ** depth;
    if (minPx != null) px = Math.max(minPx, px);
  } else if (minPx != null) {
    // Core already chose the size, possibly from OpenType. Only raise it.
    forceLayout(el);
    const current = parseFloat(getComputedStyle(el).fontSize);
    if (Number.isFinite(current) && current < minPx) px = minPx;
  }
  if (px == null) return;
  /** @type {HTMLElement} */ (el).style.fontSize = `${px.toFixed(3)}px`;
}

/**
 * @param {Element} root
 * @param {number} basePx
 * @param {number | null} multiplier
 * @param {number | null} minPx
 * @returns {boolean} false when `math-depth` cannot be read
 */
function applyScriptSizingFromMathDepth(root, basePx, multiplier, minPx) {
  const baseDepth = readMathDepth(root);
  if (baseDepth == null) return false;
  const rootDepth = baseDepth;

  /**
   * @param {Element} el
   * @returns {void}
   */
  function walk(el) {
    for (const child of el.children) {
      if (!isMath(child) || child.localName === 'math') continue;
      const depth = readMathDepth(child);
      const d = depth == null ? 0 : depth - rootDepth;
      if (child.localName === 'mstyle' && hasActiveScriptSizing(child)) {
        setScriptFontSize(child, d, basePx, multiplier, minPx);
        applyScriptSizing(child);
        continue;
      }
      setScriptFontSize(child, d, basePx, multiplier, minPx);
      walk(child);
    }
  }
  walk(root);
  return true;
}

/**
 * Fallback when math-depth is not exposed. Counts the same increments as the
 * MathML Core user-agent stylesheet: mfrac children only in compact style,
 * mroot index +2, other scripts +1, accents excluded.
 * @param {Element} root
 * @param {number} basePx
 * @param {number | null} multiplier
 * @param {number | null} minPx
 * @returns {void}
 */
function applyScriptSizingManual(root, basePx, multiplier, minPx) {
  /**
   * @param {Element} el
   * @returns {boolean}
   */
  function isCompact(el) {
    const attr = el.getAttribute('displaystyle');
    if (attr) return attr.toLowerCase() !== 'true';
    const mathStyle = getComputedStyle(el).getPropertyValue('math-style').trim();
    return mathStyle === 'compact';
  }

  /**
   * @param {Element} el
   * @param {number} depth
   * @param {boolean} compact
   * @returns {void}
   */
  function walk(el, depth, compact) {
    const kids = Array.from(el.children);
    for (let index = 0; index < kids.length; index++) {
      const child = kids[index];
      if (!isMath(child) || child.localName === 'math') continue;
      let d = depth + signedScriptlevel(child);
      let childCompact = compact;
      const name = el.localName;
      if (name === 'mfrac') {
        if (compact) d += 1;
        childCompact = true;
      } else if (name === 'mroot' && index > 0) {
        d += 2;
        childCompact = true;
      } else if ((name === 'msub' || name === 'msup' || name === 'msubsup' || name === 'mmultiscripts') && index > 0) {
        d += 1;
        childCompact = true;
      } else if ((name === 'munder' || name === 'mover' || name === 'munderover') && index > 0 && !isAccentScript(child)) {
        d += 1;
        childCompact = true;
      }
      if (child.localName === 'mstyle' && hasActiveScriptSizing(child)) {
        setScriptFontSize(child, d, basePx, multiplier, minPx);
        applyScriptSizing(child);
        continue;
      }
      setScriptFontSize(child, d, basePx, multiplier, minPx);
      walk(child, d, childCompact || isCompact(child));
    }
  }
  walk(root, 0, isCompact(root));
}

/**
 * Relative scriptlevel change ("+1" / "-2") on this element. Absolute values are
 * left to math-depth; the manual fallback cannot know the absolute level.
 * @param {Element} el
 * @returns {number}
 */
function signedScriptlevel(el) {
  const raw = (el.getAttribute('scriptlevel') || '').trim();
  if (!/^[+-]\d+$/.test(raw)) return 0;
  return parseInt(raw, 10);
}

/**
 * @param {Element} root
 * @returns {void}
 */
function applyScriptSizing(root) {
  if (!root.isConnected) return;
  /** @type {number | null} */
  let multiplier = null;
  if (root.hasAttribute('scriptsizemultiplier')) {
    const parsed = parseFloat(root.getAttribute('scriptsizemultiplier') || '');
    if (Number.isFinite(parsed) && parsed > 0) multiplier = parsed;
  }
  /** @type {number | null} */
  let minPx = null;
  if (root.hasAttribute('scriptminsize')) {
    const parsed = convertToPx(root, root.getAttribute('scriptminsize') || '');
    if (Number.isFinite(parsed) && parsed > 0) minPx = parsed;
  }
  if (multiplier == null && minPx == null) return;
  forceLayout(root);
  const basePx = parseFloat(getComputedStyle(root).fontSize);
  if (!Number.isFinite(basePx) || basePx <= 0) return;
  if (!applyScriptSizingFromMathDepth(root, basePx, multiplier, minPx)) {
    applyScriptSizingManual(root, basePx, multiplier, minPx);
  }
}

/**
 * Push inherited defaults from an mstyle or math element, then (for the outermost
 * such element) override script font sizes. Returns the same element so the
 * framework does not replace it.
 * @param {Element} el
 * @returns {Element}
 */
export function applyMathStyleRoot(el) {
  if (!isMath(el) || (el.localName !== 'mstyle' && el.localName !== 'math')) return el;
  pushDown(el);
  if (hasActiveScriptSizing(el) && !ancestorHasActiveScriptSizing(el)) {
    applyScriptSizing(el);
  }
  return el;
}

_MathTransforms.add('mstyle', applyMathStyleRoot);
_MathTransforms.add('math', applyMathStyleRoot);
