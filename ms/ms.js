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


import {poly} from '../common/math-polys-core.js'

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

/**
 * 
 * @param {string} text 
 */
function collapseWhiteSpace(text) {
    // Collapse the whitespace as specified by the MathML specification.
    // https://mathml-refresh.github.io/mathml/chapter2.html#fund.collapse
    return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
}

/**
 * 
 * @param {HTMLElement} el 
 */
function getDirection(el) {
    // We need to take into account the writing direction. This comes either from MathML "dir" attr or from
    //   the CSS "direction" property, with CSS taking priority.
    // FIX: can't tell when a CSS value is set on an element such as
    // FIX:  mfrac {direction:rtl;} vs inherited from higher element unless set as an inline style)
    const dir = getComputedStyle(el).direction;
    while (el) {
        const attr = (el.style && el.style.direction) || el.getAttribute('dir');
        if (attr) {
            return attr;
        }
        if (el.tagName.toLowerCase === 'math') {
            return dir;
        }
        el = el.parentElement;
    }
    return dir;
}

/**
 * @param {HTMLElement} el
 */
let upgrade = (el) => {
    // Ideally, we would attach a shadow root to <ms> and put the result in there, but that's not legal (now)
    // Instead, we just move the lquote/rquote attrs into the ms and change the DOM.
    // If lquote or rquote appear in the string contents, they should be escaped.
    const lquote = el.getAttribute('lquote') || '"';
    const rquote = el.getAttribute('rquote') || '"';
    let content = collapseWhiteSpace(el.textContent);
    content = content.replace(lquote,'\\'+lquote);
    if (rquote !== lquote) {
        content = content.replace(rquote,'\\'+rquote);
    }
    el.textContent = getDirection(el) === 'ltr' ? lquote + content + rquote : rquote + content + lquote;
}

// poly.define('ms', upgrade)
(function () {
    window["upgrade-ms"] = function () {
        // Replace all the <mfenced> elements with their expanded equivalent.
        let msElements = document.body.getElementsByTagNameNS(MATHML_NS, "ms");
        for (let i = 0; i < msElements.length; i++) {
            upgrade(msElements[i]);
        }
    };


    window.addEventListener("load", window["upgrade-ms"]);
}());