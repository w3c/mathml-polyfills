// @ts-check
/***
 * Converts mfenced to the equivalent mrows (MathML 4, 3.3.8):
 * https://w3c.github.io/mathml/#presm_mfenced
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

import { _MathTransforms, MATHML_NS } from '../common/math-transforms.js'

/** Attributes that only mfenced has. All others (the presentation attributes, including dir) are copied to the mrow. */
const MFENCED_ONLY_ATTRIBUTES = ['open', 'close', 'separators'];

/**
 * Trims and collapses whitespace as MathML does for the content of an mo.
 * Whitespace means space, tab, newline and carriage return only:
 * https://w3c.github.io/mathml/#fund_collapse
 * @param {string} text
 * @returns {string}
 */
function collapseWhiteSpace(text) {
    return text.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '').replace(/[ \t\n\r]+/g, ' ');
}

/**
 * @param {string} text
 * @param {'fence' | 'separator'} role
 * @returns {Element} `<mo fence="true">text</mo>` or `<mo separator="true">text</mo>`
 */
function newOperator(text, role) {
    const operator = document.createElementNS(MATHML_NS, 'mo');
    operator.textContent = text;
    operator.setAttribute(role, 'true');
    return operator;
}

/**
 * The value of `open` or `close`. A missing attribute gets the default; one that
 * is present but empty (`open=""`) means no fence.
 * @param {Element} mfenced
 * @param {string} name
 * @param {string} defaultValue
 * @returns {string}
 */
function getFence(mfenced, name, defaultValue) {
    const value = mfenced.getAttribute(name);
    return collapseWhiteSpace(value === null ? defaultValue : value);
}

/**
 * The separator characters, ignoring whitespace. `Array.from()` splits by code
 * point, so a character outside the BMP stays one separator.
 * @param {string | null} separators - The `separators` attribute (default ",").
 * @returns {string[]}
 */
function getSeparators(separators) {
    return Array.from(separators === null ? ',' : separators).filter(c => !/[ \t\n\r]/.test(c));
}

/**
 * Returns an mrow equivalent to `mfenced`:
 *   <mrow> <mo fence="true">open</mo>
 *          <mrow> arg#1 <mo separator="true">sep#1</mo> ... arg#n </mrow>
 *          <mo fence="true">close</mo> </mrow>
 * The inner mrow is only used when there is more than one argument.
 * An empty fence (open="" or close="") is left out rather than written as an
 * empty mo: browsers give an empty mo operator spacing, which shows up as a gap.
 * The arguments are moved, not copied, so they keep their event listeners and
 * shadow roots (for example from maction and elementary math).
 * @param {Element} mfenced
 * @returns {Element}
 */
const expandFencedElement = (mfenced) => {
    const mrow = document.createElementNS(MATHML_NS, 'mrow');
    for (const attribute of mfenced.attributes) {
        if (attribute.namespaceURI || !MFENCED_ONLY_ATTRIBUTES.includes(attribute.localName)) {
            mrow.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
        }
    }

    const open = getFence(mfenced, 'open', '(');
    if (open) {
        mrow.appendChild(newOperator(open, 'fence'));
    }

    const args = Array.from(mfenced.children);
    if (args.length === 1) {
        mrow.appendChild(args[0]);
    } else if (args.length > 1) {
        const separators = getSeparators(mfenced.getAttribute('separators'));
        const inner = document.createElementNS(MATHML_NS, 'mrow');
        args.forEach((arg, i) => {
            if (i > 0 && separators.length > 0) {
                // Extra separators are ignored; if there are too few, the last one is repeated.
                inner.appendChild(newOperator(separators[Math.min(i - 1, separators.length - 1)], 'separator'));
            }
            inner.appendChild(arg);
        });
        mrow.appendChild(inner);
    }

    const close = getFence(mfenced, 'close', ')');
    if (close) {
        mrow.appendChild(newOperator(close, 'fence'));
    }
    return mrow;
};

_MathTransforms.add('mfenced', expandFencedElement);
