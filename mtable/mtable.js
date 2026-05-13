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
 * so dashed rules span the table). `columnlines` use `border-left` on `mtd`. When internal grid
 * lines are visible, row grids use `align-items: stretch`. Cells use `justify-self`/`align-self:
 * stretch` plus flex (`justify-content` / `align-items`) for `columnalign`/`rowalign` inside the
 * cell (MathML often ignores `text-align` on `mtd`). Without column `subgrid`, each row uses
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
 * Cell alignment follows MathML defaults (`rowalign` baseline, `columnalign` center) using
 * `align-items` / `justify-items` on the row grid, with per-cell `align-self` / `justify-self`
 * / `text-align` when needed. `rowalign="axis"` matches baseline alignment of the row grid plus a downward
 * shift by the math axis height (measured from an `mo` with U+2212, with `ex` fallback) so axis
 * rows sit lower than baseline rows,
 * per MathML baseline vs axis semantics. Multi-child `mtd`s get an explicit `<mrow>`
 * wrapper around their inferred-row contents so engines that drop the implicit row inside a
 * grid container still lay the children out horizontally. A one-time probe compares the width
 * of a tiny native `mtable` with `columnspacing="0em"` vs `"3em"`; if the engine already
 * honors spacing, no transform runs and native layout is left in place.
 */

/**
 * CSS-based presentation for MathML 4 {@code mtable} attributes (see
 * <a href="https://www.w3.org/TR/mathml4/#presm_tabmat">MathML 4 §3.5</a>),
 * compatible with MathML Core. When the engine already honors attributes such as
 * {@code columnspacing} (detected via a small probe), the polyfill leaves the tree unchanged.
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
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseSpaceList(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw)
    .trim()
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
 * Whether the user agent appears to honor MathML {@code mtable} presentation attributes in layout
 * (detected with a 1×2 {@code columnspacing} probe). Test pages can show this before running transforms.
 * @returns {boolean}
 */
export function getNativeMtablePresentationAttrsSupport() {
  return detectNativeMtablePresentationAttrs();
}

/**
 * @param {string} rowalign
 * @returns {string}
 */
function rowalignToAlignSelf(rowalign) {
  const v = normalizeEnum(rowalign, ROWALIGN_VALUES, 'baseline');
  if (v === 'top') return 'start';
  if (v === 'bottom') return 'end';
  if (v === 'center') return 'center';
  return 'baseline';
}

/**
 * Effective MathML {@code rowalign} for one cell: {@code mtable} list (one entry per row, last
 * repeated), then {@code mtr} list (one entry per column in that row, last repeated), then {@code mtd}.
 * @param {Element} mtd
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {string[]} mtableRowalign
 * @param {Element | null} mtr
 * @returns {string}
 */
function resolveEffectiveRowalign(mtd, rowIndex, colIndex, mtableRowalign, mtr) {
  let ra = pickListEntry(mtableRowalign, rowIndex, 'baseline');
  if (mtr) {
    const mtrRaList = parseSpaceList(mtr.getAttribute('rowalign'));
    if (mtrRaList.length) {
      ra = normalizeEnum(
        pickListEntry(mtrRaList, colIndex, ra),
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
 * {@code justify-content} on a flex {@code mtd} when stretched for grid lines (MathML often ignores
 * {@code text-align} on {@code mtd}).
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
 * {@code align-items} for {@code display: flex; flex-direction: row} on a stretched {@code mtd}.
 * @param {string} rowalign
 * @returns {string}
 */
function rowalignToFlexAlignItems(rowalign) {
  const v = normalizeEnum(rowalign, ROWALIGN_VALUES, 'baseline');
  if (v === 'top') return 'flex-start';
  if (v === 'bottom') return 'flex-end';
  if (v === 'center') return 'center';
  return 'baseline';
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
 * @param {Element} mtd
 * @returns {void}
 */
function wrapMtdInferredMrow(mtd) {
  const elementKids = Array.from(mtd.children);
  if (elementKids.length < 2) return;
  const doc = mtd.ownerDocument;
  if (!doc) return;
  const mrow = doc.createElementNS(MATHML_NS, 'mrow');
  while (mtd.firstChild) {
    mrow.appendChild(mtd.firstChild);
  }
  mtd.appendChild(mrow);
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
 * {@code border-top} on each {@code mtr} after the first, and {@code columnlines} as
 * {@code border-left} on {@code mtd} from the second column onward. When {@code internalLinesVisible}
 * is true and there is no frame, each {@code mtr} gets {@code min-width: 100%}. When there is a frame,
 * rows use negative margins equal to {@code framespacing} and {@code width: calc(100% + …)} so internal
 * rules meet the inner edge of the frame border (the grid extends into the padding band). Last-row
 * cells get extra {@code padding-bottom} so vertical column borders reach the bottom padding edge.
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
  if (frameCss) appendInlineStyle(mtable, frameCss);

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
    if (rl !== 'none') {
      appendInlineStyle(
        rows[i],
        `border-top: 0.067em ${rl} currentColor; box-sizing: border-box;`
      );
    }
  }

  for (const p of placed) {
    const { mtd, col } = p;
    if (col <= 0) continue;
    const cl = pickListEntry(columnlines, col - 1, 'none');
    if (cl === 'none') continue;
    appendInlineStyle(
      mtd,
      `border-left: 0.067em ${cl} currentColor; box-sizing: border-box;`
    );
  }

  if (internalLinesVisible && frameStyle !== 'none' && rows.length > 0) {
    const lastR = rows.length - 1;
    for (const p of placed) {
      if (p.row === lastR) {
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
 * Each {@code mtr} row grid uses {@code align-items: stretch} when internal grid lines are visible,
 * otherwise {@code first baseline}.
 * Each {@code mtd} gets {@code justify-self} from {@code columnalign} (including default {@code center}) and matching
 * {@code text-align} so content centers inside column tracks, and {@code align-self}
 * for vertical placement ({@code baseline} / {@code axis} use {@code align-self: baseline}; {@code axis}
 * also gets a composed {@code margin-top} (or {@code padding-top} when internal grid lines are
 * visible) with row spacing using the U+2212 axis-height probe, or an {@code ex} fallback).
 * When internal grid lines are visible, {@code justify-self: stretch} and {@code align-self: stretch}
 * keep column borders continuous; {@code display: flex} with {@code justify-content} /
 * {@code align-items} maps {@code columnalign} / {@code rowalign} (MathML ignores {@code text-align} on
 * many {@code mtd} implementations). {@link readMtableAlignLists} supplies {@code ['baseline']} /
 * {@code ['center']} when {@code mtable} omits those attributes.
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
 * @param {boolean} internalLinesVisible When true, stretch cells for grid lines and use flex for
 *   {@code columnalign}/{@code rowalign} inside the cell.
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
  internalLinesVisible
) {
  const ra = resolveEffectiveRowalign(mtd, rowIndex, colIndex, mtableRowalign, mtr);
  let ca = pickListEntry(mtableColumnalign, colIndex, 'center');
  if (mtr) {
    const mtrCaList = parseSpaceList(mtr.getAttribute('columnalign'));
    if (mtrCaList.length) {
      ca = normalizeEnum(pickListEntry(mtrCaList, colIndex, ca), COLUMNALIGN_VALUES, ca);
    }
  }
  const mtdCaRaw = mtd.getAttribute('columnalign');
  if (mtdCaRaw != null && String(mtdCaRaw).trim() !== '') {
    const mtdCaList = parseSpaceList(mtdCaRaw);
    if (mtdCaList.length) {
      ca = normalizeEnum(pickListEntry(mtdCaList, 0, ca), COLUMNALIGN_VALUES, ca);
    }
  }
  ca = normalizeEnum(ca, COLUMNALIGN_VALUES, 'center');
  const parts = [];
  if (cellMinWidthZero) {
    parts.push('min-width: 0');
  }
  if (internalLinesVisible) {
    parts.push('justify-self: stretch');
    parts.push('align-self: stretch');
    parts.push('display: flex');
    parts.push('flex-direction: row');
    parts.push('width: 100%');
    parts.push('height: 100%');
    parts.push('box-sizing: border-box');
    parts.push(`justify-content: ${columnalignToJustifyContent(ca)}`);
    parts.push(`align-items: ${rowalignToFlexAlignItems(ra)}`);
  } else {
    parts.push(`justify-self: ${columnalignToJustifySelf(ca)}`);
    if (ra === 'top' || ra === 'bottom' || ra === 'center') {
      parts.push(`align-self: ${rowalignToAlignSelf(ra)}`);
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

/**
 * Apply MathML 4 table presentation attributes using CSS on {@code mtable}, {@code mtr}, and {@code mtd}.
 * Per-gap {@code rowspacing} / {@code columnspacing} use cell margins (grid row-gap/column-gap are uniform).
 * @param {Element} mtable
 * @returns {Element}
 */
export function applyMtablePresentationAttrsWithCss(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return mtable;
  }
  if (detectNativeMtablePresentationAttrs()) {
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
  const mtrAlignItems = internalLinesVisible ? 'stretch' : 'first baseline';
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
      appendInlineStyle(
        rows[i],
        `display: grid; grid-column: 1 / -1; grid-row: ${
          i + 1
        }; grid-template-columns: subgrid; grid-template-rows: auto; justify-items: stretch; align-items: ${mtrAlignItems};`
      );
    }
  } else {
    appendInlineStyle(
      mtable,
      `display: inline-grid; vertical-align: baseline; grid-template-columns: minmax(0, auto); grid-template-rows: ${gridRows}; row-gap: 0; column-gap: 0;`
    );
    for (let i = 0; i < rows.length; i++) {
      appendInlineStyle(
        rows[i],
        `display: grid; grid-template-columns: ${gridColsPerMtr}; grid-column: 1 / -1; grid-row: ${
          i + 1
        }; justify-items: stretch; align-items: ${mtrAlignItems};`
      );
    }
  }

  let axisShiftCss = `${convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX)}px`;
  if (
    placed.some((p) => {
      const mtr = rows[p.row] ?? null;
      return resolveEffectiveRowalign(p.mtd, p.row, p.col, mtableRowalign, mtr) === 'axis';
    })
  ) {
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    if (ax != null && ax > 0) axisShiftCss = `${ax}px`;
  }

  for (const p of placed) {
    const mtr = rows[p.row] ?? null;
    const ra = resolveEffectiveRowalign(p.mtd, p.row, p.col, mtableRowalign, mtr);
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
    const colWidthTok = normToken(pickListEntry(columnwidthList, p.col, 'auto'));
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
      internalLinesVisible
    );
  }

  return mtable;
}

/**
 * @param {Element} mtable
 * @returns {Element}
 */
function transformMtable(mtable) {
  if (detectNativeMtablePresentationAttrs()) {
    return mtable;
  }
  const c = cloneElementWithShadowRoot(mtable);
  applyMtablePresentationAttrsWithCss(c);
  return c;
}

_MathTransforms.add('mtable', transformMtable);
