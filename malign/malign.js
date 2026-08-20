// @ts-check
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
 * This module polyfills the MathML alignment elements `maligngroup` and `malignmark`
 * (MathML3 chapter 3.5.5, MathML4 3.5.5). Alignment groups let cells in a table column line
 * up on internal points (operators, `=`, decimal points, or explicit marks), not just on the
 * cell edge that `columnalign` controls.
 *
 * The algorithm is a version of what is described in https://www.w3.org/TR/MathML3/chapter3.html#id.3.5.5.10:
 *
 *   For each table column, and for each cell in that column:
 *     - collect the `maligngroup` elements (in document order) and the alignment point of each
 *       group (an explicit `malignmark`, else a decimal point for groupalign="decimalpoint",
 *       else the group edge implied by groupalign left/right/center);
 *     - measure, relative to the group's start, the width to the left of the alignment point
 *       (`leftWidth`) and to its right (`rightWidth`).
 *   Take, per group index, the maximum leftWidth and rightWidth across every row of the column.
 *   Then in each cell, widen each group's leading spacer so the group's alignment point lands at
 *   the common column-wide position; a trailing spacer pads the cell to a uniform width so the
 *   groups stay aligned no matter how `columnalign` positions the (equal-width) cells.
 *
 * Each `maligngroup` / `malignmark` is replaced by an `<mspace>` (marks stay zero width; groups
 * get the computed padding width). The surrounding `mtable`/`mtr`/`mtd` layout, including
 * `columnalign` and `columnspacing`, is left to the `mtable` polyfill (or native support).
 *
 * Registration note: `_MathTransforms` keys plugins by selector, so we cannot add a second
 * `mtable` handler without clobbering `mtable/mtable.js`. Instead this registers on `maligngroup`
 * and, on the first (still-connected) group encountered, processes that group's enclosing alignment
 * scope (its nearest `mtable`) in one pass. Import this module BEFORE `mtable/mtable.js` so
 * measurement runs on the live DOM before the `mtable` transform clones the subtree.
 */

import { _MathTransforms, MATHML_NS, forceLayout } from '../common/math-transforms.js';

/** MathML container elements whose (any) children are part of the same alignment group flow. */
const FULL_DESCEND = new Set([
  'mrow', 'mstyle', 'mpadded', 'mphantom', 'menclose', 'mfenced', 'msqrt', 'merror', 'mtd', 'math',
]);

/** Elements whose FIRST argument carries the on-baseline content (scripts, roots, semantics). */
const FIRST_ARG_ONLY = new Set([
  'msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover', 'mmultiscripts', 'mroot', 'semantics',
]);

const GROUPALIGN_VALUES = ['left', 'right', 'center', 'decimalpoint'];

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isMathElement(node) {
  return node.nodeType === 1 && /** @type {Element} */ (node).namespaceURI === MATHML_NS;
}

/**
 * MathML element children of {@code el} (skips text/comment and non-MathML nodes).
 * @param {Element} el
 * @returns {Element[]}
 */
function mathChildren(el) {
  return Array.from(el.children).filter((c) => c.namespaceURI === MATHML_NS);
}

/**
 * Collect descendants named {@code localName} within a cell in document order, WITHOUT descending
 * into a nested {@code mtable} (a nested table is its own alignment scope).
 * @param {Element} root the cell content root (an {@code mtd})
 * @param {string} localName
 * @returns {Element[]}
 */
function collectInScope(root, localName) {
  /** @type {Element[]} */
  const out = [];
  /** @param {Element} el */
  function walk(el) {
    for (const child of mathChildren(el)) {
      if (child.localName === localName) {
        out.push(child);
      }
      if (child.localName === 'mtable') {
        continue; // nested alignment scope: do not descend
      }
      walk(child);
    }
  }
  walk(root);
  return out;
}

/**
 * @param {string} token
 * @returns {string}
 */
function normGroupalign(token) {
  const t = (token || '').trim().toLowerCase();
  return GROUPALIGN_VALUES.includes(t) ? t : '';
}

/**
 * Parse a {@code group-alignment-list} such as {@code "decimalpoint left left"}.
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseGroupalignList(raw) {
  if (raw == null) return [];
  return String(raw)
    .replace(/[{}]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(normGroupalign)
    .filter(Boolean);
}

/**
 * Parse a {@code group-alignment-list-list} such as {@code "{left right} {decimalpoint left}"}.
 * When braces are omitted the whole value is treated as a single column list.
 * @param {string | null | undefined} raw
 * @returns {string[][]}
 */
function parseGroupalignListList(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  const s = String(raw).trim();
  if (s.indexOf('{') === -1) {
    const single = parseGroupalignList(s);
    return single.length ? [single] : [];
  }
  /** @type {string[][]} */
  const lists = [];
  const re = /\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const list = parseGroupalignList(m[1]);
    lists.push(list);
  }
  return lists;
}

/**
 * Pick entry {@code index} from a list, repeating the last entry for overflow.
 * @template T
 * @param {T[]} list
 * @param {number} index
 * @param {T} fallback
 * @returns {T}
 */
function pick(list, index, fallback) {
  if (!list || list.length === 0) return fallback;
  return index < list.length ? list[index] : list[list.length - 1];
}

/**
 * Resolve the effective {@code groupalign} for the {@code ordinal}-th alignment group of a cell,
 * following the inheritance path maligngroup -> mtd -> mtr -> mtable -> default "left".
 * @param {Element} maligngroup the (original) maligngroup element
 * @param {number} ordinal index of this group within its cell (0-based)
 * @param {Element} mtd
 * @param {Element | null} mtr
 * @param {Element} mtable
 * @param {number} colIndex column index of the cell
 * @returns {string}
 */
function resolveGroupalign(maligngroup, ordinal, mtd, mtr, mtable, colIndex) {
  const own = normGroupalign(maligngroup.getAttribute('groupalign') || '');
  if (own) return own;

  const mtdList = parseGroupalignList(mtd.getAttribute('groupalign'));
  if (mtdList.length) return pick(mtdList, ordinal, 'left');

  if (mtr) {
    const mtrListList = parseGroupalignListList(mtr.getAttribute('groupalign'));
    if (mtrListList.length) {
      const colList = pick(mtrListList, colIndex, mtrListList[mtrListList.length - 1]);
      if (colList && colList.length) return pick(colList, ordinal, 'left');
    }
  }

  const mtableListList = parseGroupalignListList(mtable.getAttribute('groupalign'));
  if (mtableListList.length) {
    const colList = pick(mtableListList, colIndex, mtableListList[mtableListList.length - 1]);
    if (colList && colList.length) return pick(colList, ordinal, 'left');
  }

  return 'left';
}

/**
 * The 'decimal point' character for a node: nearest ancestor {@code mstyle[decimalpoint]}, else ".".
 * @param {Element} node
 * @returns {string}
 */
function getDecimalChar(node) {
  /** @type {Element | null} */
  let el = node;
  while (el) {
    if (el.namespaceURI === MATHML_NS && el.localName === 'mstyle') {
      const dp = el.getAttribute('decimalpoint');
      if (dp) return dp;
    }
    el = el.parentElement;
  }
  return '.';
}

/**
 * Collect, in document order, the {@code mn} elements of a cell that lie on the alignment
 * "baseline" per the decimalpoint scan rules (descend rows/style/padded/phantom/enclose/fenced/
 * sqrt fully; only the first argument of scripts/root/semantics; only the selected branch of
 * maction; skip everything else and nested tables).
 * @param {Element} mtd
 * @returns {Element[]}
 */
function collectBaselineMn(mtd) {
  /** @type {Element[]} */
  const out = [];
  /** @param {Element} node */
  function scan(node) {
    const n = node.localName;
    if (n === 'mn') {
      out.push(node);
      return;
    }
    if (n === 'mtable') return;
    if (n === 'maction') {
      const sel = parseInt(node.getAttribute('selection') || '1', 10);
      const arg = mathChildren(node)[(isFinite(sel) ? sel : 1) - 1];
      if (arg) scan(arg);
      return;
    }
    if (FIRST_ARG_ONLY.has(n)) {
      const arg = mathChildren(node)[0];
      if (arg) scan(arg);
      return;
    }
    if (FULL_DESCEND.has(n)) {
      for (const child of mathChildren(node)) scan(child);
      return;
    }
    // Other elements (mfrac, mo, mi, mtext, mspace, ...): not on the alignment baseline; skip.
  }
  for (const child of mathChildren(mtd)) scan(child);
  return out;
}

/**
 * True if {@code a} precedes {@code b} in document order.
 * @param {Node} a
 * @param {Node} b
 * @returns {boolean}
 */
function precedes(a, b) {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/**
 * Create a zero-width probe/spacer {@code <mspace>}.
 * @param {Document} doc
 * @returns {Element}
 */
function newSpacer(doc) {
  const sp = doc.createElementNS(MATHML_NS, 'mspace');
  sp.setAttribute('width', '0px');
  return sp;
}

/**
 * The first non-whitespace-only sibling node in {@code dir} ("prev"|"next") from {@code node}.
 * @param {Node} node
 * @param {"prev" | "next"} dir
 * @returns {Node | null}
 */
function adjacentMeaningful(node, dir) {
  let sib = dir === 'prev' ? node.previousSibling : node.nextSibling;
  while (sib) {
    if (sib.nodeType === 3) {
      if ((sib.nodeValue || '').trim() !== '') return sib; // text with content
    } else if (sib.nodeType === 1) {
      return sib;
    }
    sib = dir === 'prev' ? sib.previousSibling : sib.nextSibling;
  }
  return null;
}

/**
 * Right-edge x of the last character in a text node.
 * @param {Text} textNode
 * @returns {number}
 */
function textRightX(textNode) {
  const range = textNode.ownerDocument.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, (textNode.nodeValue || '').length);
  return range.getBoundingClientRect().right;
}

/**
 * Left-edge x of the first character in a text node.
 * @param {Text} textNode
 * @returns {number}
 */
function textLeftX(textNode) {
  const range = textNode.ownerDocument.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 0);
  return range.getBoundingClientRect().left;
}

/**
 * @typedef {Object} GroupInfo
 * @property {Element} spacer   the mspace that replaced the maligngroup (group start marker)
 * @property {string}  align    resolved groupalign (left|right|center|decimalpoint)
 * @property {Element | null} markSpacer  the mspace that replaced the group's first malignmark, if any
 * @property {string}  markEdge left|right (edge of the mark)
 * @property {number}  leftWidth  measured width left of the alignment point (px)
 * @property {number}  rightWidth measured width right of the alignment point (px)
 */

/**
 * @typedef {Object} CellInfo
 * @property {Element} mtd
 * @property {number}  col
 * @property {GroupInfo[]} groups
 */

/**
 * Build the list of {@code mtr} rows and, for each, its {@code mtd} cells with a sequential column
 * index. Column/row spans are not modeled for alignment (spanning cells are excluded);
 * sequential indexing matches typical alignment tables.
 * @param {Element} mtable
 * @returns {{ mtr: Element, mtd: Element, col: number }[]}
 */
function listCells(mtable) {
  /** @type {{ mtr: Element, mtd: Element, col: number }[]} */
  const cells = [];
  const rows = mathChildren(mtable).filter(
    (n) => n.localName === 'mtr' || n.localName === 'mlabeledtr'
  );
  for (const mtr of rows) {
    let col = 0;
    for (const mtd of mathChildren(mtr)) {
      if (mtd.localName !== 'mtd') continue; // e.g. mlabeledtr label mtd still counts as a cell
      cells.push({ mtr, mtd, col });
      col += 1;
    }
  }
  return cells;
}

/**
 * Phase 1: for every cell that contains in-scope alignment groups, resolve each group's align type,
 * assign marks to groups (first mark wins), and replace the maligngroup/malignmark elements with
 * mspace probes. Returns per-cell info (only cells that actually have groups).
 * @param {Element} mtable
 * @returns {CellInfo[]}
 */
function collectAndProbe(mtable) {
  const doc = mtable.ownerDocument;
  /** @type {CellInfo[]} */
  const cellInfos = [];

  for (const { mtr, mtd, col } of listCells(mtable)) {
    const groupEls = collectInScope(mtd, 'maligngroup');
    if (groupEls.length === 0) continue;
    const markEls = collectInScope(mtd, 'malignmark');

    // Assign each mark to the group it belongs to (last preceding maligngroup); first mark wins.
    /** @type {{ el: Element, edge: string }[]} */
    const markForGroup = new Array(groupEls.length).fill(null);
    for (const mark of markEls) {
      let gi = -1;
      for (let i = 0; i < groupEls.length; i++) {
        if (precedes(groupEls[i], mark)) gi = i;
        else break;
      }
      if (gi >= 0 && markForGroup[gi] == null) {
        const edge = (mark.getAttribute('edge') || 'left').trim().toLowerCase();
        markForGroup[gi] = { el: mark, edge: edge === 'right' ? 'right' : 'left' };
      }
    }

    /** @type {GroupInfo[]} */
    const groups = [];
    for (let i = 0; i < groupEls.length; i++) {
      const align = resolveGroupalign(groupEls[i], i, mtd, mtr, mtable, col);
      const mark = markForGroup[i];
      const spacer = newSpacer(doc);
      const markSpacer = mark ? newSpacer(doc) : null;
      groups.push({
        spacer,
        align,
        markSpacer,
        markEdge: mark ? mark.edge : 'left',
        leftWidth: 0,
        rightWidth: 0,
      });
    }

    // Replace marks first (they may be nested inside group content), then the group markers.
    for (let i = 0; i < groupEls.length; i++) {
      const mark = markForGroup[i];
      const markSpacer = groups[i].markSpacer;
      if (mark && markSpacer && mark.el.parentNode) {
        mark.el.parentNode.replaceChild(markSpacer, mark.el);
      }
    }
    for (let i = 0; i < groupEls.length; i++) {
      const parent = groupEls[i].parentNode;
      if (parent) parent.replaceChild(groups[i].spacer, groupEls[i]);
    }

    cellInfos.push({ mtd, col, groups });
  }

  return cellInfos;
}

/**
 * Phase 2: measure each group's leftWidth/rightWidth (relative to the group start) in the current
 * layout. Requires the probes to be in the live, laid-out document.
 * @param {CellInfo[]} cellInfos
 * @returns {void}
 */
function measureGroups(cellInfos) {
  for (const cell of cellInfos) {
    const { mtd, groups } = cell;

    // Right edge of the whole cell content (end of the last group).
    const contentRange = mtd.ownerDocument.createRange();
    contentRange.selectNodeContents(mtd);
    const contentRight = contentRange.getBoundingClientRect().right;

    // mn elements available for decimalpoint alignment in this cell.
    const baselineMn = collectBaselineMn(mtd);

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const startX = g.spacer.getBoundingClientRect().left;
      const endX =
        i + 1 < groups.length
          ? groups[i + 1].spacer.getBoundingClientRect().left
          : contentRight;
      const fullWidth = Math.max(0, endX - startX);

      let pointX;
      if (g.markSpacer) {
        pointX = markPointX(g.markSpacer, g.markEdge, startX, endX);
      } else if (g.align === 'left') {
        pointX = startX;
      } else if (g.align === 'right') {
        pointX = endX;
      } else if (g.align === 'center') {
        pointX = (startX + endX) / 2;
      } else {
        // decimalpoint
        pointX = decimalPointX(g.spacer, i + 1 < groups.length ? groups[i + 1].spacer : null, baselineMn, endX);
      }

      let leftWidth = pointX - startX;
      if (leftWidth < 0) leftWidth = 0;
      if (leftWidth > fullWidth) leftWidth = fullWidth;
      g.leftWidth = leftWidth;
      g.rightWidth = fullWidth - leftWidth;
    }
  }
}

/**
 * x-position of a mark's alignment point.
 * @param {Element} markSpacer
 * @param {string} edge left|right
 * @param {number} startX group start (fallback)
 * @param {number} endX group end (fallback)
 * @returns {number}
 */
function markPointX(markSpacer, edge, startX, endX) {
  if (edge === 'right') {
    const prev = adjacentMeaningful(markSpacer, 'prev');
    if (prev) {
      if (prev.nodeType === 3) return textRightX(/** @type {Text} */ (prev));
      return /** @type {Element} */ (prev).getBoundingClientRect().right;
    }
    return markSpacer.getBoundingClientRect().left;
  }
  const next = adjacentMeaningful(markSpacer, 'next');
  if (next) {
    if (next.nodeType === 3) return textLeftX(/** @type {Text} */ (next));
    return /** @type {Element} */ (next).getBoundingClientRect().left;
  }
  return markSpacer.getBoundingClientRect().left;
}

/**
 * x-position of the decimal-point alignment point: right edge of the character before the first
 * decimal point in the first baseline {@code mn} of the group. Falls back to the group's right edge.
 * @param {Element} startSpacer this group's start marker
 * @param {Element | null} nextSpacer next group's start marker (null for the last group)
 * @param {Element[]} baselineMn baseline mn elements of the cell
 * @param {number} endX group end (fallback)
 * @returns {number}
 */
function decimalPointX(startSpacer, nextSpacer, baselineMn, endX) {
  /** @type {Element | null} */
  let mn = null;
  for (const cand of baselineMn) {
    if (!precedes(startSpacer, cand)) continue;
    if (nextSpacer && !precedes(cand, nextSpacer)) continue;
    mn = cand;
    break;
  }
  if (!mn) return endX; // no number: behave like groupalign="right"

  const textNode = /** @type {Text | undefined} */ (
    Array.from(mn.childNodes).find((n) => n.nodeType === 3 && (n.nodeValue || '').trim() !== '')
  );
  if (!textNode) return mn.getBoundingClientRect().right;

  const decChar = getDecimalChar(mn);
  const data = textNode.nodeValue || '';
  const idx = data.indexOf(decChar);
  const range = textNode.ownerDocument.createRange();
  if (idx < 0) {
    // No decimal point: right edge of the last character.
    return mn.getBoundingClientRect().right;
  }
  // Right edge of the character before the decimal point (idx === 0 -> left edge of content).
  range.setStart(textNode, 0);
  range.setEnd(textNode, idx);
  const r = range.getBoundingClientRect();
  return idx === 0 ? r.left : r.right;
}

/**
 * Phase 3: compute per-column, per-group-index maxima of leftWidth/rightWidth.
 * @param {CellInfo[]} cellInfos
 * @returns {Map<number, { leftMax: number[], rightMax: number[] }>}
 */
function computeColumnMaxima(cellInfos) {
  /** @type {Map<number, { leftMax: number[], rightMax: number[] }>} */
  const byCol = new Map();
  for (const cell of cellInfos) {
    let entry = byCol.get(cell.col);
    if (!entry) {
      entry = { leftMax: [], rightMax: [] };
      byCol.set(cell.col, entry);
    }
    for (let i = 0; i < cell.groups.length; i++) {
      const g = cell.groups[i];
      if (i >= entry.leftMax.length) {
        entry.leftMax.push(g.leftWidth);
        entry.rightMax.push(g.rightWidth);
      } else {
        entry.leftMax[i] = Math.max(entry.leftMax[i], g.leftWidth);
        entry.rightMax[i] = Math.max(entry.rightMax[i], g.rightWidth);
      }
    }
  }
  return byCol;
}

/**
 * Phase 4 (port of {@code SetAlignGroupWidth}): widen each group's leading spacer so its alignment
 * point lands at the column-wide position, then append a trailing spacer so every cell in the
 * column ends up the same width (keeps groups aligned under any {@code columnalign}).
 * @param {CellInfo[]} cellInfos
 * @param {Map<number, { leftMax: number[], rightMax: number[] }>} byCol
 * @returns {void}
 */
function applySpacerWidths(cellInfos, byCol) {
  for (const cell of cellInfos) {
    const entry = byCol.get(cell.col);
    if (!entry) continue;
    let prevRightExcess = 0;
    for (let i = 0; i < cell.groups.length; i++) {
      const g = cell.groups[i];
      const leftMax = entry.leftMax[i] || 0;
      const rightMax = entry.rightMax[i] || 0;
      const width = Math.max(0, prevRightExcess + (leftMax - g.leftWidth));
      setSpacerWidth(g.spacer, width);
      prevRightExcess = Math.max(0, rightMax - g.rightWidth);
    }
    if (prevRightExcess > 0.01) {
      const trailing = newSpacer(cell.mtd.ownerDocument);
      setSpacerWidth(trailing, prevRightExcess);
      cell.mtd.appendChild(trailing);
    }
  }
}

/**
 * @param {Element} spacer
 * @param {number} px
 * @returns {void}
 */
function setSpacerWidth(spacer, px) {
  spacer.setAttribute('width', `${px.toFixed(3)}px`);
}

/**
 * Process one {@code mtable}'s alignment groups in place.
 * @param {Element} mtable
 * @returns {void}
 */
function processAlignmentGroups(mtable) {
  const cellInfos = collectAndProbe(mtable);
  if (cellInfos.length === 0) return;
  forceLayout(mtable);
  measureGroups(cellInfos);
  const byCol = computeColumnMaxima(cellInfos);
  applySpacerWidths(cellInfos, byCol);
}

/**
 * Transform entry point, registered on {@code maligngroup}. Processes the group's enclosing
 * {@code mtable} (alignment scope) once, in place; later groups in the same scope are already
 * detached (replaced by spacers) and are skipped. Returns {@code null} so the framework does not
 * replace anything; the {@code mtable} polyfill then handles column layout.
 * @param {Element} maligngroup
 * @returns {null}
 */
function transformMalign(maligngroup) {
  if (!maligngroup.isConnected) return null; // already handled as part of its scope
  const mtable = maligngroup.closest('mtable');
  if (!mtable) return null; // not inside a table: no alignment scope
  try {
    processAlignmentGroups(mtable);
  } catch (e) {
    // Alignment is a best-effort enhancement; never break the surrounding table.
    console.warn('malign polyfill: skipped an mtable due to', e);
  }
  return null;
}

_MathTransforms.add('maligngroup', transformMalign);
