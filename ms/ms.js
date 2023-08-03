// @ts-check
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


import { _MathTransforms, MATHML_NS } from '../common/math-transforms.js'


/**
 * 
 * @param {string} text 
 */
function collapseWhiteSpace(text) {
    // Collapse the whitespace as specified by the MathML specification.
    // https://w3c.github.io/mathml/chapter2.html#fund.collapse
    return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
}

/**
 * @param {HTMLElement} ms
 */
const transformMs = (ms) => {
    // Ideally, we would attach a shadow root to <ms> and put the result in there, but that's not legal (now)
    // Instead, we just move the lquote/rquote attrs into the ms and change the DOM.
    // If lquote or rquote appear in the string contents, they should be escaped.
    const lquote = ms.getAttribute('lquote') || '"';
    const rquote = ms.getAttribute('rquote') || '"';
    let content = collapseWhiteSpace(ms.textContent);
    content = content.replace(lquote,'\\'+lquote);
    if (rquote !== lquote) {
        content = content.replace(rquote,'\\'+rquote);
    }
    ms.textContent = lquote + content + rquote;
    return 
}

_MathTransforms.add('ms', transformMs);
