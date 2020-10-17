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
 * @param {HTMLElement} child
 * @returns {number}
 */
function getChildWidth(child) {
    return child.getBoundingClientRect().width;
}

/**
 * Handles left/right alignment by creating an mspace of the appropriate width
 *   on either the left or right side.
 * For something like a fraction numerator, 'child' is the numerator and 'maxWidth'
 *   is the denominator's width
 * @param {HTMLElement} child
 * @param {number} childWidth
 * @param {string} align
 * @param {number} maxWidth
 * @returns {HTMLElement}
 */
function doAlignment(child, childWidth, align, maxWidth) {
    if (childWidth >= maxWidth || align === 'center') {
        return child;
    }

    // need to wrap child with mrow if it is not one already
    if (child.tagName !== 'mrow') {
        const sibling = child.nextElementSibling;
        const mrow = document.createElementNS(MATHML_NS, 'mrow');
        const parent = child.parentElement;
        mrow.appendChild(child);
        parent.insertBefore(mrow, sibling);
        child = mrow;
    }

    let mspace = document.createElementNS(MATHML_NS, 'mspace');
    mspace.setAttribute('width', `${(maxWidth - childWidth).toPrecision(2)}px`);
    if (align === 'left') {
        child.appendChild(mspace);
    } else if (align === 'right') {
        child.insertBefore(mspace, child.firstElementChild);
    }
    return child;

}
/**
 * @param {HTMLElement} el
 * @param {number} iChild
 * @param {number} iOther
 * @param {string} attr
 * @returns {HTMLElement}
 */
function alignChild(el,iChild, iOther, attr) {
    doAlignment(el.children[iChild], getChildWidth(el.children[iChild]), el.getAttribute(attr),  getChildWidth(el.children[iOther]));
    return el;
}

/**
 * @param {HTMLElement} mfrac 
 */
const transformNumerator = (mfrac) => {
    return alignChild(mfrac, 0, 1, 'numalign');
}

/**
 * @param {HTMLElement} mfrac 
 */
const transformDenominator = (mfrac) => {
    return alignChild(mfrac, 1, 0, 'denomalign');
}

/**
 * @param {HTMLElement} el 
 */
const transformMunderAndMover = (el) => {
    return alignChild(el, 1, 0, 'align');
}

/**
 * @param {HTMLElement} el 
 */
const transformMunderover = (el) => {
    const align = el.getAttribute('align');
    const baseWidth = getChildWidth(el.children[0]);
    const underWidth = getChildWidth(el.children[1]);
    const overWidth = getChildWidth(el.children[2]);
    const maxWidth = Math.max(baseWidth, underWidth, overWidth);

    doAlignment(el.children[1], underWidth, align, maxWidth);
    doAlignment(el.children[2], overWidth, align, maxWidth);
    return el;
}

_MathTransforms.add('mfrac[numalign]', transformNumerator);
_MathTransforms.add('mfrac[denomalign]', transformDenominator);

_MathTransforms.add('munder[align]', transformMunderAndMover);
_MathTransforms.add('mover[align]', transformMunderAndMover);
_MathTransforms.add('munderover[align]', transformMunderover);
