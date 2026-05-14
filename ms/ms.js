/***
 * Handles lquote and rquote attrs on ms by replacing with mtext (MathML Core).
 ***/
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
 * @param {string} text
 * @returns {string}
 */
function collapseWhiteSpace(text) {
    // Collapse the whitespace as specified by the MathML specification.
    // https://w3c.github.io/mathml/chapter2.html#fund.collapse
    return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
}

/**
 * @param {HTMLElement} ms
 * @returns {Element}
 */
const transformMs = (ms) => {
    const lquote = ms.getAttribute('lquote') || '"';
    const rquote = ms.getAttribute('rquote') || '"';
    let content = collapseWhiteSpace(ms.textContent);
    if (lquote === rquote) {
        content = content.split(lquote).join('\\' + lquote);
    } else {
        content = content.split(lquote).join('\\' + lquote);
        content = content.split(rquote).join('\\' + rquote);
    }
    const mtext = document.createElementNS(MATHML_NS, 'mtext');
    for (const attr of Array.from(ms.attributes)) {
        if (attr.name !== 'lquote' && attr.name !== 'rquote') {
            mtext.setAttribute(attr.name, attr.value);
        }
    }
    mtext.textContent = lquote + content + rquote;
    return mtext;
};

_MathTransforms.add('ms', transformMs);
