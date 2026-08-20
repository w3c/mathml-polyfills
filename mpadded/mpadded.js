/***
 * Handles width/height/depth attributes with % values for mpadded
 ***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

import { _MathTransforms, getMathDimensions } from '../common/math-transforms.js'

/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {'width'|'height'|'depth'} dimension
 * @param {{ width: number, height: number, depth: number }} dimensions
 * @returns {boolean}
 */
function replacePseudoAttr(el, attr, dimension, dimensions) {
    const raw = el.getAttribute(attr);
    if (raw == null) return false;
    const attrValue = raw.toLowerCase();
    if (attrValue.includes(dimension)) {
        const floatVal = parseFloat(attrValue) * dimensions[dimension] / (attrValue.includes('%') ? 100.0 : 1.0);
        el.setAttribute(attr, floatVal.toFixed(1) + 'px');
        return true;
    }
    return false;
}

/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {{ width: number, height: number, depth: number }} dimensions
 * @returns {boolean} true if handled
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
    const dimensions = getMathDimensions(el);       // do this before changing the attr values

    handleAttr(el, 'width', dimensions);
    handleAttr(el, 'height', dimensions);
    handleAttr(el, 'depth', dimensions);
    handleAttr(el, 'lspace', dimensions);
    handleAttr(el, 'voffset', dimensions);
    return el;
}

_MathTransforms.add('mpadded', transformMpadded);
