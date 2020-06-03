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

/**
 * @param {HTMLElement} el 
 */
const transformThin = (el) => {
    // this should only be called when linethickness="thin"
    el.setAttribute("linethickness", "67%");
    return el;
}

/**
 * @param {HTMLElement} el 
 */
const transformMedium = (el) => {
    // this should only be called when linethickness="medium"
    el.setAttribute("linethickness", "100%");
    return el;
}

/**
 * @param {HTMLElement} el 
 */
const transformThick = (el) => {
    // this should only be called when linethickness="thick"
    el.setAttribute("linethickness", "167%");
    return el;
}

_MathTransforms.add('[linethickness="thin"]', transformThin);
_MathTransforms.add('[linethickness="medium"]', transformMedium);
_MathTransforms.add('[linethickness="thick"]', transformThick);
