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
      label.setAttribute('intent', ':equation-label');
      let newRow = document.createElementNS(namespaceURI, "mtr");
      for (const attr of row.attributes) {
        newRow.setAttribute(attr.name, attr.value);
      }
      console.log('side=', side);
      // leave the label as the first element or move it to the right (last element)
      for (let c = side=='left' ? 0 : 1; c < row.children.length; c++) {
        console.log('c=', c, row.children[c].outerHTML);
        newRow.appendChild(row.children[c]);
      }
      if (side === 'right') {
        newRow.appendChild(label);
      }
      row.replaceWith(newRow);
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
