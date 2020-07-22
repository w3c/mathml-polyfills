/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
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
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

import { _MathTransforms, cloneElementWithShadowRoot } from '../common/math-transforms.js'

const namespaceURI = "http://www.w3.org/1998/Math/MathML";

/**
 * 
 * @param {HTMLElement} mtable 
 */
function makeTableSquare(mtable) {
  // FIX: implement -- need to handle spanning cols
  return mtable;
}

/**
 * 
 * @param {HTMLElement} mtable 
 */
function handleLabeledRows(mtable) {
  // assumes table is square

  // first check to see if there is a 'mlabeledtr'
  if (mtable.getElementsByTagName('mlabeledtr').length === 0) {
    return mtable;
  }

  const side = mtable.getAttribute('side') || 'right';
  let emptyColumnEntry = document.createElementNS(namespaceURI, "mtd");
  emptyColumnEntry.appendChild(document.createTextNode(''));

  for (let i=0; i < mtable.children.length; i++) {
    let row = mtable.children[i];
    const foundLabel = row.tagName === 'mlabeledtr';
    let label = null;

    if (foundLabel) {
      label = row.firstElementChild;
      let newRow = document.createElementNS(namespaceURI, "mtr");
      for (let c=1; c < row.children.length; c++) {
        newRow.appendChild(row.children[c]);
      }
      row.replaceWith(newRow);
      row = newRow;
    }

    const newColEntry = foundLabel ? label : emptyColumnEntry.cloneNode();
    if (side === 'right') {
      row.appendChild(newColEntry);
    } else {
      row.insertBefore(newColEntry, row.firstElementChild);
    }
  }

  return mtable;
}

/**
 * 
 * @param {HTMLElement} mtable 
 */
const transformMtable = (mtable) => {
  // Change the table by adding a column to it, with 'el' placed in it.
  // el is replaced with a 'mtr', which is what is returned.

  let newTable = makeTableSquare(cloneElementWithShadowRoot(mtable))
  handleLabeledRows(newTable);

  // FIX: handle attrs
  return newTable;
}

_MathTransforms.add('mtable', transformMtable);
