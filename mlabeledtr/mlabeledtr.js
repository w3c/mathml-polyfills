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

import { _MathTransforms } from '../common/math-transforms.js'

const namespaceURI = "http://www.w3.org/1998/Math/MathML";

/**
 * 
 * @param {HTMLElement} mlabeledtr 
 */
const transformMlabeledtr = (mlabeledtr) => {
  // Change the parent table by adding a column to it, with 'el' placed in it.
  // el is replaced with a 'mtr', which is what is returned.

  let newTable = mlabeledtr.parentElement.cloneNode(true);
  const label = mlabeledtr.firstElementChild;
  const side = newTable.getAttribute('side') || 'right';

  // new row without label -- mlabeledtr is modified (all but label removed)
  let newMtr = document.createElementNS(namespaceURI, "mtr");
  for (let i=1; i < mlabeledtr.children.length; i++) { // skip first child which is label
    newMtr.appendChild(mlabeledtr.children[i]);
  }

  let emptyColumnEntry = document.createElementNS(namespaceURI, "mtd");
  emptyColumnEntry.appendChild(document.createTextNode(''));
  for (let i=0; i < newTable.children.length; i++) {
    let row = newTable.children[i];
    const foundLabel = row.tagName === 'mlabeledtr';
    if (foundLabel) {
      row.replaceWith(newMtr);
      row = newTable.children[i];
    }
    const newColEntry = foundLabel ? label : emptyColumnEntry.cloneNode();
    if (side === 'right') {
      row.appendChild(newColEntry);
    } else {
      row.insertBefore(newColEntry, row.firstElementChild);
    }
  }

  mlabeledtr.parentElement.replaceWith(newTable);
  return null;
}

_MathTransforms.add('mlabeledtr', transformMlabeledtr);
