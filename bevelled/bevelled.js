/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/*
  Copyright (c) 2016-2019 Igalia S.L.

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
 * @param {HTMLElement} mfrac 
 */
const transformBevelled = (mfrac) => {
    // Return an <mrow> element representing the bevelled fraction.
    // The numerator is shifted up 0.5em
    let mrow = document.createElementNS(namespaceURI, "mrow");

    // create the numerator
    let mpadded = document.createElementNS(namespaceURI, "mpadded");
    mpadded.setAttribute("height", "+0.5em");
    mpadded.setAttribute("voffset", "0.5em");
    mpadded.appendChild(mfrac.firstElementChild);
    mrow.appendChild(mpadded);

    // add the "/"
    let slash = document.createElementNS(namespaceURI, "mo");
    slash.setAttribute("stretchy", "true");
    slash.appendChild(document.createTextNode('/'));
    mrow.appendChild(slash);

    // add the denominator
    mrow.appendChild(mfrac.lastElementChild);
    return mrow;
}

_MathTransforms.add('mfrac[bevelled]', transformBevelled);
