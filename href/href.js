/***
 * Make href work on all MathML elements by adding click, mouseover,
 * and mouseout events
***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/*
  Copyright (c) 2025 David Carlisle

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

import { _MathTransforms, MATHML_NS } from '../common/math-transforms.js'


/**
 * @param {MathMLElement} el 
 */
const transformHref = (el) => {
    if (el.namespaceURI == MATHML_NS) {
    el.style.cursor="pointer";
    el.addEventListener("click", (event) => {
            document.location=event.currentTarget.getAttribute("href");
        });
    el.addEventListener("mouseover", (event) => {
            event.currentTarget.style.textDecoration="solid underline";
        });
    el.addEventListener("mouseout", (event) => {
            event.currentTarget.style.textDecoration="";
        });
   }
    return el;
}


 _MathTransforms.add('math *[href]', transformHref);

