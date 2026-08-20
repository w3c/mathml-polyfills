/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

import { _MathTransforms } from '../common/math-transforms.js'

/**
 * @param {HTMLElement} el 
 */
const transformThin = (el) => {
    // this should only be called when linethickness="thin"
    el.setAttribute("linethickness", "67%");
    return el;
}

/**
 * @param {HTMLElement} el 
 */
const transformMedium = (el) => {
    // this should only be called when linethickness="medium"
    el.setAttribute("linethickness", "100%");
    return el;
}

/**
 * @param {HTMLElement} el 
 */
const transformThick = (el) => {
    // this should only be called when linethickness="thick"
    el.setAttribute("linethickness", "167%");
    return el;
}

_MathTransforms.add('[linethickness="thin"]', transformThin);
_MathTransforms.add('[linethickness="medium"]', transformMedium);
_MathTransforms.add('[linethickness="thick"]', transformThick);
