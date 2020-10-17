// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/*
  Copyright (c) 2020 Neil Soiffer, Talking Cat Software

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

import { _MathTransforms, cloneElementWithShadowRoot, MATHML_NS } from '../common/math-transforms.js'

/**
 * @param {HTMLElement} mpadded
 * @returns {{width:number, height: number: depth: number}}
 */
function getDimensions(mpadded) {
    // Create an mrow around the children of 'mpadded' and add a zero height/depth mspace to them.
    // the y/top/bottom of the mspace is the baseline, so we can find height/depth of el
    // undo the changes to the DOM and return the values
    // Note: the mspace should not cause reflow, so the change/undo hopefully is somewhat efficient
    const mrow = document.createElementNS(MATHML_NS, 'mrow');
    mrow.appendChild( document.createElementNS(MATHML_NS, 'mspace') );
    const cloneMpadded = cloneElementWithShadowRoot(mpadded);
    for (let i = 0; i < cloneMpadded.children.length; i++) {
        mrow.appendChild(cloneMpadded.children[i]);    // removed from clone and added to mrow
    }
    cloneMpadded.appendChild(mrow);
    mpadded.parentElement.replaceChild(cloneMpadded, mpadded);      // should not be reflow

    const mspaceRect = mrow.firstElementChild.getBoundingClientRect();
    const mpaddedRect = mrow.getBoundingClientRect();

    cloneMpadded.parentElement.replaceChild(mpadded, cloneMpadded);      // restore original structure; should not reflow
    return {
        width: mpaddedRect.width,
        height: mspaceRect.y - mpaddedRect.top,
        depth: mpaddedRect.bottom - mspaceRect.y
    };
}
/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {'width'|'height'|'depth'} dimension
 * @param {{width:number, height: number: depth: number}} dimensions
 * @returns {boolean}
 */
function replacePseudoAttr(el, attr, dimension, dimensions) {
    const attrValue = el.getAttribute(attr).toLowerCase();
    if (attrValue.includes(dimension)) {
        const floatVal = parseFloat(attrValue) * dimensions[dimension] / (attrValue.includes('%') ? 100.0 : 1.0);
        el.setAttribute(attr, floatVal.toFixed(1) + 'px');
        return true;
    }
    return false;
}

/**
 * @param {HTMLElement} el
 * @param {attr} align
 * @param {{width:number, height: number: depth: number}} dimensions
 * @returns {boolean}       // true if handled
 */
function handleAttr(el, attr, dimensions) {
    if (!el.hasAttribute(attr)) {
        return false;
    }

    if (replacePseudoAttr(el, attr, 'width', dimensions)) {
        return true;
    }
    if (replacePseudoAttr(el, attr, 'height', dimensions)) {
        return true;
    }
    if (replacePseudoAttr(el, attr, 'depth', dimensions)) {
        return true;
    }

    return false;
}

/**
 * @param {HTMLElement} el 
 */
const transformMpadded = (el) => {
    // if the attr value contains a pseudo-unit (width, height, depth),
    // these are converted to pixels
    const dimensions = getDimensions(el);       // do this before changing the attr values

    handleAttr(el, 'width', dimensions);
    handleAttr(el, 'height', dimensions);
    handleAttr(el, 'depth', dimensions);
    handleAttr(el, 'lspace', dimensions);
    handleAttr(el, 'voffset', dimensions);
    return el;
}

_MathTransforms.add('mpadded', transformMpadded);
