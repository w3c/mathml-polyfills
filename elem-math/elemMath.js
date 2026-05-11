// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/*
  Copyright (c) 2020 Neil Soiffer, Talking Cat Software

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
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

/**
 * Elementary MathML: {@link https://w3c.github.io/mathml/#stacks-of-characters-mstack mstack} and
 * {@link https://w3c.github.io/mathml/#elementary-math-subtraction-addition-multiplication-and-long-division mlongdiv}.
 *
 * Each digit occupies one column in an internal row model; after layout, that model is rendered as a CSS grid
 * (see {@link ELEM_MATH_CSS}) with HTML cell elements, typically inside a shadow root.
 *
 * @module elem-math/elemMath
 */

import { _MathTransforms, MATHML_NS } from '../common/math-transforms.js'

/** Uppercase `tagName` for the `m-elem-math` custom element. */
const M_ELEM_MATH_TAG = 'M-ELEM-MATH';

/** CSS for the grid container (`.elem-math`) and cells; concatenated into the global polyfill stylesheet. */
const ELEM_MATH_CSS = `
div.elem-math {
    display: inline-grid;
    grid-auto-flow: row;
    /* Use baseline so plain-digit cells line up with merged-carry cells whose digit sits below the carry. */
    align-items: baseline;
    grid-auto-columns: max-content;
    gap: 0;
}

.elem-math-cell {
    display: inline-block;
    /* IMPORTANT: do not set 'align-self: stretch' on every cell -- that overrides 'align-items: baseline'
       from the grid. Exception: cells that only draw a vertical rule (border-left/right) must stretch to
       the row height so the rule meets rows where neighbors use border-bottom (msline); otherwise the
       rule ends short by the border-bottom width. */
    position: relative;
    overflow: visible;
}

.elem-math-cell.elem-math-vrule-cell {
    align-self: stretch;
    box-sizing: border-box;
}

/* Empty rows added after underlines need explicit height (no content to give them one). */
.elem-math-spacer {
    align-self: stretch;
    height: .5ex;
}

/* Curved bracket: absolutely positioned child so placement is relative to the cell box, not the grid item. */
.elem-math-cell .curved-line {
    position: absolute;
    top: 0;
    left: 0;
    padding-top: 0em;
    width: 0.75em;
    border: 0.3ex solid;  /* match border bottom */
    transform: translate(0.48em, -0.15em);
    border-radius: 70%;
    clip-path: inset(0.1em 0 0 0.45em);
    box-sizing: border-box;
    margin-left: -0.85em;
    margin-right: 0.75em;
}

/* .precedes-separator / .separator / .follows-separator: horizontal padding set in JS (expandMStackElement). */

.carry {
    font-size: 60%;
    line-height: 90%;
    width: 1px;
    overflow: visible;
}

.hidden-digit {
    visibility: hidden;
}

.crossout-horiz, .crossout-vert, .crossout-up, .crossout-down{
    position: relative;
    display: inline-block;
}
.crossout-horiz:before {
    content: '';
    border-bottom: .3ex solid black;
    width: 140%;
    position: absolute;
    right: -20%;
    top: 40%;
}

.crossout-vert::before {
    content: '';
    border-left: .3ex solid black;
    height: 100%;
    position: absolute;
    right: 35%;
    top: 0%;
}

.crossout-up::before {
    content: '';
    width: 100%;
    position: absolute;
    right: 0;
    top: 40%;
}
.crossout-up::before {
    border-bottom: .2em solid black;
    transform: skewY(-60deg);
}

.crossout-down::after {
    content: '';
    width: 100%;
    position: absolute;
    right: 0;
    top: 40%;
}
.crossout-down::after {
    border-bottom: .2em solid black;
    transform: skewY(60deg);
}
`

/** `msline` / `mslinethickness="thin"` resolved length. */
const MSLINETHICKNESS_THIN = '.1ex'
/** Default `mslinethickness="medium"`. */
const MSLINETHICKNESS_MEDIUM = '.35ex'
/** `mslinethickness="thick"`. */
const MSLINETHICKNESS_THICK = '.65ex'

/** `charspacing="tight"` on `mstack` / `mlongdiv`. */
const MSTACK_TIGHT = '0em'
/** `charspacing="medium"` (default). */
const MSTACK_MEDIUM = '.2em'
/** `charspacing="loose"`. */
const MSTACK_LOOSE = '.4em'

const NON_BREAKING_SPACE = '\u00A0'
/** Hair space (U+200A); placeholder in padded / empty cells so columns and borders lay out consistently. */
const NO_SPACE = '\u200A'

/**
 * Inherited MathML attributes gathered from ancestor `mstyle` and `math` (first wins per name).
 */
class MathMLAttrs {
    /**
     * @param {Element} el - Starting node (`mstack`, `mlongdiv`, or `mstyle` when merging).
     * @param {Record<string, string>} [previousAttrs] - Copy-on-write base when `el` is `mstyle`.
     */
    constructor(el, previousAttrs) {
        this.attrs = {};
        if (!previousAttrs) {
            while (el && el.tagName.toLowerCase() !== 'math') {
                if (el.tagName.toLowerCase() === 'mstyle') {
                    this.addAttrs(el);
                }
                el = el.parentElement;
            }
            if (el && el.tagName.toLowerCase() === 'math') {
                this.addAttrs(el);
            }
        } else {
            this.attrs = Object.assign({}, previousAttrs);
            if (el.tagName.toLowerCase() === 'mstyle') {
                for (let attr of el.attributes) {
                    this.attrs[attr.name] = attr.value;
                }
            }
        }
    }

    /**
     * Records attributes from `el` only for names not already in `this.attrs`.
     * @param {Element} el
     */
    addAttrs(el) {
        for (let attr of el.attributes) {
            if (!this.attrs[attr.name]) {
                this.attrs[attr.name] = attr.value;
            }
        }
    }

    /**
     * @param {Element} el
     * @param {string} name
     * @param {string} defaultVal
     * @returns {string}
     */
    getAttr(el, name, defaultVal) {
        if (el.hasAttribute(name)) {
            return el.getAttribute(name);
        }
        return this.attrs[name] ? this.attrs[name] : defaultVal;
    }
}

/** Metadata for one `mscarry` merged into a digit cell. */
class Carry {
    /**
     * @param {string} location - `mscarry` `location` (e.g. `n`, `nw`, `s`).
     * @param {string} crossout - `crossout` token(s).
     * @param {number} scriptsizemultiplier - Percent scale for carry glyph (e.g. 60).
     */
    constructor(location, crossout, scriptsizemultiplier) {
        this.location = location;
        this.crossout = crossout;
        this.scriptsizemultiplier = scriptsizemultiplier
    }
}

/**
 * One column cell in the internal grid (digit, padding, carry wrapper, etc.).
 */
class TableCell {
    /**
     * @param {string | Element} value - Digit string, or element for `mscarry`.
     * @param {string} [style=''] - Extra inline CSS for the rendered cell.
     * @param {Carry} [carry] - If set, `value` must be an `Element`.
     */
    constructor(value, style, carry) {
        if (carry) {
            if (typeof value !== "object") {
                throw new Error("Elementary math mscarry isn't an 'object'");
            }
            this.data = document.createElement((carry.location === 'n' || carry.location === 's') ? 'div' : 'span');
            this.data.appendChild(value);
            this.data.className = 'carry';
            this.data.style.fontSize = Math.round(carry.scriptsizemultiplier).toString() + '%';
        } else {
            if (typeof value !== "string") {
                throw new Error("Elementary math mscarry isn't a 'string'");
            }
            // `<none/>` in `msrow` yields `''`; empty text collapses line height and breaks row `border-bottom` alignment.
            this.data = document.createTextNode(value === '' ? NO_SPACE : value);
        }
        /** @type {Carry | undefined} */
        this.carry = carry;
        this.style = style || '';
    }
}

/**
 * One row of {@link TableCell}s after `msgroup` / `position` shifts are applied.
 */
class TableRow {
    /**
     * @param {TableCell[]} data - Cells left-to-right.
     * @param {number} [digitsOnRight] - Cells right of decimal align point (includes `.`), for `stackalign="decimalpoint"`.
     * @param {number} [shift] - `msgroup` / `position` shift; negative pads left and adjusts `nRight`.
     */
    constructor(data, digitsOnRight, shift) {
        if (shift === 0) {
            this.data = data; 
        } else if (shift > 0) {
            this.data = this.padOnRight(data, shift);
        } else if (shift < 0) {
            this.data = this.padOnLeft(data, -shift);
            digitsOnRight -= shift;
        }
        this.nRight = digitsOnRight;
        this.shift = shift;
        this.style = '';
        /** Insert a spacer grid row after this one (e.g. after `msline` underline). */
        this.addSpacingAfterRow = false;
        /** Carry merge hint: `1` first line, `-1` last line, `0` none. */
        this.alignAt = 0;
    }

    /**
     * Full-width `border-bottom` on this row (e.g. `msline` with default length).
     * @param {string} lineUnderThickness - CSS border width (e.g. `.35ex`).
     * @param {string} color - `mathcolor` / resolved color.
     */
    addUnderline(lineUnderThickness, color) {
        this.style += `border-bottom: ${lineUnderThickness} solid ${color};`;
        this.addSpacingAfterRow = true;
    }

    /**
     * Underline a run of cells with `border-bottom` (finite `msline length`).
     * @param {number} shift - Column index offset (`msline` / `position`).
     * @param {number} length - Number of cells to underline.
     * @param {string} thickness - CSS border width.
     * @param {string} color - Border color.
     */
    addUnderlineToCells(shift, length, thickness, color) {
        let nLeftOfDecimalPoint = this.data.length - this.nRight;
        let right = nLeftOfDecimalPoint - shift;
        if (shift + length > nLeftOfDecimalPoint) {
            this.data = this.padOnLeft(this.data, shift + length - nLeftOfDecimalPoint);
            right = length;
        }
        if (shift < -this.nRight) {
            this.data = this.padOnRight(this.data, this.nRight - shift);
            this.nRight -= shift;
            right = this.data.length;
        }

        for (let i = right - length; i < right; i++) {
            this.data[i].style += `border-bottom: ${thickness} solid ${color};`;
        }
        this.addSpacingAfterRow = true;
    }

    /**
     * @param {TableCell[]} arr
     * @param {number} amount
     * @returns {TableCell[]}
     */
    padOnLeft(arr, amount) {
        let newCells = Array(amount);
        for (let i = 0; i < amount; i++) {
            newCells[i] = new TableCell(NO_SPACE);
        }
        return newCells.concat(arr);
    }
    
    /**
     * @param {TableCell[]} arr
     * @param {number} amount
     * @returns {TableCell[]}
     */
    padOnRight(arr, amount) {
        let newCells = Array(amount);
        for (let i = 0; i < amount; i++) {
            newCells[i] = new TableCell(NO_SPACE);
        }
        return arr.concat(newCells);
     }
}


/**
 * Expands one `mstack` or `mlongdiv` into a grid DOM. Rows are not stored on the instance; methods take {@link TableRow} arrays.
 */
class ElemMath {
    /**
     * @param {Element} mstackOrLongDiv - `mstack` or `mlongdiv` element.
     */
	constructor(mstackOrLongDiv) {
        this.stack = mstackOrLongDiv;
        this.attrs = new MathMLAttrs(mstackOrLongDiv);

        this.stackAlign = this.getAttr(mstackOrLongDiv, 'stackalign', 'decimalpoint');
        this.charAlign = this.getAttr(mstackOrLongDiv, 'charalign', 'right');
        this.charSpacing = this.getAttr(mstackOrLongDiv, 'charspacing', 'medium');
        if (this.charSpacing === 'loose') {
            this.charSpacing = MSTACK_LOOSE;
        } else if (this.charSpacing === 'medium') {
            this.charSpacing = MSTACK_MEDIUM;
        } else if (this.charSpacing === 'tight') {
            this.charSpacing = MSTACK_TIGHT;
        }

        this.longdivstyle = mstackOrLongDiv.tagName === 'mstack' ? '' : this.getAttr(mstackOrLongDiv, 'longdivstyle', 'lefttop');

        // FIX: todo -- not yet dealt with
        /* `align` on mstack is not implemented (source reads typo `algin`). */
        this.align = this.getAttr(mstackOrLongDiv,'algin', 'baseline');
    }

    /**
     * @param {Element} el
     * @param {string} name
     * @param {string} defaultVal
     * @returns {string}
     */
    getAttr(el, name, defaultVal) {
        return this.attrs.getAttr(el, name, defaultVal);
    }
    
    /**
     * Appends `newRow`, or merges it into the previous row when that row is `mscarries`.
     * @param {TableRow[]} rows
     * @param {TableRow} newRow
     * @returns {void}
     */
    add(rows, newRow) {
        /**
         * @param {TableCell} cell
         * @param {string} crossoutStyle - Space-separated `crossout` tokens.
         * @returns {TableCell}
         */
        function addCrossoutToData(cell, crossoutStyle) {
            const crossouts = crossoutStyle.split(' ');
            let result = cell.data;
            crossouts.forEach( function(crossout) {
                if (crossout === 'none' || crossout==='') {
                    return;
                }
                let span = document.createElement("span");
                span.appendChild(result);

                switch (crossout) {
                    case 'updiagonalstrike':
                        span.className = 'crossout-up';
                       break;
                    case 'downdiagonalstrike':
                        span.className = 'crossout-down';
                        break;
                    case 'verticalstrike':
                        span.className = 'crossout-vert';
                        break;
                    case 'horizontalstrike':
                        span.className = 'crossout-horiz';
                        break;
                    default:
                        span.className = 'crossout-up';
                        console.log(`Unknown crossout type '${crossoutStyle}`);
                        break;               
                }
                result = span;
            } );
            cell.data = result;
            return cell;
        }
        /**
         * @param {TableCell} cell
         * @param {TableCell} previousCell
         * @returns {TableCell}
         */
        function mergeCarryAndData(cell, previousCell) {
            let data = cell.data;
            if (data.textContent === NO_SPACE) {
                let span = document.createElement('span');
                span.appendChild(data);
                data.textContent = '0';
                span.className = "hidden-digit";
                data = span;
            }
            let parent = document.createElement('span');
            parent.appendChild(data);
            switch (previousCell.carry.location) {
                case 'n':
                case 'w':
                    parent.prepend(previousCell.data);
                    break;
                case 'nw': {
                    let newElement = document.createElement('sup');
                    newElement.appendChild(previousCell.data);
                    parent.prepend(newElement);
                    break;
                }
                case 'ne': {
                    let newElement = document.createElement('sup');
                    newElement.appendChild(previousCell.data);
                    parent.appendChild(newElement);
                    break;
                }
                case 'e':
                case 's':
                    parent.appendChild(previousCell.data);
                    break;
                case 'se': {
                    let newElement = document.createElement('sub');
                    newElement.appendChild(previousCell.data);
                    parent.appendChild(newElement);
                    break;
                }
                case 'sw': {
                    let newElement = document.createElement('sub');
                    newElement.appendChild(previousCell.data);
                    parent.prepend(newElement);
                    break;
                }
                default:
                    console.log(`Unknown crossout location '${previousCell.carry.location}`);
                    break;
            }
            cell.data = parent;
            return cell;
        }

        let previousRow = rows[rows.length - 1];

        if (rows.length === 0 ||
            !previousRow.data.find( cell => cell.carry )) {
            rows.push(newRow);
            return;
        }

        const extraToAddOnLeft = (newRow.data.length - newRow.nRight) - (previousRow.data.length - previousRow.nRight);
        if (extraToAddOnLeft !== 0) {
            if (extraToAddOnLeft < 0) {
                newRow.data = newRow.padOnLeft(newRow.data, -extraToAddOnLeft);
            } else {
                previousRow.data = previousRow.padOnLeft(previousRow.data, extraToAddOnLeft);
            }
        }

        const extraToAddOnRight = newRow.nRight - previousRow.nRight;
        if (extraToAddOnRight !== 0) {
            if (extraToAddOnRight < 0) {
                newRow.data = newRow.padOnRight(newRow.data, -extraToAddOnRight);
                newRow.nRight = previousRow.nRight;
            } else {
                previousRow.data = previousRow.padOnRight(previousRow.data, extraToAddOnRight);
                previousRow.nRight += extraToAddOnRight;
                newRow.nRight = previousRow.nRight;
            }
        }

        for (let i=0; i < newRow.data.length; i++) {
            const prevCell = previousRow.data[i];
            let cell = newRow.data[i];
            if (prevCell.carry) {
                cell = addCrossoutToData(cell, prevCell.carry.crossout);
                cell = mergeCarryAndData(cell, prevCell);
                cell.alignAt = prevCell.carry.location === 's' ? 1 : -1;
                newRow.data[i] = cell; 
            }
        }
        rows[rows.length - 1] = newRow;
    }

    /**
     * Flattens `msrow` / `mstyle` row content into cells; decimal alignment uses the first `mn`'s decimal point.
     * @param {Element} msrow
     * @returns {[TableCell[], number]} Cells and `nRight` when `stackalign === 'decimalpoint'`.
     */
    process_msrow(msrow) {
        let foundNumber = false;
        let nDigitsRightOfDecimalPt = 0;
        /** @type {TableCell[]} */
        let cells = [];
        for (let i=0; i<msrow.children.length; i++) {
            const child = msrow.children[i];
            if (child.tagName.toLowerCase() === 'mn') {
                const chars = child.textContent.trim().split('');
                cells = cells.concat( chars.map( c => new TableCell(c)) );
                if (foundNumber) {
                    nDigitsRightOfDecimalPt += chars.length;
                } else {
                    const iDecimalPt = child.textContent.trim().indexOf(this.getAttr(child, 'decimalpoint', '.'));
                    nDigitsRightOfDecimalPt = iDecimalPt < 0 ? 0 : chars.length - iDecimalPt;
                    foundNumber = true;
                }
            } else {
                // everything should be in one column.
                // FIX: the child might be something complex -- textContent might be inappropriate
                let text = child.textContent.trim()
                if (text === '-') {
                    text = '\u2212';  // use proper minus sign
                }
                cells.push( new TableCell(text) );
                if (foundNumber) {
                    nDigitsRightOfDecimalPt += 1;
                }
            }
        }
        return [cells, this.stackAlign !== 'decimalpoint' ? 0 : nDigitsRightOfDecimalPt];
    }

    /**
     * @param {Element} row - `mscarries` element.
     * @param {string} location - Default `mscarry` `location`.
     * @param {string} crossout - Default `mscarry` `crossout`.
     * @param {number} scriptsizemultiplier - Percent (already scaled, e.g. 60).
     * @returns {TableCell[]}
     */
    process_mscarries(row, location, crossout, scriptsizemultiplier) {
        let cells = [];
        let child = row.children[0];
        while (child) {
            let nextChild = child.nextElementSibling;
            let cellLocation = location;
            let cellCrossout = crossout
            if (child.tagName.toLowerCase() === 'mscarry') {
                cellLocation = this.getAttr(child, 'location', 'n');
                cellCrossout = this.getAttr(child, 'crossout', 'none');
                // FIX: child could be any MathML construct -- currently only supporting a *leaf*
                // the text content of the parent will match that of the *leaf* child, so nothing to change here
            }
            cells.push( new TableCell(child, '', new Carry(cellLocation, cellCrossout, scriptsizemultiplier)) );
            child = nextChild;
        }
        return cells;
    }

    /**
     * Walks `node` children (`msgroup` applies `rowShift` to subsequent siblings).
     * @param {Element} node - `mstack`, `mlongdiv`, or `msgroup`.
     * @param {TableRow[]} rows
     * @param {number} position - Base column offset from ancestor `msgroup`s.
     * @param {number} [rowShift=0] - Per-`msgroup` `shift`.
     * @returns {TableRow[]}
     */
    processChildren(node, rows, position, rowShift) {
        if (!node.children) {
            return rows;
        }
        rowShift = rowShift || 0;

        for (let i= (node.tagName.toLowerCase() === 'mlongdiv' ? 2 : 0); i<node.children.length; i++) {
            rows = this.processChild(node.children[i], rows, position);
            position += rowShift;
        }
        return rows;
    }

    /**
     * @param {Element} child
     * @param {TableRow[]} rows
     * @param {number} position
     * @returns {TableRow[]}
     */
    processChild(child, rows, position) {
        let shift = position + parseInt(this.getAttr(child, 'position', '0'));
        switch (child.tagName.toLowerCase()) {
            case 'mn': {
                const chars = child.textContent.trim().split('');
                const iDecimalPt = child.textContent.trim().indexOf(this.getAttr(child, 'decimalpoint', '.'));
                const nDigitsRightOfDecimalPt = (this.stackAlign !== 'decimalpoint' || iDecimalPt < 0) ? 0 : chars.length - iDecimalPt;
                const cells = chars.map( c => new TableCell(c));
                this.add(rows, new TableRow(cells, nDigitsRightOfDecimalPt, shift) );
                break;
            }

            case 'msgroup':
                rows = this.processChildren(child, rows, shift, parseInt(this.getAttr(child, 'shift', '0')));
                break;

            case 'msline': {
                const length = parseInt(this.getAttr(child, 'length', '0'));
                let thickness = this.getAttr(child, 'mslinethickness', 'medium');
                if (thickness === 'medium') {
                    thickness = MSLINETHICKNESS_MEDIUM;
                } else if (thickness === 'thin') {
                    thickness = MSLINETHICKNESS_THIN;
                } else if (thickness === 'thick') {
                    thickness = MSLINETHICKNESS_THICK;
                }

                if (rows.length === 0) {
                    this.add(rows, new TableRow([], 0, 0) );
                }
                const previousRow = rows[rows.length-1];
                const mathcolor = this.getAttr(child, 'mathcolor', 'black');
                if (length === 0) {
                    previousRow.addUnderline(thickness, mathcolor);
                } else {
                    previousRow.addUnderlineToCells(shift, length, thickness, mathcolor);
                }
                break;
            }

            case 'mscarries': {
                let location = this.getAttr(child, 'location', 'n');
                let crossout = this.getAttr(child, 'crossout', 'none');
                let scriptsizemultiplier = parseFloat(this.getAttr(child, 'scriptsizemultiplier', '0.6'));
                this.add(rows, new TableRow(this.process_mscarries(child, location, crossout, 100*scriptsizemultiplier), 0, shift) );
                break;
            }

            case 'mstyle': {
                const oldAttrs = this.attrs;
                this.attrs = new MathMLAttrs(child, oldAttrs);
                if (child.children.length === 1 && child.children[0].tagName.toLowerCase() === 'msline') {
                    // FIX: not legal according to spec, but should be able to wrap msline in mstyle to change mathcolor
                    // FIX:   spec should be fixed
                    this.processChild(child.children[0], rows, shift);
                } else {
                    let cells;
                    let nDigitsRightOfDecimalPt;
                    [cells, nDigitsRightOfDecimalPt] = this.process_msrow(child);
                    this.add(rows, new TableRow(cells, nDigitsRightOfDecimalPt, shift) );
                    this.attrs = oldAttrs;
                }
                break;
            }
                            
            default: {
                let cells;
                let nDigitsRightOfDecimalPt = 0;

                if (child.tagName.toLowerCase() == 'msrow') {
                    [cells, nDigitsRightOfDecimalPt] = this.process_msrow(child);                       
                } else {
                    // FIX: this isn't right for non-leaf cells
                    // We are out of a MathML context inside of the table we are building, so we can't just stuff the MathML in it
                    cells = [new TableCell(child.textContent.trim())];
                }
                this.add(rows, new TableRow(cells, nDigitsRightOfDecimalPt, shift) );  
                break;
            }
        }
        return rows;
    }

    /**
     * Pads every row to a common width per `stackalign`.
     * @param {TableRow[]} rows
     * @param {string} stackAlign
     * @returns {TableRow[]}
     */
    processShifts(rows, stackAlign) {
        let maxLeftOfDecimalPt = 0;
        let maxRightOfDecimalPt = 0;

        for (const row of rows) {
            if (stackAlign === 'decimalpoint') {
                maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length - row.nRight);
                maxRightOfDecimalPt = Math.max(maxRightOfDecimalPt, row.nRight);               
            } else {
                maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length);
            }
        }

        for (const row of rows) {
            switch (stackAlign) {
                case 'decimalpoint':
                    row.data = row.padOnLeft(row.data, maxLeftOfDecimalPt - (row.data.length - row.nRight));
                    row.data = row.padOnRight(row.data, maxRightOfDecimalPt - row.nRight);
                    row.nRight = maxRightOfDecimalPt;
                    break;                
                case 'left':
                    row.data = row.padOnRight(row.data, maxLeftOfDecimalPt - row.data.length);
                    break;
                case 'center': {
                    const padding = maxLeftOfDecimalPt - row.data.length;
                    row.data = row.padOnRight(row.data, padding/2);
                    row.data = row.padOnLeft(row.data, padding - padding/2);
                    break;
                }
                case 'right':
                    row.data = row.padOnLeft(row.data, maxLeftOfDecimalPt - row.data.length);
                    break;
                default:
                    console.log(`Unknown mstack stackalign attr value: "${stackAlign}"`);
                    break;
            }
        }
        return rows;
    }

    /**
     * Merges `mlongdiv` divisor/result rows and delimiters per `longdivstyle`.
     * @param {Element | null} divisor - First child of `mlongdiv` (may be null).
     * @param {Element | null} result - Second child.
     * @param {TableRow[]} stackRows - Main stack body (from child 2 onward).
     * @returns {TableRow[]}
     */
    addOnLongDivParts(divisor, result, stackRows) {
        /**
         * @param {TableRow} row
         * @returns {number} Count of trailing `NO_SPACE` cells from the right.
         */
        function countPaddingOnRight(row) {
            for (let i = row.data.length-1; i>=0; i--) {
                const cell = row.data[i];
                if (cell.data.textContent !== NO_SPACE) {
                    return row.data.length - 1 - i;
                }
            }
            return row.data.length;
        }
        /**
         * @param {TableRow} row
         * @param {number} nKeep - Trailing empty cells to retain.
         * @returns {TableRow}
         */
        function removePaddingOnRight(row, nKeep) {
            let nDeletedRight = 0;

            for (let i = row.data.length-1; i>=0; i--) {
                const cell = row.data[i];
                if (cell.data.textContent !== NO_SPACE) {
                    break;
                }
                if (nKeep > 0) {
                    nKeep--;
                } else {
                    row.data.pop();
                    nDeletedRight++;
                }
            }

            for (let i=0; i<nKeep; i++) {
                row.data.push( new TableCell(NO_SPACE) );
            }

            row.nRight -= nDeletedRight - nKeep;
            return row;
        }

        const mathcolor = this.getAttr(this.stack, 'mathcolor', 'black');

        if (stackRows.length == 0) {
            stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
        }

        // FIX: this is broken for anything that is more than one row tall.
        /** @type {TableRow[]} */
        let divisorRows = divisor ? this.processChild(divisor, [], 0) : [new TableRow( [new TableCell(NO_SPACE)], 0, 0 )];
        let divisorRow = divisorRows[0];        // FIX: currently can only handle one row
        let iLastDivisorDigit = divisorRow.data.length-1;

        let resultRows = result ? this.processChild(result, [], 0) : [new TableRow( [new TableCell(NO_SPACE)], 0, 0 )];
        let resultRow = resultRows[0];          // FIX: currently can only handle one row

        switch (this.longdivstyle) {
            case 'left/\\right':
            case 'left)(right': {
                // Easy case -- everything goes on first line
                const leftDelim = new TableCell( this.longdivstyle === 'left/\\right' ? '/' : ')' );
                const rightDelim = new TableCell( this.longdivstyle === 'left/\\right' ? '\\' : '(' );
                if (stackRows.length === 0) {
                    stackRows.push( new TableRow(
                        divisorRow.data.concat(
                            [leftDelim],
                            new TableCell(NO_SPACE),
                            [rightDelim],
                            resultRows[0].data)
                    ));
                } else {
                    stackRows[0].data = divisorRow.data.concat(
                        [leftDelim],
                        removePaddingOnRight(stackRows[0], 0).data,
                        [rightDelim],
                        resultRows[0].data)
                    stackRows[0].nRight += 1 + resultRows[0].data.length;
                }
                break;
            }

            case ':right=right': {
                // Easy case -- everything goes on first line
                if (stackRows.length === 0) {
                    stackRows.push( new TableRow(
                        [new TableCell(':')].concat(
                            divisorRow.data,
                            [new TableCell('=')],
                            resultRow.data)
                    ));
                } else {
                    stackRows[0].data = removePaddingOnRight(stackRows[0], 0).data.concat(
                        [new TableCell(':')],
                        divisorRow.data,
                        [new TableCell('=')],
                        resultRow.data)
                    stackRows[0].nRight += 2 + divisorRow.data.length + resultRow.data.length;
                }
                break;
            }

            case 'stackedrightright':
            case 'mediumstackedrightright':
            case 'shortstackedrightright': {
                // mstack on left, vertical line down right side of mstack; divisor to the right of that, horizontal line, then result underneath
                // FIX: this only works for *leaf* elements
                // need to assure there are at least two rows in the stack (already made sure there is one)
                if (stackRows.length == 1) {
                    stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
                    stackRows = this.processShifts(stackRows, this.stackAlign);

                }

                if (this.longdivstyle !== 'stackedrightright') {
                    const nLine1Padding = countPaddingOnRight(stackRows[0]);
                    const nLine2Padding = countPaddingOnRight(stackRows[1]);
                    const nRemove = Math.min(nLine1Padding, nLine2Padding);
                    stackRows[0] = removePaddingOnRight(stackRows[0], nLine1Padding - nRemove);
                    stackRows[1] = removePaddingOnRight(stackRows[1], nLine2Padding - nRemove);
                }
                const verticalLineLength = this.longdivstyle === 'shortstackedrightright' ? 1 :
                                           this.longdivstyle === 'mediumstackedrightright' ? 2 : stackRows.length;
                for (let i = 0; i < verticalLineLength; i++) {
                    let newCell = new TableCell(NO_SPACE);                   
                    if (i < verticalLineLength) {
                        newCell.style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;                    
                    }
                    stackRows[i].data.push(newCell);
                }       

                // Add some padding on the left to the divisor and result to separate them from the line
                // FIX: unfortunately, this also adds space in the columns below for the non 'stackedrightright' cases.
                // FIX: maybe there are some games to be played with columnspans...
                if (this.longdivstyle === 'stackedrightright') {
                    divisorRow.data[0].style += 'padding-left: 0.5em;';
                    resultRow.data[0].style += 'padding-left: 0.5em;';
                }

                const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                if (nCellsLargerResultThanDivisor > 0) {
                    divisorRow.data = divisorRow.padOnRight(divisorRow.data, nCellsLargerResultThanDivisor);
                }
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                divisorRow.addSpacingAfterRow = false;
                stackRows[0].data = stackRows[0].data.concat(divisorRow.data);
                stackRows[0].nRight += divisorRow.data.length

                stackRows[1].data = stackRows[1].data.concat(resultRow.data);
                stackRows[1].nRight += resultRow.data.length
                break;
            }

            case 'stackedleftleft': {
                // mstack on right, vertical line down left side of mstack; divisor to the left of that, horizontal line, then result underneath
                // we need at least two stack elements for this layout
                if (stackRows.length == 1) {
                    stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
                    stackRows = this.processShifts(stackRows, this.stackAlign);
                }

                // FIX: this only works for *leaf* elements
                // First, add a row of padding on left and put a line down the right side of them
                for (let i = 0; i < stackRows.length; i++) {
                    let newCell = new TableCell('');                   
                    newCell.style += `border-left: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;                    
                    stackRows[i].data.unshift(newCell);
                }       

                divisorRow.data[divisorRow.data.length-1].style += 'padding-right: 0.5em;';
                resultRow.data[resultRow.data.length-1].style += 'padding-right: 0.5em;';

                const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                if (nCellsLargerResultThanDivisor > 0) {
                    divisorRow.data = divisorRow.padOnLeft(divisorRow.data, nCellsLargerResultThanDivisor);
                }
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                divisorRow.addSpacingAfterRow = false;
                stackRows[0].data = divisorRow.data.concat(stackRows[0].data);

                stackRows[1].data = resultRow.data.concat(stackRows[1].data);
                break;
            }

            case 'righttop': {
                resultRow.addUnderline(MSLINETHICKNESS_MEDIUM, mathcolor);
                resultRow.addSpacingAfterRow = false;
                let mergedRows = resultRows.concat(stackRows);
                stackRows = this.processShifts(mergedRows, this.stackAlign);

                divisorRow.data[0].style += `border-left: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                stackRows[1].data = stackRows[1].data.concat(divisorRow.data);
                stackRows[1].nRight += divisorRow.data.length;
                break;
            }
                
            case 'lefttop':
            case 'stackedleftlinetop':
            default: {
                // left top -- divisor to left of stack, result new row on top (part of stack and underlined)
                // FIX: this only works for *leaf* elements

                // First, put the result on top with a line underneath
                resultRow.addUnderlineToCells(-resultRow.nRight, Math.max(resultRow.data.length, stackRows[0].data.length), MSLINETHICKNESS_MEDIUM, mathcolor);
                resultRow.addSpacingAfterRow = false;
                let mergedRows = resultRows.concat(stackRows);
                stackRows = this.processShifts(mergedRows, this.stackAlign);

                if (this.longdivstyle === 'stackedleftlinetop') {
                    divisorRow.data[divisorRow.data.length-1].style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                    divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                } else {
                    divisorRow.data = divisorRow.padOnRight(divisorRow.data, 1)
                    iLastDivisorDigit += 1;

                    divisorRow.data[iLastDivisorDigit].class = 'curved-line';
                    divisorRow.data[iLastDivisorDigit].style = '';
                }
                stackRows[1].data = divisorRow.data.concat(stackRows[1].data);
                break;
            }
        }
        let answer = this.processShifts(stackRows, this.stackAlign);
        if (this.longdivstyle === 'lefttop') {
            stackRows[0].data[iLastDivisorDigit].style += `border-bottom: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
        }
        return answer;
    }
	

    /**
     * Tags separator columns (`.`, `,`) and related cells so {@link ElemMath#expandMStackElement} can tighten padding.
     * @param {TableRow[]} stackRows
     * @returns {void}
     */
    shrinkSeparatorColumns(stackRows) {
        if (stackRows.length === 0) {
            return;
        }

        /**
         * @param {TableCell} cell
         * @param {string} extras - Space-separated class names to merge onto `cell.class`.
         */
        const mergeClasses = (cell, extras) => {
            const set = new Set((cell.class || '').trim().split(/\s+/).filter(Boolean));
            for (const c of extras.trim().split(/\s+/)) {
                if (c) {
                    set.add(c);
                }
            }
            cell.class = [...set].join(' ');
        };

        let separatorCols = new Set(Array(stackRows[0].data.length).keys());
        let allEmptyCells = new Set(Array(stackRows[0].data.length).keys());
        for (let row of stackRows) {
            /** @type {TableCell[]} */
            let cols = row.data;
            for (let i=0; i < cols.length; i++) {
                let text = cols[i].data.textContent;
                if (text==='.' || text===',') {
                    allEmptyCells.delete(i);
                } else if (text !== NO_SPACE) {
                    separatorCols.delete(i);
                    allEmptyCells.delete(i);
                }
            }
        }

        allEmptyCells.forEach( i => separatorCols.delete(i));
        
        for (let iCol of separatorCols) {
            stackRows.forEach( row => {
                mergeClasses(row.data[iCol], "separator");
                if (iCol > 0) {
                    mergeClasses(row.data[iCol - 1], "precedes-separator");
                }
            })
        }

        stackRows.forEach(row => {
            for (let i = 0; i < row.data.length; i++) {
                const text = row.data[i].data.textContent;
                if (text === ',') {
                    mergeClasses(row.data[i], 'separator separator-comma');
                    if (i > 0) {
                        mergeClasses(row.data[i - 1], 'precedes-separator');
                    }
                    if (i + 1 < row.data.length) {
                        mergeClasses(row.data[i + 1], 'follows-separator');
                    }
                } else if (text === '.') {
                    mergeClasses(row.data[i], 'separator separator-decimal');
                    if (i > 0) {
                        mergeClasses(row.data[i - 1], 'precedes-separator');
                    }
                    if (i + 1 < row.data.length) {
                        mergeClasses(row.data[i + 1], 'follows-separator');
                    }
                }
            }
        });

        /** Align column max-content when only some rows touch a comma (grid track sizing). */
        const followsSepCols = new Set();
        stackRows.forEach(row => {
            for (let i = 0; i < row.data.length; i++) {
                const cls = row.data[i].class;
                if (cls && cls.split(/\s+/).includes('follows-separator')) {
                    followsSepCols.add(i);
                }
            }
        });
        for (const iCol of followsSepCols) {
            stackRows.forEach(row => {
                if (iCol < row.data.length) {
                    mergeClasses(row.data[iCol], 'follows-separator');
                }
            });
        }

        const precedesSepCols = new Set();
        stackRows.forEach(row => {
            for (let i = 0; i < row.data.length; i++) {
                const cls = row.data[i].class;
                if (cls && cls.split(/\s+/).includes('precedes-separator')) {
                    precedesSepCols.add(i);
                }
            }
        });
        for (const iCol of precedesSepCols) {
            stackRows.forEach(row => {
                if (iCol < row.data.length) {
                    mergeClasses(row.data[iCol], 'precedes-separator');
                }
            });
        }
    }


    /**
     * Serializes the laid-out {@link TableRow} model into a grid container (HTML `div.elem-math`) and cell `div`s.
     * @param {Element} el - `mstack` or `mlongdiv`.
     * @returns {HTMLDivElement} Root element with class `elem-math`.
     */
    expandMStackElement(el) {
        let numberRegEx = /[-+]?\d*\.?\d*/g;
        const charSpacing = parseFloat(numberRegEx.exec(this.charSpacing)[0])/2.0 + this.charSpacing.slice(numberRegEx.lastIndex);
        this.charSpacing.slice(numberRegEx.lastIndex);

        /**
         * Horizontal padding for digit cells; commas/decimals tightened here (not via stylesheet) so shadow/cascade cannot drop it.
         * @param {TableCell} cellData
         * @returns {{ boxStyle: string }}
         */
        const cellBoxStyle = (cellData) => {
            const tokens = (cellData.class || '').trim().split(/\s+/).filter(Boolean);
            const has = (/** @type {string} */ c) => tokens.includes(c);
            if (has('curved-line')) {
                return { boxStyle: `padding-top: .1ex; padding-right: 0; padding-bottom: 0; padding-left: 0;` };
            }
            let pl = charSpacing;
            let pr = charSpacing;
            if (has('separator')) {
                pl = '0';
                pr = '0';
            }
            if (has('precedes-separator')) {
                pr = '0';
            }
            if (has('follows-separator')) {
                pl = '0';
            }
            const t = cellData.data.textContent;
            const textAlign = t === '.' ? 'center' : this.charAlign;
            return {
                boxStyle: `padding-top: .1ex; padding-right: ${pr}; padding-bottom: 0; padding-left: ${pl}; text-align: ${textAlign};`,
            };
        };

        /** @type {TableRow[]} */
        let stackRows = [];
        stackRows = this.processChildren(el, stackRows, 0, 0);
        stackRows = this.processShifts(stackRows, this.stackAlign);
        if (el.tagName.toLowerCase() === 'mlongdiv') {
            stackRows = this.addOnLongDivParts(el.children[0], el.children[1], stackRows);
        }

        if (stackRows.length > 0) {
            stackRows[stackRows.length-1].addSpacingAfterRow = false;
        }

        this.shrinkSeparatorColumns(stackRows);

        const gridRoot = document.createElement('div');
        gridRoot.setAttribute('class', 'elem-math');

        const maxColumns = stackRows.reduce((max, row) => Math.max(max, row.data.length), 0);
        if (maxColumns > 0) {
            gridRoot.style.gridTemplateColumns = `repeat(${maxColumns}, max-content)`;
        }

        let rowIndex = 1;
        for (const row of stackRows) {
            for (let colIndex = 0; colIndex < row.data.length; colIndex++) {
                const cellData = row.data[colIndex];
                let htmlCell = document.createElement('div');
                htmlCell.className = 'elem-math-cell';
                if (cellData.style && /(^|;)\s*border-(left|right):/.test(cellData.style)) {
                    htmlCell.classList.add('elem-math-vrule-cell');
                }
                if (cellData.alignAt) {
                    let span = document.createElement('span');
                    span.style.display = cellData.alignAt === 1 ? 'inline-table' : 'inline-block';
                    span.appendChild(cellData.data);
                    cellData.data = span;
                }

                const classTokens = (cellData.class || '').trim().split(/\s+/).filter(Boolean);
                const isCurvedLine = classTokens.includes('curved-line');

                if (isCurvedLine) {
                    const curve = document.createElement('div');
                    curve.className = 'curved-line';
                    curve.textContent = NON_BREAKING_SPACE;
                    htmlCell.appendChild(curve);
                    cellData.data.textContent = NON_BREAKING_SPACE;
                    htmlCell.appendChild(cellData.data);
                } else {
                    htmlCell.appendChild(cellData.data);
                }

                const { boxStyle } = cellBoxStyle(cellData);
                if (row.style || cellData.style || boxStyle) {
                    const style = `${row.style || ''}${boxStyle}${cellData.style || ''}`;
                    if (style) {
                        htmlCell.setAttribute('style', style);
                    }
                }
                if (cellData.class && !isCurvedLine) {
                    for (const cls of cellData.class.trim().split(/\s+/)) {
                        if (cls) {
                            htmlCell.classList.add(cls);
                        }
                    }
                }
                htmlCell.style.gridColumn = (colIndex + 1).toString();
                htmlCell.style.gridRow = rowIndex.toString();
                gridRoot.appendChild(htmlCell);
            }

            if (row.addSpacingAfterRow) {
                const spacerRow = rowIndex + 1;
                for (let colIndex = 0; colIndex < row.data.length; colIndex++) {
                    const cellData = row.data[colIndex];
                    let newCell = document.createElement('div');
                    newCell.className = 'elem-math-cell elem-math-spacer';
                    if (/(border-left|border-right)/.test(cellData.style)) {
                        newCell.classList.add('elem-math-vrule-cell');
                        const borders = cellData.style.match(/(border-left|border-right).*?;/g);
                        if (borders) {
                            newCell.setAttribute('style', borders.join(''));
                        }
                    }
                    newCell.style.gridColumn = (colIndex + 1).toString();
                    newCell.style.gridRow = spacerRow.toString();
                    gridRoot.appendChild(newCell);
                }
                rowIndex += 1;
            }

            rowIndex += 1;
        }

        return gridRoot;
    }
}

/**
 * Replaces `mstack` / `mlongdiv` in light DOM with a MathML wrapper whose shadow root holds the CSS grid.
 *
 * MathML does not allow a shadow root on `mstack` / `mlongdiv`, so the tree becomes
 * `mtext > span (shadow host) > math > el`, with `div.elem-math` (the grid) appended to the shadow root.
 * Skips work when `el` is already under `m-elem-math` (that element builds its own shadow tree).
 *
 * @param {HTMLElement} el - `mstack` or `mlongdiv` node still in the document.
 * @returns {null}
 */
let transformElemMath = (el) => {
    if (el.parentElement && (el.parentElement.tagName === M_ELEM_MATH_TAG ||
                            (el.parentElement.parentElement && el.parentElement.parentElement.tagName === M_ELEM_MATH_TAG))) {
        return null;
    }

    const spanShadowHost = document.createElement('span');
    const shadowRoot = spanShadowHost.attachShadow({ mode: 'open' });
    shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());

    const elParent = el.parentElement;
    const nextSibling = el.nextElementSibling;
    const gridRoot = new ElemMath(el).expandMStackElement(el);
    shadowRoot.appendChild(gridRoot);

    const mtext = document.createElementNS(MATHML_NS, 'mtext');
    mtext.appendChild(spanShadowHost);
    const math = document.createElementNS(MATHML_NS, 'math');
    spanShadowHost.appendChild(math);
    math.appendChild(el);
    elParent.insertBefore(mtext, nextSibling);

    return null;
};

_MathTransforms.add('mstack', transformElemMath, ELEM_MATH_CSS);
/** `mlongdiv` reuses the same transform; styles are registered once on `mstack`. */
_MathTransforms.add('mlongdiv', transformElemMath);

/**
 * Declarative hook: first child must be `mstack` or `mlongdiv`; layout is moved into this element's shadow root.
 */
customElements.define('m-elem-math', class extends HTMLElement {
    constructor() {
        super();
        const gridRoot = new ElemMath(this.children[0]).expandMStackElement(this.children[0]);
        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
        shadowRoot.appendChild(gridRoot);
    }
});

