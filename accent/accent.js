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
 * 
 * @param {HTMLElement} child 
 * @param {string} attrName 
 */
function setAccentValue(child,attrName) {
  let accentVal = child.getAttribute("accent");
  if (accentVal === null && child.tagName === 'mo') {
    accentVal = "true";
  };
  if (accentVal !== null) {
    child.parentElement.setAttribute(attrName, accentVal);
  }
}

/**
 * 
 * @param {HTMLElement} el 
 */
const transformAccents = (el) => {
  // If the 2nd/3rd args are <mo> or if they have accent=true,
  // add 'accent'/'accentunder' = true to 'el' (mover, etc)
  if (!el.getAttribute("accentunder" && el.tagName !== 'mover')) {
    // if accentunder is not set on munder/munderover, check to see if we should set it
    setAccentValue(el.children[1], 'accentunder');
  }
  if (!el.getAttribute("accent") && el.tagName !== 'munder') {
    // if accent is not set on mover/munderover, check to see if we should set it
    const child = el.children.length === 2 ? el.children[1] : el.children[2];
    setAccentValue(child, 'accent');
  }
}

_MathTransforms.add('munder', transformAccents);
_MathTransforms.add('mover', transformAccents);
_MathTransforms.add('munderover', transformAccents);
