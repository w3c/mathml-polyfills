/***
 * Ensures the first child of <semantics> is the presentation MathML fragment.
 * If presentation is only inside <annotation-xml encoding="...">, its children
 * are hoisted to become the first child(ren) of <semantics> (per MathML 4).
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

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
