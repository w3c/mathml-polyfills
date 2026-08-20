/***
 * Handles lquote and rquote attrs on ms by replacing with mtext (MathML Core).
 ***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

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
