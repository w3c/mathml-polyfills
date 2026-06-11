/***
 * Handles mathsize values "small", "normal", and "big"
***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */
import { _MathTransforms } from '../common/math-transforms.js'

/**
 * @param {HTMLElement} el 
 */
const transformSmall = (el) => {
    // this should only be called when mathsize="small"
    el.setAttribute("mathsize", "75%");
    return el;
}

/**
 * @param {HTMLElement} el 
 */
const transformNormal = (el) => {
    // this should only be called when mathsize="normal"
    el.setAttribute("mathsize", "100%");
    return el;
}

/**
 * @param {HTMLElement} el 
 */
const transformBig = (el) => {
    // this should only be called when mathsize="big"
    el.setAttribute("mathsize", "150%");
    return el;
}

_MathTransforms.add('[mathsize="small"]', transformSmall);
_MathTransforms.add('[mathsize="normal"]', transformNormal);
_MathTransforms.add('[mathsize="big"]', transformBig);
