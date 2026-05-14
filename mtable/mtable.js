/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80 */
/*
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

/*
 * This module polyfills MathML 4 presentation attributes on `mtable` by cloning the element and
 * applying layout with CSS. When {@code CSS.supports('grid-template-columns','subgrid')} is true,
 * `mtable` is a grid with shared column tracks and each `mtr` uses `grid-template-columns: subgrid`
 * so column widths match across rows (needed for `columnalign`). Otherwise a nested grid per row
 * is used (tables stay visible; column widths may differ per row on older engines).
 *
 * Row and column gaps are not uniform when attributes give a list of lengths, so the polyfill
 * uses per-cell margins for `rowspacing` and `columnspacing` instead of `gap` (when internal
 * `rowlines` or `columnlines` are visible, spacing is applied as cell `padding` so borders span
 * the gap). `frame` uses an
 * `mtable` border; internal `rowlines` use a full-width `border-top` on each `mtr` (not per-`mtd`,
 * so dashed rules span the table), except when {@code data-mlabeledtr-expanded} applies, where
 * row lines are drawn on equation {@code mtd}s only so they do not run through the label column.
 * `columnlines` use `border-left` on `mtd`. When internal grid
 * lines are visible, each `mtr` uses `align-items: stretch` so `mtd` boxes fill row tracks (column
 * rules stay continuous); vertical `rowalign` is applied after layout by measuring baselines and
 * setting `margin-top` on each cell’s leading `mrow` (see {@link scheduleLinedMtdVerticalLayout}).
 * Without column `subgrid`, each row uses
 * `repeat(n, minmax(0,1fr))` so column widths match across rows. `columnwidth`, `equalrows`,
 * `equalcolumns`, `width`, and `align` drive grid templates and sizing; when `align` names a row,
 * a short post-layout pass may nudge the table with `transform: translateY` so the chosen row
 * lines up with the surrounding math (only when `align` is present on `mtable`). Math layout in current browsers ignores CSS `vertical-align`
 * (and vertical margins) on `mtable`, but `transform` is honored, so the visual shift is reliable.
 * The same pass also grows the table's padding by `|dy|` (top or bottom depending on shift
 * direction) so the layout box expands to match the painted area and the surrounding HTML `td`
 * does not appear clipped. The same mechanism applies to whole-table `align` (no row index):
 * sibling baseline (or axis) drives top / bottom / center / baseline / axis placement.
 *
 * {@code mlabeledtr} is lowered to {@code mtr} (padding label {@code mtd} on other rows) before
 * measuring rows; with default {@code side="right"}, {@code rowalign} / {@code columnalign} lists on
 * {@code mlabeledtr} apply to equation {@code mtd}s only; the label column uses {@code mtable} defaults for that row/column.
 * Tables that contained {@code mlabeledtr} get {@code data-mlabeledtr-expanded}; for those only, {@code mtable} /
 * {@code mtr} column-wise lists ({@code columnalign}, {@code columnwidth}, {@code mtr} {@code rowalign} per column)
 * map the label column to list index {@code n−1} so the first token targets the first equation column.
 * {@code columnspacing} and {@code rowspacing} still use physical column/row gaps. For {@code columnlines}
 * on tables with {@code data-mlabeledtr-expanded}, list tokens apply only between equation columns (no
 * vertical rule between the label column and the equation block). The {@code frame} outline likewise
 * wraps equation columns only (the label sits outside that rectangle). {@code rowlines} are drawn on
 * equation {@code mtd}s only so horizontal rules do not extend through the label column.
 *
 * Cell alignment follows MathML defaults (`rowalign` baseline, `columnalign` center) and
 * inheritance from {@code mtable} → {@code mtr} → {@code mtd} for both attributes (space- or
 * comma-separated lists; ASCII case-insensitive tokens), with per-cell CSS from the resolved values.
 * `rowalign="axis"` matches baseline alignment of the row grid plus a downward
 * shift by the math axis height (measured from an `mo` with U+2212, with `ex` fallback) so axis
 * rows sit lower than baseline rows,
 * per MathML baseline vs axis semantics. Multi-child `mtd`s get an explicit `<mrow>`
 * wrapper around their inferred-row contents so engines that drop the implicit row inside a
 * grid container still lay the children out horizontally. A one-time probe compares the width
 * of a tiny native `mtable` with `columnspacing="0em"` vs `"3em"`; if the engine already
 * honors spacing, no transform runs and native layout is left in place. {@code mlabeledtr} /
 * {@code mtable@side} is probed separately: if the engine already places the label on the correct side,
 * only the full CSS polyfill is skipped when spacing is native; otherwise the label column is
 * rearranged into {@code mtr} form without applying grid CSS. When spacing is native and expansion ran,
 * {@code frame} / line attributes are moved onto an inner equation-only {@code mtable} inside a 1×2
 * wrapper so native rules do not span the label column. Per-row attributes ({@code rowspacing},
 * {@code rowalign}, {@code equalrows}, {@code displaystyle}) are mirrored onto an inner label
 * {@code mtable}, and a {@link scheduleWrappedMlabeledtrBaselineSync} pass equalizes per-row ascent
 * and descent between the two inner mtables so each label sits on its row's baseline regardless of
 * the number of labels or their relative row heights.
 *
 * -------------------------------------------------------------------------------------------------
 * AMS-style equation numbers (integrators): To place the label flush with the right edge of
 * your text block while the equation stays in the flow (like AMS equation numbers in print), the
 * transformed {@code mtable} must sit in a block that has the width you care about
 * (e.g. wrap the {@code <math>} in a {@code div} with {@code width:100%} or {@code max-width} matching
 * your column). Then:
 *
 * • Full CSS polyfill (native spacing probe fails): the label is a real grid column
 *   (last column when {@code side="right"}). Use {@code mtable} / {@code mtr} {@code columnalign} so the
 *   label {@code mtd} uses {@code right}, and set {@code mtable@width} (or equivalent CSS on the
 *   transformed {@code mtable}) so the grid spans the host width—otherwise the table shrinks to content
 *   and the label cannot reach the margin. Optional: add your own {@code class} on label {@code mtd}s in
 *   the source MathML and target them from your stylesheet (the polyfill merges {@code intent} on labels;
 *   do not rely on {@code intent} alone for CSS selectors).
 *
 * • Native spacing + nested wrap (spacing native, {@code mlabeledtr} {@code side} fixed by
 *   {@link wrapExpandedMtableForNativeEquationLabelSplit}): the clone contains an outer {@code mtable}
 *   with one {@code mtr} and two {@code mtd}s; the equation block is {@code mtable[data-mlabeledtr-equation-table]}
 *   and the column of labels is {@code mtable[data-mlabeledtr-label-table]}. Give the host width, then
 *   use document CSS on the outer {@code mtable} / {@code mtd} pair (e.g. flex or grid on the HTML wrapper
 *   around {@code math}) so the label column is {@code auto} width and the equation column grows—
 *   exact rules depend on the UA accepting layout CSS on MathML; if not, only width + {@code columnalign}
 *   on the inner tables apply.
 *
 * Baseline alignment between equation and label rows is handled inside this module where two inner
 * {@code mtable}s are used ({@link scheduleWrappedMlabeledtrBaselineSync}); the AMS placement steps
 * above are about horizontal position in the page, not baseline sync.
 *
 * -------------------------------------------------------------------------------------------------
 * One pattern that works whether {@link getNativeMtablePresentationAttrsSupport} is true or false:
 * put the subtree you pass to {@code _MathTransforms.transform} inside an HTML host whose width is the
 * line width you want, set {@code mtable@width="100%"} (or 100%) on the labeled {@code mtable} in source
 * MathML, and use {@code columnalign} so the label column is {@code right} (last list entry when
 * {@code side="right"}). Optionally style the label column cell from the host without branching on the
 * probe: after transform, the outermost {@code mtable} is always {@code math > mtable}; for
 * {@code side="right"} the label column is always the sibling {@code mtd} that is last in each outer
 * {@code mtr} (full polyfill: one {@code mtd} per row; native wrap: a single outer {@code mtr} whose
 * last {@code mtd} wraps {@code mtable[data-mlabeledtr-label-table]}). For {@code side="left"}, use
 * {@code mtd:first-child} instead and mirror {@code columnalign} (first token for the label).
 *
 * Example (HTML + CSS; same markup for any UA; {@code getNativeMtablePresentationAttrsSupport} does not
 * need to appear in your code): use the runnable, copy-paste source file
 * {@code mtable/example.html} in this package (open in an editor and copy the
 * {@code <style>} block and the {@code <div class="mlabeledtr-ams-host">…</div>} subtree). Your bundler or
 * module script must also {@code import} this file ({@code mtable/mtable.js}) for its side effect before
 * calling {@code _MathTransforms.transform}; importing only {@code common/math-transforms.js} does not
 * register the {@code mtable} handler.
 *
 * The {@code mtd:last-child} / {@code mtd:first-child} rules target the label column in both DOM
 * shapes (polyfill: one label {@code mtd} per row; native wrap: one outer {@code mtd} wrapping the inner
 * label {@code mtable}). The {@code mtable[data-mlabeledtr-label-table]} rule only matches the native-wrap
 * clone and is ignored when the full CSS polyfill runs.
 *
 * If the polyfill’s inline {@code width} on {@code mtable} wins over your stylesheet, keep using
 * {@code mtable@width="100%"} in MathML or raise selector specificity / use {@code !important} on the host
 * rule above only as a last resort.
 */

/**
 * CSS-based presentation for MathML 4 {@code mtable} attributes (see
 * <a href="https://www.w3.org/TR/mathml4/#presm_tabmat">MathML 4 §3.5</a>),
 * compatible with MathML Core. When the engine already honors attributes such as
 * {@code columnspacing} (detected via a small probe), the full CSS polyfill is skipped unless
 * {@code mlabeledtr} needs a DOM-side fix for {@code side} (see {@link detectNativeMlabeledtrSideLayout}).
 * @module mtable/mtable
 */

import {
  _MathTransforms,
  cloneElementWithShadowRoot,
  convertToPx,
  forceLayout,
  MATHML_NS,
} from '../common/math-transforms.js';

/** @type {boolean | null} */
let nativeMtablePresentationAttrsCache = null;

/** @type {boolean | null} */
let nativeMlabeledtrSideLayoutCache = null;

/** @type {readonly string[]} */
const ROWALIGN_VALUES = ['top', 'bottom', 'center', 'baseline', 'axis'];

/** @type {readonly string[]} */
const COLUMNALIGN_VALUES = ['left', 'center', 'right'];

/** @type {readonly string[]} */
const LINESTYLE_VALUES = ['none', 'solid', 'dashed'];

/**
 * Fallback axis-height length when the U+2212 measurement probe fails (pixels via {@link convertToPx}).
 */
const AXIS_ROWALIGN_FALLBACK_EX = '0.25ex';

/**
 * Whether the UA supports column {@code subgrid} for cross-row {@code mtable} column sizing.
 * @returns {boolean}
 */
function supportsColumnSubgrid() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('grid-template-columns', 'subgrid')
  );
}

/**
 * ASCII-lowercase trim for MathML enumerated values.
 * @param {string} s
 * @returns {string}
 */
function normToken(s) {
  return s.trim().toLowerCase();
}

/**
 * Split a MathML-style attribute list on whitespace (commas become spaces first).
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseSpaceList(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw)
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @param {string[]} list
 * @param {number} index
 * @param {string} fallback
 * @returns {string}
 */
function pickListEntry(list, index, fallback) {
  if (!list.length) return fallback;
  if (index < list.length) return list[index];
  return list[list.length - 1];
}

/**
 * @param {string} token
 * @param {readonly string[]} allowed
 * @param {string} fallback
 * @returns {string}
 */
function normalizeEnum(token, allowed, fallback) {
  const t = normToken(token);
  for (const a of allowed) {
    if (t === a) return a;
  }
  return fallback;
}

/**
 * @param {string | null | undefined} raw
 * @param {string} fallback
 * @returns {string[]}
 */
function parseLineList(raw, fallback) {
  const parts = parseSpaceList(raw);
  if (!parts.length) return [fallback];
  return parts.map((p) => normalizeEnum(p, LINESTYLE_VALUES, 'none'));
}

/**
 * @param {string[]} list
 * @returns {boolean}
 */
function lineListHasVisible(list) {
  return list.some((t) => t !== 'none');
}

/**
 * Build a 1×2 {@code mtable} (one {@code mtr}, two {@code mtd}) for probing native {@code columnspacing}.
 * @param {string} columnspacing
 * @returns {Element}
 */
function buildColumnspacingProbeMtable(columnspacing) {
  const tbl = document.createElementNS(MATHML_NS, 'mtable');
  tbl.setAttribute('columnspacing', columnspacing);
  const tr = document.createElementNS(MATHML_NS, 'mtr');
  for (let i = 0; i < 2; i++) {
    const td = document.createElementNS(MATHML_NS, 'mtd');
    const mi = document.createElementNS(MATHML_NS, 'mi');
    mi.textContent = String.fromCharCode(97 + i);
    td.appendChild(mi);
    tr.appendChild(td);
  }
  tbl.appendChild(tr);
  return tbl;
}

/**
 * Lay out a probe {@code mtable} off-screen and return its border-box width (CSS pixels).
 * @param {string} columnspacing
 * @returns {number}
 */
function measureProbeMtableWidth(columnspacing) {
  const math = document.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'block');
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mtable = buildColumnspacingProbeMtable(columnspacing);
  math.appendChild(mtable);
  document.body.appendChild(math);
  forceLayout(math);
  const w = mtable.getBoundingClientRect().width;
  math.remove();
  return w;
}

/**
 * Whether the engine already lays out MathML 4–style {@code mtable} presentation attributes (e.g.
 * {@code columnspacing}). Probed once: a 1×2 table with {@code columnspacing="3em"} should be wider
 * than with {@code columnspacing="0em"}; if widths match, assume attributes are ignored and the polyfill
 * is needed.
 * @returns {boolean}
 */
function detectNativeMtablePresentationAttrs() {
  if (nativeMtablePresentationAttrsCache !== null) {
    return nativeMtablePresentationAttrsCache;
  }
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }
  try {
    const w0 = measureProbeMtableWidth('0em');
    const w3 = measureProbeMtableWidth('3em');
    nativeMtablePresentationAttrsCache = w3 - w0 > 1;
  } catch {
    nativeMtablePresentationAttrsCache = false;
  }
  return nativeMtablePresentationAttrsCache;
}

/**
 * Whether {@code mtable@side} with {@code mlabeledtr} places the label {@code mtd} on the correct side
 * of the equation {@code mtd}s (probed once with a 1×2 labeled row: label first, then equation, in
 * document order).
 * @returns {boolean}
 */
function detectNativeMlabeledtrSideLayout() {
  if (nativeMlabeledtrSideLayoutCache !== null) {
    return nativeMlabeledtrSideLayoutCache;
  }
  if (typeof document === 'undefined' || !document.body) {
    nativeMlabeledtrSideLayoutCache = false;
    return false;
  }
  try {
    nativeMlabeledtrSideLayoutCache =
      probeMlabeledtrSideLayout('right') && probeMlabeledtrSideLayout('left');
  } catch {
    nativeMlabeledtrSideLayoutCache = false;
  }
  return nativeMlabeledtrSideLayoutCache;
}

/**
 * @param {'left' | 'right'} side
 * @returns {boolean}
 */
function probeMlabeledtrSideLayout(side) {
  const math = document.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'block');
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mtable = document.createElementNS(MATHML_NS, 'mtable');
  mtable.setAttribute('side', side);
  const mlabeledtr = document.createElementNS(MATHML_NS, 'mlabeledtr');
  const mtdLabel = document.createElementNS(MATHML_NS, 'mtd');
  const tL = document.createElementNS(MATHML_NS, 'mtext');
  tL.textContent = 'L';
  mtdLabel.appendChild(tL);
  const mtdEq = document.createElementNS(MATHML_NS, 'mtd');
  const mi = document.createElementNS(MATHML_NS, 'mi');
  mi.textContent = 'E';
  mtdEq.appendChild(mi);
  mlabeledtr.appendChild(mtdLabel);
  mlabeledtr.appendChild(mtdEq);
  mtable.appendChild(mlabeledtr);
  math.appendChild(mtable);
  document.body.appendChild(math);
  forceLayout(math);
  const rL = mtdLabel.getBoundingClientRect();
  const rE = mtdEq.getBoundingClientRect();
  math.remove();
  const gap = 0.5;
  if (side === 'right') {
    return rE.left + gap < rL.left;
  }
  return rL.left + gap < rE.left;
}

/**
 * Whether the user agent appears to honor {@code mtable@side} on {@code mlabeledtr} (label vs equation
 * column order in layout). Exposed for test pages alongside {@link getNativeMtablePresentationAttrsSupport}.
 * @returns {boolean}
 */
export function getNativeMlabeledtrSideLayoutSupport() {
  return detectNativeMlabeledtrSideLayout();
}

/**
 * Whether the user agent appears to honor MathML {@code mtable} presentation attributes in layout
 * (detected with a 1×2 {@code columnspacing} probe). Test pages can show this before running transforms.
 * @returns {boolean}
 */
export function getNativeMtablePresentationAttrsSupport() {
  return detectNativeMtablePresentationAttrs();
}

/**
 * Vertical placement for {@code display:flex; flex-direction: column} on {@code mtd} when the cell
 * is stretched in the row grid (avoids {@code align-self: end} fighting {@code align-items: first baseline}
 * on {@code mtr} for tall cells).
 * @param {string} rowalign
 * @returns {string}
 */
function rowalignToFlexMainJustify(rowalign) {
  const v = normalizeEnum(rowalign, ROWALIGN_VALUES, 'baseline');
  if (v === 'top') return 'flex-start';
  if (v === 'bottom') return 'flex-end';
  if (v === 'center') return 'center';
  return 'flex-start';
}

/**
 * True if {@code el} is a leading zero-sized {@code mspace} used as a baseline probe.
 * @param {Element | null} el
 * @returns {boolean}
 */
function isZeroBaselineProbe(el) {
  if (!el || el.namespaceURI !== MATHML_NS || el.localName !== 'mspace') return false;
  const w = normToken(el.getAttribute('width') ?? '0');
  const h = normToken(el.getAttribute('height') ?? '0');
  const d = normToken(el.getAttribute('depth') ?? '0');
  return w === '0' && h === '0' && d === '0';
}

/**
 * Insert a leading {@code <mspace width="0" height="0" depth="0"/>} in {@code mrow} when missing,
 * so {@link runLinedMtdVerticalLayout} can read the row’s math baseline.
 * @param {Element} mrow
 * @returns {void}
 */
function ensureLeadingBaselineProbe(mrow) {
  if (isZeroBaselineProbe(mrow.firstElementChild)) return;
  const doc = mrow.ownerDocument;
  if (!doc) return;
  const sp = doc.createElementNS(MATHML_NS, 'mspace');
  sp.setAttribute('width', '0');
  sp.setAttribute('height', '0');
  sp.setAttribute('depth', '0');
  mrow.insertBefore(sp, mrow.firstChild);
}

/**
 * @param {Element} mtd
 * @returns {Element | null}
 */
function getFirstMrowChild(mtd) {
  const el = mtd.firstElementChild;
  if (!el || el.namespaceURI !== MATHML_NS || el.localName !== 'mrow') return null;
  return el;
}

/**
 * Effective MathML {@code rowalign} for one cell: {@code mtable} list (one entry per row, last
 * repeated), then {@code mtr} list (one entry per column in that row, last repeated), then {@code mtd}
 * (list applies to the cell; a single-column {@code mtd} uses the first entry).
 * @param {Element} mtd
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {string[]} mtableRowalign
 * @param {Element | null} mtr
 * @param {Element | null} mtable Used to map the label column to list index {@code n−1} for {@code mtr} lists.
 * @returns {string}
 */
function resolveEffectiveRowalign(mtd, rowIndex, colIndex, mtableRowalign, mtr, mtable) {
  const listCol =
    mtable && mtr ? presentationColumnListIndex(mtd, colIndex, mtable, mtr) : colIndex;
  let ra = pickListEntry(mtableRowalign, rowIndex, 'baseline');
  if (mtr) {
    const mtrRaList = parseSpaceList(mtr.getAttribute('rowalign'));
    if (mtrRaList.length) {
      ra = normalizeEnum(
        pickListEntry(mtrRaList, listCol, ra),
        ROWALIGN_VALUES,
        ra
      );
    }
  }
  const mtdRaRaw = mtd.getAttribute('rowalign');
  if (mtdRaRaw != null && String(mtdRaRaw).trim() !== '') {
    const mtdRaList = parseSpaceList(mtdRaRaw);
    if (mtdRaList.length) {
      ra = normalizeEnum(pickListEntry(mtdRaList, 0, ra), ROWALIGN_VALUES, ra);
    }
  }
  return normalizeEnum(ra, ROWALIGN_VALUES, 'baseline');
}

/**
 * Effective MathML {@code columnalign} for one cell: {@code mtable} list (one entry per column, last
 * repeated), then {@code mtr} list (one entry per column in that row, last repeated), then {@code mtd}
 * (list applies to the cell; a single-column {@code mtd} uses the first entry).
 * @param {Element} mtd
 * @param {number} colIndex Physical column index.
 * @param {string[]} mtableColumnalign
 * @param {Element | null} mtr
 * @param {Element | null} mtable Label column maps to list index {@code n−1} (does not consume the first entry).
 * @returns {string}
 */
function resolveEffectiveColumnalign(mtd, colIndex, mtableColumnalign, mtr, mtable) {
  const listCol =
    mtable && mtr ? presentationColumnListIndex(mtd, colIndex, mtable, mtr) : colIndex;
  let ca = pickListEntry(mtableColumnalign, listCol, 'center');
  if (mtr) {
    const mtrCaList = parseSpaceList(mtr.getAttribute('columnalign'));
    if (mtrCaList.length) {
      ca = normalizeEnum(
        pickListEntry(mtrCaList, listCol, ca),
        COLUMNALIGN_VALUES,
        ca
      );
    }
  }
  const mtdCaRaw = mtd.getAttribute('columnalign');
  if (mtdCaRaw != null && String(mtdCaRaw).trim() !== '') {
    const mtdCaList = parseSpaceList(mtdCaRaw);
    if (mtdCaList.length) {
      ca = normalizeEnum(pickListEntry(mtdCaList, 0, ca), COLUMNALIGN_VALUES, ca);
    }
  }
  return normalizeEnum(ca, COLUMNALIGN_VALUES, 'center');
}

/**
 * Math axis height (baseline → axis, in CSS px): distance from an {@code mrow} baseline (from a
 * leading zero-sized {@code mspace}) to the vertical center of {@code <mo>U+2212</mo>} (MINUS
 * SIGN), which tracks the math axis in typical fonts.
 *
 * @param {Element} mtable source for {@code displaystyle} on the probe {@code math} element
 * @returns {number | null} positive pixels, or {@code null} if measurement is unavailable
 */
function measureMathAxisHeightPxFromMinusU2212(mtable) {
  const doc = mtable.ownerDocument;
  if (!doc || !doc.body) return null;
  const math = doc.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'inline');
  const rawDs = mtable.getAttribute('displaystyle');
  if (rawDs != null && String(rawDs).trim() !== '') {
    math.setAttribute('displaystyle', parseBooleanAttr(rawDs, false) ? 'true' : 'false');
  } else {
    math.setAttribute('displaystyle', 'false');
  }
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mrow = doc.createElementNS(MATHML_NS, 'mrow');
  const mspace = doc.createElementNS(MATHML_NS, 'mspace');
  mspace.setAttribute('width', '0');
  mspace.setAttribute('height', '0');
  mspace.setAttribute('depth', '0');
  const mo = doc.createElementNS(MATHML_NS, 'mo');
  mo.textContent = '\u2212';
  mrow.appendChild(mspace);
  mrow.appendChild(mo);
  math.appendChild(mrow);
  doc.body.appendChild(math);
  forceLayout(math);
  const baselineY = mspace.getBoundingClientRect().top;
  const moRect = mo.getBoundingClientRect();
  if (!(moRect.height > 0)) {
    math.remove();
    return null;
  }
  const axisCenterY = moRect.top + moRect.height / 2;
  const axisHeightPx = baselineY - axisCenterY;
  math.remove();
  if (!Number.isFinite(axisHeightPx) || axisHeightPx <= 0) return null;
  return axisHeightPx;
}

/**
 * @param {string} columnalign
 * @returns {string}
 */
function columnalignToJustifySelf(columnalign) {
  const v = normalizeEnum(columnalign, COLUMNALIGN_VALUES, 'center');
  if (v === 'left') return 'start';
  if (v === 'right') return 'end';
  return 'center';
}

/**
 * @param {string} columnalign
 * @returns {'left' | 'center' | 'right'}
 */
function columnalignToTextAlign(columnalign) {
  const v = normalizeEnum(columnalign, COLUMNALIGN_VALUES, 'center');
  if (v === 'left') return 'left';
  if (v === 'right') return 'right';
  return 'center';
}

/**
 * {@code justify-content} on a row-direction flex {@code mtd}, or {@code align-items} (cross axis)
 * on a column-direction flex {@code mtd} when internal grid lines are visible.
 * @param {string} columnalign
 * @returns {string}
 */
function columnalignToJustifyContent(columnalign) {
  const v = normalizeEnum(columnalign, COLUMNALIGN_VALUES, 'center');
  if (v === 'left') return 'flex-start';
  if (v === 'right') return 'flex-end';
  return 'center';
}

/**
 * @typedef {Object} PlacedCell
 * @property {Element} mtd
 * @property {number} row
 * @property {number} col
 */

/**
 * Wrap an {@code mtd}'s contents in an explicit {@code <mrow>} when it has more than one
 * element child, so the MathML inferred-mrow becomes explicit. Chrome drops the implicit row
 * (children render stacked) once an ancestor has {@code display: grid}, which the polyfill
 * sets on each {@code mtr}; an explicit {@code mrow} renders horizontally regardless.
 *
 * When there is exactly one MathML element child that is not already an {@code mrow}, wrap it in
 * an {@code mrow} for the same reason.
 *
 * A leading zero {@code mspace} is inserted into each explicit {@code mrow} when missing so
 * {@link runLinedMtdVerticalLayout} can read the math baseline when internal lines are on.
 * @param {Element} mtd
 * @returns {void}
 */
function wrapMtdInferredMrow(mtd) {
  const elementKids = Array.from(mtd.children);
  if (elementKids.length >= 2) {
    const doc = mtd.ownerDocument;
    if (!doc) return;
    const mrow = doc.createElementNS(MATHML_NS, 'mrow');
    while (mtd.firstChild) {
      mrow.appendChild(mtd.firstChild);
    }
    mtd.appendChild(mrow);
  } else if (elementKids.length === 1) {
    const only = elementKids[0];
    if (only.namespaceURI === MATHML_NS && only.localName !== 'mrow') {
      const doc = mtd.ownerDocument;
      if (!doc) return;
      const mrow = doc.createElementNS(MATHML_NS, 'mrow');
      mtd.replaceChild(mrow, only);
      mrow.appendChild(only);
    }
  }
  const inner = mtd.firstElementChild;
  if (inner && inner.namespaceURI === MATHML_NS && inner.localName === 'mrow') {
    ensureLeadingBaselineProbe(inner);
  }
}

/**
 * @param {string | null | undefined} raw
 * @returns {'left' | 'right'}
 */
function normalizeMtableSide(raw) {
  const s = normToken(raw || 'right');
  if (s === 'left' || s === 'right') return s;
  return 'right';
}

/**
 * Index into {@code mtable} / {@code mtr} column-wise token lists ({@code columnalign}, {@code mtr}
 * {@code rowalign}, {@code columnwidth}, etc.): equation columns use consecutive indices; the label
 * column (number or empty padding) uses index {@code n−1} so it does not consume the first list entry.
 * @param {Element} mtd
 * @param {number} physicalCol
 * @param {Element | null} mtable
 * @param {Element | null} mtr
 * @returns {number}
 */
function presentationColumnListIndex(mtd, physicalCol, mtable, mtr) {
  void mtd;
  if (!mtable || !mtable.hasAttribute('data-mlabeledtr-expanded')) return physicalCol;
  if (!mtr || mtr.namespaceURI !== MATHML_NS || mtr.localName !== 'mtr') return physicalCol;
  const n = Array.from(mtr.children).filter(
    (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
  ).length;
  if (n < 2) return physicalCol;
  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;
  if (physicalCol === labelCol) return n - 1;
  if (side === 'left') return physicalCol - 1;
  return physicalCol;
}

/**
 * Rewrite {@code rowalign} / {@code columnalign} on an {@code mtr} converted from {@code mlabeledtr}.
 * List entries on {@code mlabeledtr} apply to <em>equation</em> {@code mtd}s only (not the label); the label
 * column uses {@code mtable} defaults for that row/column. Tokens are ordered for final DOM column order
 * (label first or last per {@code side}).
 * @param {Element} mtable
 * @param {Element} mtr
 * @param {number} rowIndex0 0-based row index among {@code mtable} children (before expansion).
 * @param {'left' | 'right'} side
 * @param {number} kEq Number of equation cells (total {@code mtd} minus label).
 * @returns {void}
 */
function rewriteMlabeledtrRowPresentationAttrs(mtable, mtr, rowIndex0, side, kEq) {
  const { rowalign: mtableRA, columnalign: mtableCA } = readMtableAlignLists(mtable);
  const rowFB = pickListEntry(mtableRA, rowIndex0, 'baseline');
  const labelDomCol = side === 'right' ? kEq : 0;
  const labelRA = normalizeEnum(rowFB, ROWALIGN_VALUES, 'baseline');
  const labelCA = normalizeEnum(
    pickListEntry(mtableCA, labelDomCol, 'center'),
    COLUMNALIGN_VALUES,
    'center'
  );

  /** @param {'rowalign' | 'columnalign'} which */
  const build = (which) => {
    const attr = which === 'rowalign' ? 'rowalign' : 'columnalign';
    if (!mtr.hasAttribute(attr)) return null;
    const raw = mtr.getAttribute(attr);
    if (raw == null || String(raw).trim() === '') return null;
    const list = parseSpaceList(raw);
    const values = which === 'rowalign' ? ROWALIGN_VALUES : COLUMNALIGN_VALUES;
    const eqParts = [];
    for (let i = 0; i < kEq; i++) {
      const mtableCol = side === 'right' ? i : i + 1;
      const fb = which === 'rowalign' ? rowFB : pickListEntry(mtableCA, mtableCol, 'center');
      const picked = list.length ? pickListEntry(list, i, fb) : fb;
      eqParts.push(normalizeEnum(picked, values, fb));
    }
    const labelTok = which === 'rowalign' ? labelRA : labelCA;
    const ordered = side === 'right' ? [...eqParts, labelTok] : [labelTok, ...eqParts];
    return ordered.join(' ');
  };

  const ra = build('rowalign');
  const ca = build('columnalign');
  if (ra != null) mtr.setAttribute('rowalign', ra);
  if (ca != null) mtr.setAttribute('columnalign', ca);
}

/**
 * Add {@code :equation-label} to label {@code mtd} intent (merge-safe with existing intent).
 * @param {Element} mtd
 * @returns {void}
 */
function addEquationLabelIntent(mtd) {
  if (!mtd.hasAttribute('intent')) {
    mtd.setAttribute('intent', ':equation-label');
    return;
  }
  let intentValue = mtd.getAttribute('intent') || '';
  const iOpenParen = intentValue.indexOf('(');
  const head = iOpenParen === -1 ? intentValue : intentValue.substring(0, iOpenParen);
  if (head.includes(':equation-label')) {
    return;
  }
  intentValue = head + ':equation-label' + intentValue.substring(head.length);
  mtd.setAttribute('intent', intentValue);
}

/**
 * Replace each {@code mlabeledtr} with an {@code mtr} and pad plain {@code mtr} rows with an empty
 * label {@code mtd} so column counts match. Must run before {@link listTableRowsAndCells}.
 * @param {Element} mtable
 * @returns {Element}
 */
function expandMlabeledtrRows(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return mtable;
  }

  const topRows = Array.from(mtable.children);
  const hasLabeled = topRows.some(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mlabeledtr'
  );
  if (!hasLabeled) {
    mtable.removeAttribute('data-mlabeledtr-expanded');
    return mtable;
  }

  mtable.setAttribute('data-mlabeledtr-expanded', '');
  const doc = mtable.ownerDocument;
  if (!doc) return mtable;

  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const emptyColumnEntry = doc.createElementNS(MATHML_NS, 'mtd');
  emptyColumnEntry.setAttribute('intent', ':no-equation-label');

  for (let rowIndex0 = 0; rowIndex0 < topRows.length; rowIndex0++) {
    const row = topRows[rowIndex0];
    if (row.namespaceURI !== MATHML_NS) continue;

    if (row.localName === 'mlabeledtr') {
      const label = row.firstElementChild;
      if (!label) continue;
      addEquationLabelIntent(/** @type {Element} */ (label));

      const newRow = doc.createElementNS(MATHML_NS, 'mtr');
      for (const attr of row.attributes) {
        newRow.setAttribute(attr.name, attr.value);
      }

      const leadIdx = side === 'left' ? 0 : 1;
      const lead = row.children[leadIdx];
      if (lead) newRow.appendChild(lead);
      while (row.firstChild) {
        newRow.appendChild(row.firstChild);
      }
      if (side === 'right') {
        newRow.appendChild(label);
      }

      const numCells = Array.from(newRow.children).filter(
        (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
      ).length;
      const kEq = numCells - 1;
      if (kEq >= 1) {
        rewriteMlabeledtrRowPresentationAttrs(mtable, newRow, rowIndex0, side, kEq);
      }

      row.replaceWith(newRow);
    } else if (row.localName === 'mtr') {
      const newColEntry = /** @type {Element} */ (emptyColumnEntry.cloneNode(false));
      if (side === 'right') {
        row.appendChild(newColEntry);
      } else {
        row.insertBefore(newColEntry, row.firstChild);
      }
    }
  }

  return mtable;
}

/** Presentation attributes moved from outer {@code mtable} to the inner equation-only {@code mtable}. */
const MTABLE_LAYOUT_ATTRS_EQUATION_ONLY_FOR_NATIVE_WRAP = [
  'frame',
  'framespacing',
  'rowlines',
  'columnlines',
  'columnspacing',
  'equalcolumns',
  'columnwidth',
  'columnalign',
  'width',
];

/** Per-row presentation attributes mirrored on both inner equation and label {@code mtable}s. */
const MTABLE_LAYOUT_ATTRS_SHARED_FOR_NATIVE_WRAP = [
  'rowspacing',
  'rowalign',
  'equalrows',
  'displaystyle',
];

/**
 * Build the per-row {@code rowalign} attributes for the split row pair when wrapping an expanded
 * {@code mlabeledtr} table. Equation row gets a list with the label-column entry removed; label row
 * gets the single label-column entry. When the source {@code mtr} has no {@code rowalign}, both
 * return {@code null} (no attribute set).
 * @param {Element} oldRow
 * @param {number} totalCols Total physical columns in {@code oldRow} (label + equation columns).
 * @param {number} labelCol Physical index of the label column.
 * @returns {{ equationRowalign: string | null, labelRowalign: string | null }}
 */
function splitRowalignForWrappedMlabeledtr(oldRow, totalCols, labelCol) {
  if (!oldRow.hasAttribute('rowalign')) {
    return { equationRowalign: null, labelRowalign: null };
  }
  const raw = oldRow.getAttribute('rowalign');
  if (raw == null || String(raw).trim() === '') {
    return { equationRowalign: null, labelRowalign: null };
  }
  const tokens = parseSpaceList(raw);
  if (!tokens.length) {
    return { equationRowalign: null, labelRowalign: null };
  }
  const labelTok = normalizeEnum(
    pickListEntry(tokens, labelCol, 'baseline'),
    ROWALIGN_VALUES,
    'baseline'
  );
  const eqTokens = [];
  for (let i = 0; i < totalCols; i++) {
    if (i === labelCol) continue;
    eqTokens.push(
      normalizeEnum(pickListEntry(tokens, i, 'baseline'), ROWALIGN_VALUES, 'baseline')
    );
  }
  return {
    equationRowalign: eqTokens.length ? eqTokens.join(' ') : null,
    labelRowalign: labelTok,
  };
}

/**
 * Insert a leading {@code <mrow>} with a zero baseline probe into an {@code mtd} when missing so
 * baseline-sync measurements work. Empty {@code mtd}s (e.g. {@code :no-equation-label} padding cells)
 * get a fresh {@code mrow + mspace}; multi-element or single non-{@code mrow} content goes through
 * {@link wrapMtdInferredMrow}; single existing {@code mrow} just gets its probe ensured.
 * @param {Element} mtd
 * @returns {void}
 */
function ensureMtdHasBaselineProbeMrow(mtd) {
  const elementKids = Array.from(mtd.children);
  if (elementKids.length === 0) {
    const doc = mtd.ownerDocument;
    if (!doc) return;
    const mrow = doc.createElementNS(MATHML_NS, 'mrow');
    mtd.appendChild(mrow);
    ensureLeadingBaselineProbe(mrow);
    return;
  }
  wrapMtdInferredMrow(mtd);
}

/**
 * When the UA uses native {@code mtable} spacing but {@code mlabeledtr} was expanded to {@code mtr},
 * {@code frame} / {@code rowlines} / {@code columnlines} on the outer table still span the label column.
 * Replace the flat row grid with one wrapper {@code mtr} and two {@code mtd}s: an inner equation
 * {@code mtable} (receives equation-only layout attributes) and an inner label {@code mtable} (one
 * column, one row per original row). Per-row attributes ({@code rowspacing}, {@code rowalign},
 * {@code equalrows}, {@code displaystyle}) go to both inner mtables so row gaps and per-row alignment
 * track each other. A {@link scheduleWrappedMlabeledtrBaselineSync} pass equalizes per-row baselines
 * after layout (multiple labels with different row heights all stay glued to their equation rows).
 * Removes {@code data-mlabeledtr-expanded}.
 * @param {Element} mtable
 * @returns {void}
 */
function wrapExpandedMtableForNativeEquationLabelSplit(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return;
  }
  if (!mtable.hasAttribute('data-mlabeledtr-expanded')) {
    return;
  }
  if (!detectNativeMtablePresentationAttrs()) {
    return;
  }

  const doc = mtable.ownerDocument;
  if (!doc) return;

  const oldRows = Array.from(mtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  const n = maxColumnCount(oldRows);
  // Total columns = 1 label + (# equation columns). Wrapping needs at least one equation column.
  const equationColCount = n - 1;
  if (oldRows.length === 0 || equationColCount < 1) {
    mtable.removeAttribute('data-mlabeledtr-expanded');
    return;
  }

  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;

  for (const oldRow of oldRows) {
    const k = Array.from(oldRow.children).filter(
      (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
    ).length;
    if (k !== n) {
      return;
    }
  }

  const innerMtable = doc.createElementNS(MATHML_NS, 'mtable');
  const labelMtable = doc.createElementNS(MATHML_NS, 'mtable');
  innerMtable.setAttribute('data-mlabeledtr-equation-table', '');
  labelMtable.setAttribute('data-mlabeledtr-label-table', '');

  for (const oldRow of oldRows) {
    const cells = Array.from(oldRow.children).filter(
      (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
    );

    const eqRow = doc.createElementNS(MATHML_NS, 'mtr');
    const labRow = doc.createElementNS(MATHML_NS, 'mtr');
    const { equationRowalign, labelRowalign } = splitRowalignForWrappedMlabeledtr(
      oldRow,
      n,
      labelCol
    );
    if (equationRowalign) eqRow.setAttribute('rowalign', equationRowalign);
    if (labelRowalign) labRow.setAttribute('rowalign', labelRowalign);

    for (let i = 0; i < cells.length; i++) {
      if (i === labelCol) {
        labRow.appendChild(cells[i]);
      } else {
        eqRow.appendChild(cells[i]);
      }
    }
    innerMtable.appendChild(eqRow);
    labelMtable.appendChild(labRow);
  }

  for (const name of MTABLE_LAYOUT_ATTRS_EQUATION_ONLY_FOR_NATIVE_WRAP) {
    if (!mtable.hasAttribute(name)) continue;
    const v = mtable.getAttribute(name);
    if (v != null) innerMtable.setAttribute(name, v);
    mtable.removeAttribute(name);
  }
  for (const name of MTABLE_LAYOUT_ATTRS_SHARED_FOR_NATIVE_WRAP) {
    if (!mtable.hasAttribute(name)) continue;
    const v = mtable.getAttribute(name);
    if (v == null) continue;
    innerMtable.setAttribute(name, v);
    labelMtable.setAttribute(name, v);
    mtable.removeAttribute(name);
  }
  mtable.removeAttribute('side');
  mtable.removeAttribute('data-mlabeledtr-expanded');

  while (mtable.firstChild) {
    mtable.removeChild(mtable.firstChild);
  }

  for (const mtr of innerMtable.children) {
    if (mtr.namespaceURI !== MATHML_NS || mtr.localName !== 'mtr') continue;
    for (const mtd of mtr.children) {
      if (mtd.namespaceURI === MATHML_NS && mtd.localName === 'mtd') {
        ensureMtdHasBaselineProbeMrow(/** @type {Element} */ (mtd));
      }
    }
  }
  for (const mtr of labelMtable.children) {
    if (mtr.namespaceURI !== MATHML_NS || mtr.localName !== 'mtr') continue;
    for (const mtd of mtr.children) {
      if (mtd.namespaceURI === MATHML_NS && mtd.localName === 'mtd') {
        ensureMtdHasBaselineProbeMrow(/** @type {Element} */ (mtd));
      }
    }
  }

  const wrapRow = doc.createElementNS(MATHML_NS, 'mtr');
  const mtdEq = doc.createElementNS(MATHML_NS, 'mtd');
  const mtdLb = doc.createElementNS(MATHML_NS, 'mtd');
  mtdEq.appendChild(innerMtable);
  mtdLb.appendChild(labelMtable);
  if (side === 'right') {
    wrapRow.appendChild(mtdEq);
    wrapRow.appendChild(mtdLb);
  } else {
    wrapRow.appendChild(mtdLb);
    wrapRow.appendChild(mtdEq);
  }
  mtable.appendChild(wrapRow);

  scheduleWrappedMlabeledtrBaselineSync(mtable);
}

/** @type {WeakMap<Element, ResizeObserver>} */
const wrappedMlabeledtrResizeObservers = new WeakMap();

/**
 * Find the inner equation / label {@code mtable} produced by
 * {@link wrapExpandedMtableForNativeEquationLabelSplit}.
 * @param {Element} outerMtable
 * @param {string} marker {@code data-mlabeledtr-equation-table} or {@code data-mlabeledtr-label-table}
 * @returns {Element | null}
 */
function findWrappedInnerMtable(outerMtable, marker) {
  const wrapRow = outerMtable.firstElementChild;
  if (!wrapRow) return null;
  for (const mtd of wrapRow.children) {
    if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
    const inner = mtd.firstElementChild;
    if (
      inner &&
      inner.namespaceURI === MATHML_NS &&
      inner.localName === 'mtable' &&
      inner.hasAttribute(marker)
    ) {
      return /** @type {Element} */ (inner);
    }
  }
  return null;
}

/**
 * Reset per-row baseline-sync adjustments (leading {@code mrow} {@code margin-top} and the trailing
 * descent {@code mspace}) so a fresh measurement reflects natural row heights.
 * @param {Element[]} mtrs
 * @returns {void}
 */
function resetWrappedMlabeledtrSyncOnRows(mtrs) {
  for (const mtr of mtrs) {
    for (const mtd of mtr.children) {
      if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
      const mrow = getFirstMrowChild(/** @type {Element} */ (mtd));
      if (!mrow) continue;
      /** @type {HTMLElement} */ (mrow).style.marginTop = '';
      const last = mrow.lastElementChild;
      if (
        last &&
        last.namespaceURI === MATHML_NS &&
        last.localName === 'mspace' &&
        last.hasAttribute('data-mlabeledtr-descent-pad')
      ) {
        last.remove();
      }
    }
  }
}

/**
 * Measure the row's natural ascent (rect top → baseline probe top) and descent (probe top → rect
 * bottom) using the first MathML {@code mtd} that has a leading baseline probe. Returns zeros when no
 * usable probe is found.
 * @param {Element} mtr
 * @returns {{ ascent: number, descent: number }}
 */
function measureMtrBaselineGeometry(mtr) {
  for (const mtd of mtr.children) {
    if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
    const mrow = getFirstMrowChild(/** @type {Element} */ (mtd));
    if (!mrow) continue;
    const probe = mrow.firstElementChild;
    if (!isZeroBaselineProbe(probe)) continue;
    const mtdRect = /** @type {Element} */ (mtd).getBoundingClientRect();
    const probeRect = /** @type {Element} */ (probe).getBoundingClientRect();
    const ascent = Math.max(0, probeRect.top - mtdRect.top);
    const descent = Math.max(0, mtdRect.bottom - probeRect.top);
    return { ascent, descent };
  }
  return { ascent: 0, descent: 0 };
}

/**
 * Apply baseline-sync adjustments: shift each cell's leading {@code mrow} down by
 * {@code ascent - ownAscent} via {@code margin-top}, and append a trailing {@code <mspace depth>} of
 * {@code descent - ownDescent} so the row's bottom extends to the unified row height.
 * @param {Element} mtr
 * @param {number} ascent Unified row ascent (px).
 * @param {number} descent Unified row descent (px).
 * @param {number} ownAscent Row's own ascent before adjustment (px).
 * @param {number} ownDescent Row's own descent before adjustment (px).
 * @returns {void}
 */
function applyWrappedMlabeledtrRowSync(mtr, ascent, descent, ownAscent, ownDescent) {
  const dyAscent = Math.max(0, ascent - ownAscent);
  const dyDescent = Math.max(0, descent - ownDescent);
  for (const mtd of mtr.children) {
    if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
    const mrow = getFirstMrowChild(/** @type {Element} */ (mtd));
    if (!mrow) continue;
    /** @type {HTMLElement} */ (mrow).style.marginTop = dyAscent > 0 ? `${dyAscent}px` : '';
    if (dyDescent > 0) {
      const doc = mtd.ownerDocument;
      if (!doc) continue;
      const sp = doc.createElementNS(MATHML_NS, 'mspace');
      sp.setAttribute('width', '0');
      sp.setAttribute('height', '0');
      sp.setAttribute('depth', `${dyDescent}px`);
      sp.setAttribute('data-mlabeledtr-descent-pad', '');
      mrow.appendChild(sp);
    }
  }
}

/**
 * Per-row baseline + height sync for a wrapped {@code mlabeledtr} table on the native path. For each
 * row, equalize ascent (row top → baseline) and descent (baseline → row bottom) between the equation
 * and label inner {@code mtable}s so the label sits on its equation row's baseline regardless of
 * mismatched row content heights or differing baselines.
 * @param {Element} outerMtable
 * @returns {void}
 */
function runWrappedMlabeledtrBaselineSync(outerMtable) {
  if (!outerMtable || !outerMtable.isConnected) return;
  const eqMtable = findWrappedInnerMtable(outerMtable, 'data-mlabeledtr-equation-table');
  const labMtable = findWrappedInnerMtable(outerMtable, 'data-mlabeledtr-label-table');
  if (!eqMtable || !labMtable) return;

  const eqRows = Array.from(eqMtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  const labRows = Array.from(labMtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  if (eqRows.length === 0 || eqRows.length !== labRows.length) return;

  resetWrappedMlabeledtrSyncOnRows(eqRows);
  resetWrappedMlabeledtrSyncOnRows(labRows);
  forceLayout(outerMtable);

  for (let i = 0; i < eqRows.length; i++) {
    const eqRow = eqRows[i];
    const labRow = labRows[i];
    const eqGeom = measureMtrBaselineGeometry(eqRow);
    const labGeom = measureMtrBaselineGeometry(labRow);
    const A = Math.max(eqGeom.ascent, labGeom.ascent);
    const D = Math.max(eqGeom.descent, labGeom.descent);
    applyWrappedMlabeledtrRowSync(eqRow, A, D, eqGeom.ascent, eqGeom.descent);
    applyWrappedMlabeledtrRowSync(labRow, A, D, labGeom.ascent, labGeom.descent);
  }
}

/**
 * Schedule {@link runWrappedMlabeledtrBaselineSync} on layout / size changes (double {@code rAF} on
 * setup plus a {@code ResizeObserver} on the outer table).
 * @param {Element} outerMtable
 * @returns {void}
 */
function scheduleWrappedMlabeledtrBaselineSync(outerMtable) {
  const prev = wrappedMlabeledtrResizeObservers.get(outerMtable);
  if (prev) {
    prev.disconnect();
    wrappedMlabeledtrResizeObservers.delete(outerMtable);
  }
  const run = () => runWrappedMlabeledtrBaselineSync(outerMtable);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(run);
    });
    ro.observe(outerMtable);
    wrappedMlabeledtrResizeObservers.set(outerMtable, ro);
  }
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * @param {Element} mtable
 * @returns {{ rows: Element[], placed: PlacedCell[] }}
 */
function listTableRowsAndCells(mtable) {
  /** @type {Element[]} */
  const rows = Array.from(mtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  /** @type {PlacedCell[]} */
  const placed = [];

  for (let r = 0; r < rows.length; r++) {
    const rowEl = rows[r];
    const cells = Array.from(rowEl.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    let c = 0;
    for (const mtd of cells) {
      wrapMtdInferredMrow(mtd);
      placed.push({ mtd, row: r, col: c });
      c += 1;
    }
  }
  return { rows, placed };
}

/**
 * Parse {@code mtable@align}: {@code ("top"|"bottom"|"center"|"baseline"|"axis") rownumber?}.
 * Row number may be separated by spaces or commas (e.g. {@code "baseline 2"}, {@code "baseline,2"}).
 * @param {string | null | undefined} raw
 * @returns {{ mode: string, row1Based: number | null }}
 */
function parseMtableAlign(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { mode: 'axis', row1Based: null };
  }
  const parts = String(raw)
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return { mode: 'axis', row1Based: null };
  }
  /** @type {number | null} */
  let row1Based = null;
  /** @type {string[]} */
  let modeParts = parts;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^-?\d+$/.test(last)) {
      row1Based = parseInt(last, 10);
      modeParts = parts.slice(0, -1);
    }
  }
  const modeToken = modeParts.join(' ');
  const mode = normalizeEnum(modeToken, ROWALIGN_VALUES, 'axis');
  return { mode, row1Based };
}

/**
 * @param {string | null | undefined} raw
 * @param {boolean} defaultVal
 * @returns {boolean}
 */
function parseBooleanAttr(raw, defaultVal) {
  if (raw == null || String(raw).trim() === '') return defaultVal;
  const t = String(raw).trim().toLowerCase();
  if (t === 'true' || t === 'yes' || t === '1') return true;
  if (t === 'false' || t === 'no' || t === '0') return false;
  return defaultVal;
}

/**
 * @param {string | null | undefined} raw
 * @returns {[string, string]}
 */
function parseFramespacing(raw) {
  const parts = parseSpaceList(raw);
  if (parts.length === 0) return ['0.4em', '0.5ex'];
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts[0], parts[1]];
}

/**
 * @param {Element} el
 * @param {string} extraCss
 * @returns {void}
 */
function appendInlineStyle(el, extraCss) {
  const cur = el.getAttribute('style') || '';
  const t = cur.trim();
  const add = extraCss.trim();
  if (!add) return;
  el.setAttribute('style', t ? `${t}; ${add}` : add);
}

/**
 * Apply {@code frame} on {@code mtable}, internal {@code rowlines} as a full-width
 * {@code border-top} on each {@code mtr} after the first (or on equation {@code mtd}s only when
 * {@code data-mlabeledtr-expanded} is set), and {@code columnlines} as
 * {@code border-left} on {@code mtd} from the second column onward. When {@code internalLinesVisible}
 * is true and there is no frame, each {@code mtr} gets {@code min-width: 100%}. When there is a frame,
 * rows use negative margins equal to {@code framespacing} and {@code width: calc(100% + …)} so internal
 * rules meet the inner edge of the frame border (the grid extends into the padding band). With
 * {@code data-mlabeledtr-expanded} and a non-{@code none} {@code frame}, the outline is drawn on equation
 * {@code mtd}s only (see {@link appendEquationOnlyFrameBorders}). Last-row cells get extra
 * {@code padding-bottom} on equation columns so vertical column borders reach the bottom padding edge.
 * @param {Element} mtable
 * @param {string[]} rowlines
 * @param {string[]} columnlines
 * @param {string} frame
 * @param {string} hFrameSpace
 * @param {string} vFrameSpace
 * @param {PlacedCell[]} placed
 * @param {Element[]} rows Each {@code mtr} (same order as {@code listTableRowsAndCells}).
 * @param {boolean} internalLinesVisible Any non-{@code none} {@code rowlines} or {@code columnlines}.
 * @returns {void}
 */
function applyLineAndFrameStyles(
  mtable,
  rowlines,
  columnlines,
  frame,
  hFrameSpace,
  vFrameSpace,
  placed,
  rows,
  internalLinesVisible
) {
  const frameStyle = normalizeEnum(frame, LINESTYLE_VALUES, 'none');
  const borderStyle = frameStyle === 'none' ? 'none' : frameStyle;
  const frameCss =
    frameStyle === 'none'
      ? ''
      : `border: 0.067em ${borderStyle} currentColor; padding: ${vFrameSpace} ${hFrameSpace}; box-sizing: border-box;`;
  const expandedLabeled = mtable.hasAttribute('data-mlabeledtr-expanded');
  const ncolsLabeled = expandedLabeled ? maxColumnCount(rows) : 0;
  const sideLabeled = normalizeMtableSide(mtable.getAttribute('side'));
  const labelColPhysical =
    expandedLabeled && ncolsLabeled >= 2 ? (sideLabeled === 'right' ? ncolsLabeled - 1 : 0) : -1;

  if (frameStyle !== 'none' && expandedLabeled) {
    appendInlineStyle(
      mtable,
      `border: none; padding: ${vFrameSpace} ${hFrameSpace}; box-sizing: border-box;`
    );
    appendEquationOnlyFrameBorders(mtable, placed, rows, borderStyle);
  } else if (frameCss) {
    appendInlineStyle(mtable, frameCss);
  }

  if (internalLinesVisible && frameStyle !== 'none') {
    appendInlineStyle(mtable, 'overflow: visible;');
  }

  if (internalLinesVisible) {
    const n = rows.length;
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      const bits = ['box-sizing: border-box'];
      if (frameStyle !== 'none') {
        bits.push(`margin-left: -${hFrameSpace}`);
        bits.push(`margin-right: -${hFrameSpace}`);
        bits.push(`width: calc(100% + ${hFrameSpace} + ${hFrameSpace})`);
        if (i === 0) bits.push(`margin-top: -${vFrameSpace}`);
        if (i === n - 1) bits.push(`margin-bottom: -${vFrameSpace}`);
      } else {
        bits.push('min-width: 100%');
      }
      appendInlineStyle(r, bits.join('; '));
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const rl = pickListEntry(rowlines, i - 1, 'none');
    if (rl === 'none') continue;
    if (labelColPhysical >= 0) {
      for (const p of placed) {
        if (p.row !== i || p.col === labelColPhysical) continue;
        appendInlineStyle(
          p.mtd,
          `border-top: 0.067em ${rl} currentColor; box-sizing: border-box;`
        );
      }
    } else {
      appendInlineStyle(
        rows[i],
        `border-top: 0.067em ${rl} currentColor; box-sizing: border-box;`
      );
    }
  }

  for (const p of placed) {
    const { mtd, col } = p;
    if (col <= 0) continue;
    const cl = resolveColumnlineForMtdBorderLeft(mtable, col, columnlines, rows);
    if (cl === 'none') continue;
    appendInlineStyle(
      mtd,
      `border-left: 0.067em ${cl} currentColor; box-sizing: border-box;`
    );
  }

  if (internalLinesVisible && frameStyle !== 'none' && rows.length > 0) {
    const lastR = rows.length - 1;
    for (const p of placed) {
      if (p.row === lastR && p.col !== labelColPhysical) {
        appendInlineStyle(p.mtd, `padding-bottom: ${vFrameSpace}; box-sizing: border-box;`);
      }
    }
  }
}

/**
 * @param {Element} mtable
 * @returns {{ rowalign: string[], columnalign: string[] }} Non-empty lists; absent attributes become
 *   {@code ['baseline']} and {@code ['center']}.
 */
function readMtableAlignLists(mtable) {
  let rowalign = parseSpaceList(mtable.getAttribute('rowalign')).map((t) =>
    normalizeEnum(t, ROWALIGN_VALUES, 'baseline')
  );
  if (!rowalign.length) {
    rowalign = ['baseline'];
  }
  let columnalign = parseSpaceList(mtable.getAttribute('columnalign')).map((t) =>
    normalizeEnum(t, COLUMNALIGN_VALUES, 'center')
  );
  if (!columnalign.length) {
    columnalign = ['center'];
  }
  return { rowalign, columnalign };
}

/**
 * MathML 4 defaults for {@code mtable}: {@code rowalign} baseline, {@code columnalign} center.
 * The {@code mtable} (or each {@code mtr} when subgrid is unsupported) grid sets
 * {@code justify-items: stretch}. With column subgrid, the outer {@code mtable} uses
 * {@code align-items: first baseline} by default, or {@code stretch} when {@code equalrows} is true
 * so each {@code mtr} fills {@code 1fr} row tracks (columnlines on {@code mtd} span the row).
 * Each {@code mtr} row grid uses {@code align-items: stretch} when internal grid lines are visible
 * so {@code mtd} boxes fill row tracks (continuous column rules). Vertical {@code rowalign} is
 * applied after layout via {@link runLinedMtdVerticalLayout} (margin on the leading {@code mrow}).
 * Each {@code mtd} gets {@code justify-self} / {@code text-align} from {@code columnalign} when lines
 * are off; for {@code rowalign} {@code top}/{@code center}/{@code bottom} without lines, {@code mtd} uses
 * {@code align-self: stretch} with {@code display: flex; flex-direction: column} and {@code justify-content}
 * so math sits at the top/center/bottom inside the row track (grid {@code align-items: first baseline} on
 * {@code mtr} otherwise fights {@code align-self: end} for tall cells). With lines, {@code display: flex}
 * and {@code align-items} map horizontal placement (MathML often ignores {@code text-align} on {@code mtd}).
 * {@code axis} also gets composed {@code padding-top} with row spacing (U+2212 probe or {@code ex} fallback).
 * {@link readMtableAlignLists} supplies {@code ['baseline']} / {@code ['center']} when {@code mtable}
 * omits those attributes.
 *
 * @param {Element} mtd
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {string[]} mtableRowalign
 * @param {string[]} mtableColumnalign
 * @param {Element | null} mtr
 * @param {boolean} cellMinWidthZero When true, set {@code min-width: 0} so {@code mtd} can shrink inside
 *   {@code minmax(0, 1fr)} tracks ({@code equalcolumns} or {@code columnwidth="fit"}). Omit otherwise so
 *   {@code auto} columns keep an intrinsic minimum width (avoids crushing MathML in narrow tracks).
 * @param {boolean} internalLinesVisible When true, stretch cells for grid lines and column flex; vertical
 *   alignment is finalized by {@link scheduleLinedMtdVerticalLayout}.
 * @param {Element} mtable
 * @returns {void}
 */
function applyCellAlignments(
  mtd,
  rowIndex,
  colIndex,
  mtableRowalign,
  mtableColumnalign,
  mtr,
  cellMinWidthZero,
  internalLinesVisible,
  mtable
) {
  const ra = resolveEffectiveRowalign(mtd, rowIndex, colIndex, mtableRowalign, mtr, mtable);
  const ca = resolveEffectiveColumnalign(mtd, colIndex, mtableColumnalign, mtr, mtable);
  const parts = [];
  if (cellMinWidthZero) {
    parts.push('min-width: 0');
  }
  if (internalLinesVisible) {
    parts.push('box-sizing: border-box');
    parts.push('justify-self: stretch');
    parts.push('align-self: stretch');
    parts.push('display: flex');
    parts.push('flex-direction: column');
    parts.push('width: 100%');
    parts.push('height: 100%');
    parts.push('min-height: 0');
    parts.push(`align-items: ${columnalignToJustifyContent(ca)}`);
  } else {
    parts.push(`justify-self: ${columnalignToJustifySelf(ca)}`);
    if (ra === 'top' || ra === 'bottom' || ra === 'center') {
      parts.push('align-self: stretch');
      parts.push('display: flex');
      parts.push('flex-direction: column');
      parts.push('width: 100%');
      parts.push('height: 100%');
      parts.push('min-height: 0');
      parts.push(`justify-content: ${rowalignToFlexMainJustify(ra)}`);
      parts.push(`align-items: ${columnalignToJustifyContent(ca)}`);
    } else {
      parts.push('align-self: baseline');
    }
  }
  parts.push(`text-align: ${columnalignToTextAlign(ca)}`);
  appendInlineStyle(mtd, `${parts.join('; ')};`);
}

/**
 * @param {Element[]} rows
 * @returns {number}
 */
function maxColumnCount(rows) {
  let n = 0;
  for (const row of rows) {
    let c = 0;
    for (const child of row.children) {
      if (child.namespaceURI === MATHML_NS && child.localName === 'mtd') c += 1;
    }
    if (c > n) n = c;
  }
  return n;
}

/**
 * {@code border-left} on an {@code mtd} at physical column {@code physicalCol} draws the line between
 * columns {@code physicalCol - 1} and {@code physicalCol}. When {@code data-mlabeledtr-expanded} is set,
 * {@code columnlines} tokens apply only between equation columns (no rule touching the label column).
 * @param {Element} mtable
 * @param {number} physicalCol
 * @param {string[]} columnlines
 * @param {Element[]} rows
 * @returns {string}
 */
function resolveColumnlineForMtdBorderLeft(mtable, physicalCol, columnlines, rows) {
  if (physicalCol <= 0) return 'none';
  if (!mtable.hasAttribute('data-mlabeledtr-expanded')) {
    return pickListEntry(columnlines, physicalCol - 1, 'none');
  }
  const n = maxColumnCount(rows);
  if (n < 2) return pickListEntry(columnlines, physicalCol - 1, 'none');
  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;
  const leftCol = physicalCol - 1;
  const rightCol = physicalCol;
  if (leftCol === labelCol || rightCol === labelCol) {
    return 'none';
  }
  const listIndex = side === 'right' ? physicalCol - 1 : physicalCol - 2;
  return pickListEntry(columnlines, listIndex, 'none');
}

/**
 * Draw {@code frame} on the equation block only (perimeter {@code mtd} borders). The label column is
 * skipped so the outline does not wrap the label.
 * @param {Element} mtable
 * @param {PlacedCell[]} placed
 * @param {Element[]} rows
 * @param {string} borderStyle Normalized line style (not {@code none}).
 * @returns {void}
 */
function appendEquationOnlyFrameBorders(mtable, placed, rows, borderStyle) {
  const n = maxColumnCount(rows);
  if (n < 2) return;
  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;
  const firstEq = side === 'right' ? 0 : 1;
  const lastEq = side === 'right' ? n - 2 : n - 1;
  const lastR = rows.length - 1;
  const bw = `0.067em ${borderStyle} currentColor`;
  for (const p of placed) {
    if (p.col === labelCol) continue;
    const bits = [];
    if (p.row === 0) bits.push(`border-top: ${bw}`);
    if (p.row === lastR) bits.push(`border-bottom: ${bw}`);
    if (p.col === firstEq) bits.push(`border-left: ${bw}`);
    if (p.col === lastEq) bits.push(`border-right: ${bw}`);
    if (!bits.length) continue;
    bits.unshift('box-sizing: border-box');
    appendInlineStyle(p.mtd, bits.join('; '));
  }
}

/**
 * @param {string[]} columnwidthList
 * @param {number} cols
 * @returns {string}
 */
function buildGridTemplateColumns(columnwidthList, cols) {
  if (cols <= 0) return 'none';
  if (!columnwidthList.length) return `repeat(${cols}, auto)`;
  const out = [];
  for (let i = 0; i < cols; i++) {
    const raw = pickListEntry(columnwidthList, i, 'auto');
    const t = normToken(raw);
    if (t === 'auto') out.push('auto');
    else if (t === 'fit') out.push('minmax(0, 1fr)');
    else out.push(raw);
  }
  return out.join(' ');
}

/**
 * @param {number} row1Based
 * @param {number} numRows
 * @returns {number}
 */
function resolveRowIndex0(row1Based, numRows) {
  if (numRows <= 0) return -1;
  let r = row1Based > 0 ? row1Based - 1 : numRows + row1Based;
  if (r < 0 || r >= numRows) return -1;
  return r;
}

/**
 * Vertical center of a DOMRect (CSS pixels).
 * @param {DOMRect} r
 * @returns {number}
 */
function rectCenterY(r) {
  return r.top + r.height / 2;
}

/**
 * Baseline Y for a MathML box: bottom minus approximate axis half-line (ex/2 from bottom is wrong).
 * Uses getBoundingClientRect of the element; for math content baseline approximates bottom of em-box.
 * @param {Element} el
 * @returns {number}
 */
function approxBaselineY(el) {
  const r = el.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
  return r.bottom - fs * 0.25;
}

/**
 * Vertical span (top, bottom, mid) of element children of {@code parent}, excluding {@code skip}.
 * @param {Element} parent
 * @param {Element} skip
 * @returns {{ top: number, bottom: number, mid: number } | null}
 */
function siblingsVerticalSpanExcluding(parent, skip) {
  let uTop = Infinity;
  let uBottom = -Infinity;
  for (const c of parent.children) {
    if (c === skip || c.nodeType !== 1) continue;
    const el = /** @type {Element} */ (c);
    const r = el.getBoundingClientRect();
    uTop = Math.min(uTop, r.top);
    uBottom = Math.max(uBottom, r.bottom);
  }
  if (!Number.isFinite(uTop) || uTop === Infinity) return null;
  return { top: uTop, bottom: uBottom, mid: (uTop + uBottom) / 2 };
}

/**
 * Measure the environment line baseline at the {@code mtable}'s position by inserting a zero-sized
 * {@code <mspace>} sibling and reading its bounding-rect top (which equals the line baseline).
 * @param {Element} mtable
 * @returns {number | null}
 */
function measureEnvironmentBaselineY(mtable) {
  const doc = mtable.ownerDocument;
  const parent = mtable.parentElement;
  if (!doc || !parent) return null;
  const probe = doc.createElementNS(MATHML_NS, 'mspace');
  probe.setAttribute('width', '0');
  probe.setAttribute('height', '0');
  probe.setAttribute('depth', '0');
  parent.insertBefore(probe, mtable.nextSibling);
  forceLayout(probe);
  const baselineY = probe.getBoundingClientRect().top;
  probe.remove();
  if (!Number.isFinite(baselineY)) return null;
  return baselineY;
}

/**
 * Measure the baseline Y and full vertical extent of {@code mtd}'s laid-out content. Wraps the
 * existing content in {@code <mrow><mspace/>…children…</mrow>} so the probe shares an explicit
 * MathML inferred-mrow baseline with the content (needed because inserting a probe directly into
 * {@code mtd} as a grid item can position it at the cell top rather than the baseline in some
 * engines, e.g. for {@code <mfrac>} content where baseline is at the fraction bar). Restores the
 * original children before returning.
 * @param {Element} mtd
 * @returns {{ baselineY: number, top: number, bottom: number } | null}
 */
function measureMtdDimensions(mtd) {
  const doc = mtd.ownerDocument;
  if (!doc) return null;
  const wrapper = doc.createElementNS(MATHML_NS, 'mrow');
  const probe = doc.createElementNS(MATHML_NS, 'mspace');
  probe.setAttribute('width', '0');
  probe.setAttribute('height', '0');
  probe.setAttribute('depth', '0');
  wrapper.appendChild(probe);
  /** @type {Node[]} */
  const moved = [];
  while (mtd.firstChild) {
    const n = mtd.firstChild;
    moved.push(n);
    wrapper.appendChild(n);
  }
  mtd.appendChild(wrapper);
  forceLayout(probe);
  const probeRect = probe.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  /** @type {{ baselineY: number, top: number, bottom: number } | null} */
  const result = Number.isFinite(probeRect.top)
    ? { baselineY: probeRect.top, top: wrapperRect.top, bottom: wrapperRect.bottom }
    : null;
  for (const n of moved) {
    mtd.appendChild(n);
  }
  wrapper.remove();
  return result;
}

/**
 * Sibling line geometry for aligning an {@code mtable} to its MathML environment. Uses a zero-sized
 * {@code <mspace>} probe to read the line baseline so we are not at the mercy of glyph bounding
 * boxes (e.g. {@code <mo>U+2212</mo>}, whose box may not reach the descender).
 * @param {Element} mtable
 * @returns {{ span: { top: number, bottom: number, mid: number } | null, refBaseline: number | null }}
 */
function readAlignEnvironmentRefs(mtable) {
  const parent = mtable.parentElement;
  if (!parent) return { span: null, refBaseline: null };
  const span = siblingsVerticalSpanExcluding(parent, mtable);
  const refBaseline = measureEnvironmentBaselineY(mtable);
  return { span, refBaseline };
}

/**
 * Run {@code fn} after the table is in the document and layout has produced reliable bounds
 * ({@code queueMicrotask} + double {@code requestAnimationFrame}, then {@link forceLayout}).
 * @param {Element} mtable
 * @param {() => void} fn
 * @returns {void}
 */
function scheduleDeferredTableLayoutTask(mtable, fn) {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mtable.isConnected) return;
        forceLayout(mtable);
        fn();
      });
    });
  });
}

/**
 * Approximate baseline Y of table content (first cell of first row), not the grid margin box.
 * @param {Element} mtable
 * @param {Element[]} rows
 * @returns {number}
 */
function approxMtableBaselineY(mtable, rows) {
  const r0 = rows[0];
  if (!r0) return approxBaselineY(mtable);
  const mtd = Array.from(r0.children).find(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
  );
  if (mtd) return approxBaselineY(mtd);
  return approxBaselineY(mtable);
}

/**
 * After layout, adjust {@code mtable@align} when no row index is given (whole table vs siblings).
 * Uses {@link applyAlignShift} which combines {@code transform: translateY} with directional padding
 * so the table actually moves (math layout ignores {@code vertical-align}) while the layout box
 * grows to fit (no HTML {@code td} clipping).
 * @param {Element} mtable
 * @param {string} mode
 * @param {Element[]} rows
 * @returns {void}
 */
function scheduleWholeMtableAlignAdjustment(mtable, mode, rows) {
  scheduleDeferredTableLayoutTask(mtable, () => {
    const { refBaseline } = readAlignEnvironmentRefs(mtable);
    if (refBaseline == null) return;

    const tableRect = mtable.getBoundingClientRect();
    const m = normalizeEnum(mode, ROWALIGN_VALUES, 'axis');
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    const axisPx = ax != null && ax > 0 ? ax : convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX);

    /** @type {number} */
    let dy = 0;
    if (m === 'top') {
      dy = refBaseline - tableRect.top;
    } else if (m === 'bottom') {
      dy = refBaseline - tableRect.bottom;
    } else if (m === 'center' || m === 'baseline') {
      dy = refBaseline - rectCenterY(tableRect);
    } else if (m === 'axis') {
      dy = refBaseline - axisPx - rectCenterY(tableRect);
    } else {
      return;
    }

    if (!Number.isFinite(dy) || Math.abs(dy) < 0.25) return;
    applyAlignShift(mtable, dy);
  });
}

/**
 * Apply a vertical shift to {@code mtable} that is robust against MathML layout. Uses
 * {@code transform: translateY} for the visual move (CSS {@code vertical-align} and {@code margin}
 * are ignored by some browsers for math children) and grows the box with padding so the
 * surrounding line / HTML {@code td} accommodates the shift (prevents the painted content from
 * spilling beyond the table's layout box and being clipped/overlapped).
 * @param {Element} mtable
 * @param {number} dy positive = shift down, negative = shift up (CSS px)
 * @returns {void}
 */
function applyAlignShift(mtable, dy) {
  const padTop = dy < 0 ? -dy : 0;
  const padBottom = dy > 0 ? dy : 0;
  const css = [
    `transform: translateY(${dy}px)`,
    `padding-top: ${padTop}px`,
    `padding-bottom: ${padBottom}px`,
    'box-sizing: content-box',
  ].join('; ');
  appendInlineStyle(mtable, `${css};`);
}

/**
 * After layout, adjust {@code mtable@align} when a row number is given: that row's geometry is
 * aligned to the MathML environment (sibling baseline / axis), not to the whole-table box.
 * @param {Element} mtable
 * @param {{ mode: string, row1Based: number | null }} alignSpec
 * @param {Element[]} rows
 * @returns {void}
 */
function scheduleAlignRowAdjustment(mtable, alignSpec, rows) {
  const { mode, row1Based } = alignSpec;
  if (row1Based == null) return;
  const r0 = resolveRowIndex0(row1Based, rows.length);
  if (r0 < 0) return;

  scheduleDeferredTableLayoutTask(mtable, () => {
    const { refBaseline } = readAlignEnvironmentRefs(mtable);
    if (refBaseline == null) return;

    const rowEl = rows[r0];
    const mtds = Array.from(rowEl.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    if (!mtds.length) return;

    let uTop = Infinity;
    let uBottom = -Infinity;
    /** @type {number | null} */
    let rowBaseline = null;
    for (const mtd of mtds) {
      const dims = measureMtdDimensions(mtd);
      if (!dims) continue;
      uTop = Math.min(uTop, dims.top);
      uBottom = Math.max(uBottom, dims.bottom);
      rowBaseline = rowBaseline == null ? dims.baselineY : Math.max(rowBaseline, dims.baselineY);
    }
    if (
      rowBaseline == null ||
      !Number.isFinite(rowBaseline) ||
      !Number.isFinite(uTop) ||
      !Number.isFinite(uBottom)
    ) {
      return;
    }
    const rowMid = (uTop + uBottom) / 2;
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    const axisPx = ax != null && ax > 0 ? ax : convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX);

    const m = normalizeEnum(mode, ROWALIGN_VALUES, 'axis');
    /** @type {number} */
    let dy = 0;
    if (m === 'top') {
      dy = refBaseline - uTop;
    } else if (m === 'bottom') {
      dy = refBaseline - uBottom;
    } else if (m === 'center') {
      dy = refBaseline - rowMid;
    } else if (m === 'baseline') {
      dy = refBaseline - rowBaseline;
    } else if (m === 'axis') {
      // Row's math axis sits axisPx above its typographic baseline; the environment's axis is
      // axisPx above its baseline. The axisPx terms cancel, so the required shift is the same as
      // baseline alignment: bring row_baseline onto env_baseline.
      dy = refBaseline - axisPx - (rowBaseline - axisPx);
    } else {
      return;
    }

    if (!Number.isFinite(dy) || Math.abs(dy) < 0.25) return;
    applyAlignShift(mtable, dy);
  });
}

/**
 * MathML 4: if {@code displaystyle} is absent on {@code mtable}, it is false inside the table.
 * @param {Element} mtable
 * @param {boolean} hadDisplaystyleAttr
 * @returns {void}
 */
function applyDisplaystyleDefault(mtable, hadDisplaystyleAttr) {
  if (!hadDisplaystyleAttr) {
    mtable.setAttribute('displaystyle', 'false');
    return;
  }
  const on = parseBooleanAttr(mtable.getAttribute('displaystyle'), false);
  mtable.setAttribute('displaystyle', on ? 'true' : 'false');
}

/** @type {WeakMap<Element, ResizeObserver>} */
const linedMtableResizeObservers = new WeakMap();

/**
 * With visible internal lines, {@code mtr}/{@code mtd} stay stretched so column borders span the row;
 * vertical {@code rowalign} is applied by setting {@code margin-top} on each cell’s leading {@code mrow}
 * after layout (baseline/axis share a reference depth from a leading zero {@code mspace}).
 * @param {Element} mtable
 * @param {Element[]} rows
 * @param {string[]} mtableRowalign
 * @returns {void}
 */
function runLinedMtdVerticalLayout(mtable, rows, mtableRowalign) {
  if (!mtable || !rows.length) return;

  for (let r = 0; r < rows.length; r++) {
    const mtr = rows[r];
    const cells = Array.from(mtr.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    for (const mtd of cells) {
      const mrow = getFirstMrowChild(mtd);
      if (mrow) mrow.style.marginTop = '0';
    }
  }
  forceLayout(mtable);

  for (let r = 0; r < rows.length; r++) {
    const mtr = rows[r];
    const cells = Array.from(mtr.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    if (!cells.length) continue;

    const innerHs = cells.map((mtd) => {
      const cs = getComputedStyle(mtd);
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      return Math.max(0, mtd.clientHeight - pt - pb);
    });
    const H = Math.max(...innerHs, 0);

    /** @type {{ mrow: Element; ra: string; h: number; b: number }[]} */
    const items = [];
    let col = 0;
    for (const mtd of cells) {
      const ra = resolveEffectiveRowalign(mtd, r, col, mtableRowalign, mtr, mtable);
      col += 1;
      const mrow = getFirstMrowChild(mtd);
      if (!mrow) continue;

      const cs = getComputedStyle(mtd);
      const borderTop = parseFloat(cs.borderTopWidth) || 0;
      const padTop = parseFloat(cs.paddingTop) || 0;
      const mtdRect = mtd.getBoundingClientRect();
      const contentTopY = mtdRect.top + borderTop + padTop;
      const mrowRect = mrow.getBoundingClientRect();
      const h = mrowRect.height;
      const probe = mrow.firstElementChild;
      let b = 0;
      if (isZeroBaselineProbe(probe)) {
        b = probe.getBoundingClientRect().top - contentTopY;
      } else if (h > 0) {
        b = h * 0.75;
      }
      items.push({ mrow, ra, h, b });
    }

    let refBaseline = 0;
    for (const it of items) {
      if (it.ra === 'baseline' || it.ra === 'axis') {
        refBaseline = Math.max(refBaseline, it.b);
      }
    }

    for (const it of items) {
      const { mrow, ra, h, b } = it;
      let t = 0;
      if (ra === 'top') t = 0;
      else if (ra === 'bottom') t = Math.max(0, H - h);
      else if (ra === 'center') t = Math.max(0, (H - h) / 2);
      else if (ra === 'baseline' || ra === 'axis') t = Math.max(0, refBaseline - b);
      mrow.style.marginTop = `${t}px`;
    }
  }
  forceLayout(mtable);
}

/**
 * @param {Element} mtable
 * @param {Element[]} rows
 * @param {string[]} mtableRowalign
 * @returns {void}
 */
function scheduleLinedMtdVerticalLayout(mtable, rows, mtableRowalign) {
  const prev = linedMtableResizeObservers.get(mtable);
  if (prev) {
    prev.disconnect();
    linedMtableResizeObservers.delete(mtable);
  }
  const run = () => runLinedMtdVerticalLayout(mtable, rows, mtableRowalign);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(run);
    });
    ro.observe(mtable);
    linedMtableResizeObservers.set(mtable, ro);
  }
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * Apply MathML 4 table presentation attributes using CSS on {@code mtable}, {@code mtr}, and {@code mtd}.
 * Expands {@code mlabeledtr} to {@code mtr} when required for the CSS grid path or when the UA does not
 * honor {@code mtable@side} on labeled rows (see {@link detectNativeMlabeledtrSideLayout}). Per-gap
 * {@code rowspacing} / {@code columnspacing} use cell margins (grid row-gap/column-gap are uniform).
 * @param {Element} mtable
 * @returns {Element}
 */
export function applyMtablePresentationAttrsWithCss(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return mtable;
  }

  const nativeTableAttrs = detectNativeMtablePresentationAttrs();
  const hasMlabeledtr = Array.from(mtable.children).some(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mlabeledtr'
  );
  if (hasMlabeledtr && (!nativeTableAttrs || !detectNativeMlabeledtrSideLayout())) {
    expandMlabeledtrRows(mtable);
  } else {
    mtable.removeAttribute('data-mlabeledtr-expanded');
  }

  if (nativeTableAttrs && mtable.hasAttribute('data-mlabeledtr-expanded')) {
    wrapExpandedMtableForNativeEquationLabelSplit(mtable);
  }

  if (nativeTableAttrs) {
    return mtable;
  }

  const hadDisplaystyleAttr =
    mtable.hasAttribute('displaystyle') && String(mtable.getAttribute('displaystyle')).trim() !== '';

  const { rows, placed } = listTableRowsAndCells(mtable);
  if (!rows.length) {
    applyDisplaystyleDefault(mtable, hadDisplaystyleAttr);
    return mtable;
  }

  const cols = maxColumnCount(rows);
  const mtableRowspacing = parseSpaceList(mtable.getAttribute('rowspacing'));
  const mtableColumnspacing = parseSpaceList(mtable.getAttribute('columnspacing'));
  const defaultRowGap = '1.0ex';
  const defaultColGap = '0.8em';
  const equalrows = parseBooleanAttr(mtable.getAttribute('equalrows'), false);
  const equalcolumns = parseBooleanAttr(mtable.getAttribute('equalcolumns'), false);
  const columnwidthList = parseSpaceList(mtable.getAttribute('columnwidth'));
  const gridCols = equalcolumns
    ? `repeat(${cols}, minmax(0, 1fr))`
    : buildGridTemplateColumns(columnwidthList, cols);
  const gridRows = equalrows
    ? `repeat(${rows.length}, minmax(0, 1fr))`
    : `repeat(${rows.length}, auto)`;

  const { rowalign: mtableRowalign, columnalign: mtableColumnalign } = readMtableAlignLists(mtable);

  const rowlines = parseLineList(mtable.getAttribute('rowlines'), 'none');
  const columnlines = parseLineList(mtable.getAttribute('columnlines'), 'none');
  const internalLinesVisible =
    lineListHasVisible(columnlines) || lineListHasVisible(rowlines);
  // With subgrid, `mtable` row tracks can be taller than content (`equalrows` uses `1fr`). Baseline
  // alignment of `mtr` items leaves the row box short, so `mtd` borders (columnlines) do not span
  // the track — use stretch so each `mtr` fills its row when heights are equalized.
  const mtableOuterAlignItems = equalrows ? 'stretch' : 'first baseline';

  const useSubgrid = supportsColumnSubgrid();
  const gridColsPerMtr =
    !useSubgrid && internalLinesVisible
      ? `repeat(${cols}, minmax(0, 1fr))`
      : gridCols;
  if (useSubgrid) {
    appendInlineStyle(
      mtable,
      `display: inline-grid; vertical-align: baseline; grid-template-columns: ${gridCols}; grid-template-rows: ${gridRows}; row-gap: 0; column-gap: 0; justify-items: stretch; align-items: ${mtableOuterAlignItems};`
    );
    for (let i = 0; i < rows.length; i++) {
      const mtrRowAlignItems = internalLinesVisible ? 'stretch' : 'first baseline';
      appendInlineStyle(
        rows[i],
        `display: grid; grid-column: 1 / -1; grid-row: ${
          i + 1
        }; grid-template-columns: subgrid; grid-template-rows: auto; justify-items: stretch; align-items: ${mtrRowAlignItems};`
      );
    }
  } else {
    appendInlineStyle(
      mtable,
      `display: inline-grid; vertical-align: baseline; grid-template-columns: minmax(0, auto); grid-template-rows: ${gridRows}; row-gap: 0; column-gap: 0;`
    );
    for (let i = 0; i < rows.length; i++) {
      const mtrRowAlignItems = internalLinesVisible ? 'stretch' : 'first baseline';
      appendInlineStyle(
        rows[i],
        `display: grid; grid-template-columns: ${gridColsPerMtr}; grid-column: 1 / -1; grid-row: ${
          i + 1
        }; justify-items: stretch; align-items: ${mtrRowAlignItems};`
      );
    }
  }

  let axisShiftCss = `${convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX)}px`;
  if (
    placed.some((p) => {
      const mtr = rows[p.row] ?? null;
      return resolveEffectiveRowalign(p.mtd, p.row, p.col, mtableRowalign, mtr, mtable) === 'axis';
    })
  ) {
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    if (ax != null && ax > 0) axisShiftCss = `${ax}px`;
  }

  for (const p of placed) {
    const mtr = rows[p.row] ?? null;
    const ra = resolveEffectiveRowalign(p.mtd, p.row, p.col, mtableRowalign, mtr, mtable);
    const mt = pickListEntry(mtableRowspacing, Math.max(0, p.row - 1), defaultRowGap);
      const ml = pickListEntry(mtableColumnspacing, Math.max(0, p.col - 1), defaultColGap);
    const spacing = [];
    if (internalLinesVisible) {
      spacing.push('box-sizing: border-box');
    }
    const rowSpaceKey = internalLinesVisible ? 'padding-top' : 'margin-top';
    const colSpaceKey = internalLinesVisible ? 'padding-left' : 'margin-left';
    if (p.row > 0) {
      const top = ra === 'axis' ? `calc(${mt} + ${axisShiftCss})` : mt;
      spacing.push(`${rowSpaceKey}: ${top}`);
    } else if (ra === 'axis') {
      spacing.push(`${rowSpaceKey}: ${axisShiftCss}`);
    }
    if (p.col > 0) spacing.push(`${colSpaceKey}: ${ml}`);
    if (spacing.length) appendInlineStyle(p.mtd, spacing.join('; '));
  }

  const widthAttr = mtable.getAttribute('width');
  if (widthAttr != null && String(widthAttr).trim() !== '') {
    const w = String(widthAttr).trim();
    const wt = normToken(w);
    appendInlineStyle(
      mtable,
      wt === 'auto' ? 'width: auto;' : `width: ${w}; max-width: 100%;`
    );
  }

  if (mtable.hasAttribute('align')) {
    const alignSpec = parseMtableAlign(mtable.getAttribute('align'));
    if (alignSpec.row1Based != null) {
      scheduleAlignRowAdjustment(mtable, alignSpec, rows);
    } else {
      scheduleWholeMtableAlignAdjustment(mtable, alignSpec.mode, rows);
    }
  }

  applyDisplaystyleDefault(mtable, hadDisplaystyleAttr);

  const frame = mtable.getAttribute('frame') ?? 'none';
  const [hFrame, vFrame] = parseFramespacing(mtable.getAttribute('framespacing'));
  applyLineAndFrameStyles(
    mtable,
    rowlines,
    columnlines,
    frame,
    hFrame,
    vFrame,
    placed,
    rows,
    internalLinesVisible
  );

  for (const p of placed) {
    const mtr = rows[p.row] ?? null;
    const colWidthTok = normToken(
      pickListEntry(
        columnwidthList,
        presentationColumnListIndex(p.mtd, p.col, mtable, mtr),
        'auto'
      )
    );
    const cellMinWidthZero =
      equalcolumns || colWidthTok === 'fit' || (!useSubgrid && internalLinesVisible);
    applyCellAlignments(
      p.mtd,
      p.row,
      p.col,
      mtableRowalign,
      mtableColumnalign,
      mtr,
      cellMinWidthZero,
      internalLinesVisible,
      mtable
    );
  }

  if (internalLinesVisible) {
    scheduleLinedMtdVerticalLayout(mtable, rows, mtableRowalign);
  }

  return mtable;
}

/**
 * @param {Element} mtable
 * @returns {Element}
 */
function transformMtable(mtable) {
  const nativeTable = detectNativeMtablePresentationAttrs();
  const hasMlabeledtr = Array.from(mtable.children).some(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mlabeledtr'
  );
  const needMlabeledtrDomFix = hasMlabeledtr && !detectNativeMlabeledtrSideLayout();

  if (nativeTable && !needMlabeledtrDomFix) {
    return mtable;
  }
  const c = cloneElementWithShadowRoot(mtable);
  applyMtablePresentationAttrsWithCss(c);
  return c;
}

_MathTransforms.add('mtable', transformMtable);
