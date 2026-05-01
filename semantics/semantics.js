/***
 * Ensures the first child of <semantics> is the presentation MathML fragment.
 * If presentation is only inside <annotation-xml encoding="...">, its children
 * are hoisted to become the first child(ren) of <semantics> (per MathML 4).
 ***/
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

import { _MathTransforms, MATHML_NS } from '../common/math-transforms.js';

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isMathMLElement(el) {
    return el.namespaceURI === MATHML_NS;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isSemanticsAnnotation(el) {
    if (!isMathMLElement(el)) return false;
    const n = el.localName;
    return n === 'annotation' || n === 'annotation-xml';
}

/**
 * @param {string|null} encoding
 * @returns {boolean}
 */
function isPresentationAnnotationXmlEncoding(encoding) {
    if (encoding == null) return false;
    const base = encoding.trim().split(';')[0].trim().toLowerCase();
    return (
        base === 'application/mathml-presentation+xml' ||
        base === 'mathml-presentation'
    );
}

/**
 * @param {Element} semantics
 */
const transformSemantics = (semantics) => {
    if (semantics.localName !== 'semantics' || !isMathMLElement(semantics)) {
        return semantics;
    }

    const first = semantics.firstElementChild;
    if (first && isMathMLElement(first) && !isSemanticsAnnotation(first)) {
        return semantics;
    }

    /** @type {Element|null} */
    let presentation_xml = null;
    for (const el of semantics.children) {
        if (!isMathMLElement(el) || el.localName !== 'annotation-xml') continue;
        if (!isPresentationAnnotationXmlEncoding(el.getAttribute('encoding'))) {
            continue;
        }
        if (el.hasChildNodes()) {
            presentation_xml = el;
            break;
        }
    }

    if (presentation_xml) {
        const frag = document.createDocumentFragment();
        while (presentation_xml.firstChild) {
            frag.appendChild(presentation_xml.firstChild);
        }
        semantics.insertBefore(frag, semantics.firstChild);
        presentation_xml.remove();
        return semantics;
    }

    /** @type {Element|null} */
    let pres = null;
    for (const el of semantics.children) {
        if (!isMathMLElement(el) || isSemanticsAnnotation(el)) continue;
        pres = el;
        break;
    }

    if (pres) {
        semantics.insertBefore(pres, semantics.firstChild);
    }
    return semantics;
};

_MathTransforms.add('math semantics', transformSemantics);
