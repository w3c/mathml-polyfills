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

/*
 * The basic idea is that each digit gets its own column in the resulting table
 * There are lots of wrinkles on this, including getting alignment correct, drawing lines, etc.
 * https://mathml-refresh.github.io/mathml/#stacks-of-characters-mstack
 *
 * The algorithm works by building a data structure that closely mirrors the resulting table.
 * Once all the rows are processed, that data structure is turned into an HTML table.
 */

import { _MathTransforms } from '../common/math-transforms.js'

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

// msline defined values
const MSLINETHICKNESS_THIN = '.1ex'
const MSLINETHICKNESS_MEDIUM = '.35ex'
const MSLINETHICKNESS_THICK = '.65ex'

// mstack defined charspacing values
const MSTACK_TIGHT = '0em'
const MSTACK_MEDIUM = '.2em'
const MSTACK_LOOSE = '.4em'

const NON_BREAKING_SPACE = '\u00A0';

class MathMLAttrs {
    /**
     * Call the constructor when an mstyle is found
     * @param {Element} el
     * @param {Object} [previousAttrs=null] 
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
                // Override any attr that is already present
                for (let attr of el.attributes) {
                    this.attrs[attr.name] = attr.value;
                }
            }
        }
    }

    /**
     * Add an attr of 'el' if it isn't already present in 'this.attrs' (helper fn for the constructor)
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
     * 
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

class Carry {
    /**
     * 
     * @param {string} location 
     * @param {string} crossout 
     * @param {number} scriptsizemultiplier
     */
    constructor(location, crossout, scriptsizemultiplier) {
        this.location = location;
        this.crossout = crossout;
        this.scriptsizemultiplier = scriptsizemultiplier
    }
}

class TableCell {
     // Holds data to construct the actual <td>
	/**
	 * @param {string} [value]                        // contents (digit) of the cell
     * @param {string} [style='']                   // style info for the cell
	 * @param {Carry} [carry=null]                  // a single carry
	 */
    constructor(value, style, carry) {
        value = value;
        if (carry) {
            this.data = document.createElement((carry.location === 'n' || carry.location === 's') ? 'div' : 'span');
            this.data.textContent = value;
            this.data.className = 'carry';
            this.data.style.fontSize = Math.round(carry.scriptsizemultiplier).toString() + '%';
        } else {
            this.data = document.createTextNode(value);
        }
        this.carry = carry;                        // for multiple carries, 'data' is already built up -- value is last carry seen
        this.style = style || '';
    }
}

class TableRow {
      // Holds data to construct the actual <tr>
	/**
	 * @param {TableCell[]} data                 // all cells in the row
	 * @param {number} [digitsOnRight]           // # of digits to the right of '.' (includes '.') (can be negative due to shift)
	 * @param {number} [shift]                   // # amount of shift (position) -- need to track because of underlines
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
        this.addSpacingAfterRow = false;    // want to add a little spacing later on
        this.alignAt = 0;                 // no alignment needed (-1 is last line; 1 is first line)
    }

    /**
     * @param {string} lineUnderThickness
     * @param {string} color
     */
    addUnderline(lineUnderThickness, color) {
        this.style += `border-bottom: ${lineUnderThickness} solid ${color};`;
        this.addSpacingAfterRow = true;
    }

    /**
     * 
     * @param {number} shift 
     * @param {number} length 
     * @param {string} thickness 
     * @param {string} color
     */
    addUnderlineToCells(shift, length, thickness, color) {
        // the underlines should act independently of the previous line
        // however, to do the underline, we need to attach them as borders to the above the cells

        // pad previous row on left/right if needed
        // note: order of padding is important so that 'right' is correct)
        // note: we create new TableCells because we will modify it by adding an underline
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

        // now add the underlines
        for (let i = right - length; i < right; i++) {
            this.data[i].style += `border-bottom: ${thickness} solid ${color};`;
        }
        this.addSpacingAfterRow = true;
    }

    // two helper functions that adds padding to the left or right side of an array
    /**
     * 
     * @param {TableCell[]} arr 
     * @param {number} amount
     * @returns TableCell[]
     */
    padOnLeft(arr, amount) {
        let newCells = Array(amount);
        for (let i = 0; i < amount; i++) {
            newCells[i] = new TableCell(NON_BREAKING_SPACE);
        }
        return newCells.concat(arr);
    }
    
    /**
     * 
     * @param {TableCell[]} arr 
     * @param {number} amount 
     * @returns TableCell[]
     */
    padOnRight(arr, amount) {
        let newCells = Array(amount);
        for (let i = 0; i < amount; i++) {
            newCells[i] = new TableCell(NON_BREAKING_SPACE);
        }
        return arr.concat(newCells);
     }
}


class ElemMath {
	/** 
     * mstack and mlondiv
     * Note: we do *not* store the rows of the stack in here because (potentially) mlongdiv has its own stack for divisor/result
     *   Instead, we pass the rows as arguments to the various methods
     * 
	 * @param {Element} mstackOrLongDiv
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
        this.align = this.getAttr(mstackOrLongDiv,'algin', 'baseline');
    }

    /**
     * 
     * @param {Element} el 
     * @param {string} name 
     * @param {string} defaultVal 
     * @returns {string}
     */
    getAttr(el, name, defaultVal) {
        return this.attrs.getAttr(el, name, defaultVal);
    }
    
    /**
     * Add another row to the stack.
     * If the last row is a row of carries, then this row is merged with them so there is no new row
     * If this row is a row of carries also, then the merging is done differently 
     * @param {TableRow[]} rows
     * @param {TableRow} newRow 
     */
    add(rows, newRow) {
        /**
         * 
         * @param {TableCell} cell 
         * @param {string} crossoutStyle 
         * @returns {TableCell}  (updated cell)
         */
        function addCrossoutToData(cell, crossoutStyle) {
            // some crossouts are handled with :before or :after
            // since there can only be one of these, we create a nested span for each crossout 
            const crossouts = crossoutStyle.split(' ');
            let result = cell.data;
            crossouts.forEach( function(crossout) {
                if (crossout === 'none' || crossout==='') { // '' -- happens when there are two or more spaces in a row
                    return;    // nothing to do
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
                        span.className = 'crossout-up';         // do something  
                        console.log(`Unknown crossout type '${crossoutStyle}`);
                        break;               
                }
                result = span;
            } );
            cell.data = result;
            return cell;
        }
        /**
         * 
         * @param {TableCell} cell 
         * @param {TableCell} previousCell 
         * @returns {TableCell}  (updated data)
         */
        function mergeCarryAndData(cell, previousCell) {
            let data = cell.data;
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

        // if the previous row is a carry row, then the non "fill" spots will have a carry -- just need to find one
        if (rows.length === 0 ||
            !previousRow.data.find( cell => cell.carry )) {
            rows.push(newRow);    // "normal" row -- just add it
            return;
        }

        // have to merge the rows
        // first make them the same size, padding on left/right if needed
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
            } else {
                previousRow.data = previousRow.padOnRight(previousRow.data, extraToAddOnRight);
            }
        }

        // merge the data now that the rows have the same number of elements
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
        rows[rows.length - 1] = newRow;      // replace the carry row with the current row
    }

    /**
     * 
     * @param {Element} msrow 
     * @returns {[TableCell[], number]}  
     */
    process_msrow(msrow) {
        // The spec doesn't say how to determine decimal alignment in an msrow
        // Here, we take the first 'mn' we find to be the determination of a '.'.
        // Anything after the 'mn' is considered to be to the right of the '.'
        let foundNumber = false;
        let nDigitsRightOfDecimalPt = 0;
        //** @type {TableCell[]}  */
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
                cells.push( new TableCell(child.textContent.trim()) );
                if (foundNumber) {
                    nDigitsRightOfDecimalPt += 1;
                }
            }
        }
        return [cells, this.stackAlign !== 'decimalpoint' ? 0 : nDigitsRightOfDecimalPt];
    }

    /**
     * 
     * @param {Element} row 
     * @param {string} location 
     * @param {string} crossout 
     * @param {number} scriptsizemultiplier
     * @returns {TableCell[]}
     */
    process_mscarries(row, location, crossout, scriptsizemultiplier) {
        let cells = [];
        for (let i=0; i<row.children.length; i++) {
            const child = row.children[i];
            const data = child.textContent.trim();
            let cellLocation = location;
            let cellCrossout = crossout
            if (child.tagName.toLowerCase() === 'mscarry') {
                cellLocation = this.getAttr(child, 'location', 'n');
                cellCrossout = this.getAttr(child, 'crossout', 'none');
                // FIX: child could be any MathML construct -- currently only supporting a *leaf*
                // the text content of the parent will match that of the *leaf* child, so nothing to change here
            }
            cells.push( new TableCell(data, '', new Carry(cellLocation, cellCrossout, scriptsizemultiplier)) );
        }
        return cells;
    }

    /**
	 * @param {Element} node
     * @param {TableRow[]} rows
	 * @param {number} position
	 * @param {number} [rowShift=0]
     * @returns {TableRow[]}
	 */
    processChildren(node, rows, position, rowShift) {
        if (!node.children) {
            return rows;
        }
        rowShift = rowShift || 0;
        
        // Note: we only want to compute a decimal position (which is an align point) when stackAlign==='decimalpoint'; otherwise alignment will be off
        for (let i= (node.tagName.toLowerCase() === 'mlongdiv' ? 2 : 0); i<node.children.length; i++) {
            rows = this.processChild(node.children[i], rows, position);
            position += rowShift;           // non-zero when specified by msgroup; applies to 2nd and subsequent rows
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
            }
            break;
                            
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
     * 
     * @param {TableRow[]} rows
     * @param {string} stackAlign
     * @returns {TableRow[]}
     */
    processShifts(rows, stackAlign) {
        let maxLeftOfDecimalPt = 0;
        let maxRightOfDecimalPt = 0;      // only used when doing decimal alignment

        // we want to fill out all the entries in each row
        // when doing decimal alignment, we need to keep track of int and fractional part
        // first, compute the max digits across all the rows
        for (const row of rows) {
            if (stackAlign === 'decimalpoint') {
                maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length - row.nRight);
                maxRightOfDecimalPt = Math.max(maxRightOfDecimalPt, row.nRight);               
            } else {
                maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length);
            }
        }

        // now pad each row
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
                    row.data = row.padOnLeft(row.data, padding - padding/2);  // remainder after half fill above
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
     * 
     * @param {Element} divisor 
     * @param {Element} result 
     * @param {TableRow[]} stackRows
     * @returns {TableRow[]}
     */
    addOnLongDivParts(divisor, result, stackRows) {
        /**
         * @param {TableRow} row 
         */
        function countPaddingOnRight(row) {
            for (let i = row.data.length-1; i>=0; i--) {
                const cell = row.data[i];
                if (cell.data.textContent !== NON_BREAKING_SPACE) {
                    return row.data.length - 1 - i;
                }
            }
            return row.data.length;
        }
        /**
         * @param {TableRow} row
         * @param {number} nKeep    // number of padded cells to keep (if not enough cells, appropriate # is added)
         * @returns {TableRow}
         */
        function removePaddingOnRight(row, nKeep) {
            let nDeletedRight = 0;

            // delete empty cells from end
            for (let i = row.data.length-1; i>=0; i--) {
                const cell = row.data[i];
                if (cell.data.textContent !== NON_BREAKING_SPACE) {
                    break;
                }
                if (nKeep > 0) {
                    nKeep--;
                } else {
                    row.data.pop();
                    nDeletedRight++;
                }
            }

            // add on any needed cells
            for (let i=0; i<nKeep; i++) {
                row.data.push( new TableCell(NON_BREAKING_SPACE) );
            }

            row.nRight -= nDeletedRight - nKeep;
            return row;
        }

        const mathcolor = this.getAttr(this.stack, 'mathcolor', 'black');

        // Note: we assure there are divisors, results and at least one row in the stack for layout by creating dummy entries if needed.
        //   For a few styles, a second row is needed -- those are handled in those cases.

        if (stackRows.length == 0) {
            stackRows.push( new TableRow( [new TableCell(NON_BREAKING_SPACE)], 0, 0 ) );
        }

        // FIX: this is broken for anything that is more than one row tall.
        /** @type{TableRow[]} */
        let divisorRows = divisor ? this.processChild(divisor, [], 0) : [new TableRow( [new TableCell(NON_BREAKING_SPACE)], 0, 0 )];
        let divisorRow = divisorRows[0];        // FIX: currently can only handle one row

        let resultRows = result ? this.processChild(result, [], 0) : [new TableRow( [new TableCell(NON_BREAKING_SPACE)], 0, 0 )];
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
                            new TableCell(NON_BREAKING_SPACE),
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
                    stackRows.push( new TableRow( [new TableCell(NON_BREAKING_SPACE)], 0, 0 ) );
                    stackRows = this.processShifts(stackRows, this.stackAlign);

                }

                // First, add a row of padding on right and put a line down the right side of them
                if (this.longdivstyle !== 'stackedrightright') {
                    // want to suck these lines in -- find out how much padding there is on each line and remove some
                    const nLine1Padding = countPaddingOnRight(stackRows[0]);
                    const nLine2Padding = countPaddingOnRight(stackRows[1]);
                    const nRemove = Math.min(nLine1Padding, nLine2Padding);
                    stackRows[0] = removePaddingOnRight(stackRows[0], nLine1Padding - nRemove);
                    stackRows[1] = removePaddingOnRight(stackRows[1], nLine2Padding - nRemove);
                }
                const verticalLineLength = this.longdivstyle === 'shortstackedrightright' ? 1 :
                                           this.longdivstyle === 'mediumstackedrightright' ? 2 : stackRows.length;
                for (let i = 0; i < verticalLineLength; i++) {
                    let newCell = new TableCell(NON_BREAKING_SPACE);                   
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

                // Attach the divisor to the first line (note: the divisor and result are *not* decimal aligned)
                const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                if (nCellsLargerResultThanDivisor > 0) {
                    divisorRow.data = divisorRow.padOnRight(divisorRow.data, nCellsLargerResultThanDivisor);
                }
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                divisorRow.addSpacingAfterRow = false;
                stackRows[0].data = stackRows[0].data.concat(divisorRow.data);
                stackRows[0].nRight += divisorRow.data.length

                // Attach the result to the second line
                stackRows[1].data = stackRows[1].data.concat(resultRow.data);
                stackRows[1].nRight += resultRow.data.length
                break;
            }

            case 'stackedleftleft': {
                // mstack on right, vertical line down left side of mstack; divisor to the left of that, horizontal line, then result underneath
                // we need at least two stack elements for this layout
                if (stackRows.length == 1) {
                    stackRows.push( new TableRow( [new TableCell(NON_BREAKING_SPACE)], 0, 0 ) );
                    stackRows = this.processShifts(stackRows, this.stackAlign);
                }

                // FIX: this only works for *leaf* elements
                // First, add a row of padding on left and put a line down the right side of them
                for (let i = 0; i < stackRows.length; i++) {
                    let newCell = new TableCell('');                   
                    newCell.style += `border-left: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;                    
                    stackRows[i].data.unshift(newCell);
                }       

                // Add some padding on the right to the divisor and result to separate them from the line
                divisorRow.data[divisorRow.data.length-1].style += 'padding-right: 0.5em;';
                resultRow.data[resultRow.data.length-1].style += 'padding-right: 0.5em;';

                // Attach the divisor to the first line (note: the divisor and result are *not* decimal aligned)
                const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                if (nCellsLargerResultThanDivisor > 0) {
                    divisorRow.data = divisorRow.padOnLeft(divisorRow.data, nCellsLargerResultThanDivisor);
                }
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                divisorRow.addSpacingAfterRow = false;
                    stackRows[0].data = divisorRow.data.concat(stackRows[0].data);

                // Attach the result to the second line
                stackRows[1].data = resultRow.data.concat(stackRows[1].data);
                break;
            }

            case 'righttop': {
                // First, put the result on top with a line underneath
                resultRow.addUnderline(MSLINETHICKNESS_MEDIUM, mathcolor);
                resultRow.addSpacingAfterRow = false;        // don't want to add extra spacing
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
                resultRow.addSpacingAfterRow = false;        // don't want to add extra spacing
                let mergedRows = resultRows.concat(stackRows);
                stackRows = this.processShifts(mergedRows, this.stackAlign);

                // FIX: this just adds a straight line. It should really look a bit like ")"
                divisorRow.data[divisorRow.data.length-1].style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                divisorRow.data[divisorRow.data.length-1].style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                if (this.longdivstyle === 'stackedleftlinetop') {
                    divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                }
                stackRows[1].data = divisorRow.data.concat(stackRows[1].data);
                break;
            }
        }
        return this.processShifts(stackRows, this.stackAlign);
    }
	
    /**
     * @param {Element} el -- either mstack or mlongdiv (if later, first two children are divisor and result which can be <none/>)
     * @returns {Element} -- table equivalent to be inserted into DOM
     */
    expandMStackElement(el) {
        // Return a <table> element representing the expanded <mstack>.

        // Compute spacing and split it between the left and right side
        // Note: this pattern works for scientifc notation (e.g., '-3.4e-2') because we only care about numeric part in front of 'e'
        let numberRegEx = /[-+]?\d*\.?\d*/g;
        const charSpacing = parseFloat(numberRegEx.exec(this.charSpacing)[0])/2.0 + this.charSpacing.slice(numberRegEx.lastIndex);
        const cellStyle = `padding: .1ex ${charSpacing} 0 ${charSpacing}; text-align: ${this.charAlign};`;

        /** @type {TableRow[]} */
        let stackRows = [];
        stackRows = this.processChildren(el, stackRows, 0, 0);
        stackRows = this.processShifts(stackRows, this.stackAlign);
        if (el.tagName.toLowerCase() === 'mlongdiv') {
            stackRows = this.addOnLongDivParts(el.children[0], el.children[1], stackRows);
        }

        // avoid adding an extra space after the last line
        if (stackRows.length > 0) {
            stackRows[stackRows.length-1].addSpacingAfterRow = false;
        }

        let table = document.createElement('table');
        table.setAttribute('class', 'elem-math');
        for (const row of stackRows) {
            let htmlRow = document.createElement('tr');
            if (row.style) {
                htmlRow.setAttribute('style', row.style);
            }
            for (const cellData of row.data) {
                let htmlTD = document.createElement('td');
                if (cellData.alignAt) {
                    let span = document.createElement('span');
                    span.style.display = cellData.alignAt === 1 ? 'inline-table' : 'inline-block';
                    span.appendChild(cellData.data);
                    cellData.data = span;
                }

                htmlTD.appendChild(cellData.data);
                htmlTD.setAttribute('style', cellStyle + cellData.style);    // cellData.style so it overrides
                htmlRow.appendChild(htmlTD);
            }
            table.appendChild(htmlRow);
            if (row.addSpacingAfterRow) {
                // can't put a margin on a table row or push it into the table cells above, so we add a dummy row here
                // we need to continue any left/right border from the previous line
                let newRow = document.createElement('tr');
                newRow.style.height = '.5ex';

                for (const cellData of row.data) {
                    let newCell = document.createElement('td');
                    if (/(border-left|border-right)/.test(cellData.style)) {
                        // extract borders -- this assumes the code never uses 'border: 1 2 3 4;'
                        const borders = cellData.style.match(/(border-left|border-right).*?;/g);
                        newCell.setAttribute('style', borders);
                    }
                   newRow.appendChild(newCell); 
                };
                table.appendChild(newRow);
            }
        }

        return table;
    }
}

/**
 * 
 * @param {ShadowRoot} shadowRoot 
 */
function addStyleSheetToShadowRoot(shadowRoot) {
    const style = document.createElement("style");
    const link = document.createElement("link");
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'https://mathml-refresh.github.io/mathml-polyfills/elem-math/elemMath.css';
    style.appendChild(link);
    shadowRoot.appendChild(style); 
}

/**
 * @param {HTMLElement} el
 */
let transformElemMath = (el) => {
    // Ideally, we would attach a shadow root to the <mstack> or <mlongdiv>, but that's not legal (now)
    // Instead, we wrap 'el' (the root of the elementary) with "<mtext><span><math> el <math></span></mtext>".
    // The span can serve as the shadow root.
    // [current transformer makes a clone, so can't do this] As an optimization (likely very common), if the parent of 'el' is 'math', we more directly add a <span> around the 'math'.
    // Very ugly, but at least the DOM doesn't have the ugly table in it.
    // This seems like the least disruptive change to the original structure.

    // hack to allow definition of custom element "m-elem-math" to also work with 'transformElemMath()'
    if (el.parentElement && (el.parentElement.tagName === 'M-ELEM-MATH' ||
                            (el.parentElement.parentElement && el.parentElement.parentElement.tagName === 'M-ELEM-MATH'))) {
        return;
    }

    // put the math with table into a shadow DOM
    const spanShadowHost =  document.createElement("span");
    spanShadowHost.attachShadow({mode: "open"});
    addStyleSheetToShadowRoot(spanShadowHost.shadowRoot);

    // create the table equivalent and put it into the shadow DOM
    const  table = new ElemMath(el).expandMStackElement(el);
    spanShadowHost.shadowRoot.appendChild(table);

    // need to create <mtext> <span> <math> elem math </math> </span> </mtext>
    let mtext = document.createElementNS(MATHML_NS, "mtext");
    mtext.appendChild(spanShadowHost);                      // now have <mtext> <span> ...
    let math = document.createElementNS(MATHML_NS, "math");
    spanShadowHost.appendChild(math);                       // now have <mtext> <span> <math> ...
    math.appendChild(el);                                   // make el a child of math

    return mtext;
}

_MathTransforms.add('mstack', transformElemMath);
_MathTransforms.add('mlongdiv', transformElemMath);

// import {poly} from '../common/math-polys-core.js'
// poly.define('mstack', transformElemMath)
// poly.define('mlongdiv', transformElemMath)


customElements.define('m-elem-math', class extends HTMLElement {
    constructor() {
        super();
        
        // create the table equivalent
        const  table = new ElemMath(this.children[0]).expandMStackElement(this.children[0]);
        
        // put the table into a shadow DOM
        const shadowRoot =  this.attachShadow({mode: 'open'});
        addStyleSheetToShadowRoot(shadowRoot);
        shadowRoot.appendChild(table);
    }
  });
  
  
