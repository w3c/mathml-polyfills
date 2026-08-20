/***
 * Convert mglyph into img element.
 * This conversion should be valid everwhere mglyph is legal.
 ***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

import { _MathTransforms, convertToPx, MATHML_NS } from '../common/math-transforms.js'


/**
 * @param {HTMLElement} el 
 */
const transformMglyph = (el) => {
    // if the attr value contains a pseudo-unit (width, height, depth),
    // these are converted to pixels
    const img = document.createElement("img");
    const attrs = el.attributes;
    for(let i = attrs.length - 1; i >= 0; i--) {
        switch(attrs[i].name) {
            case 'valign':
                img.setAttribute('style', `vertical-align: ${attrs[i].value}`);
                break;
            case 'width':
            case 'height':
                img.setAttribute(attrs[i].name, convertToPx(el.parentElement, attrs[i].value).toString());
                break;
            default:
                img.setAttribute(attrs[i].name, attrs[i].value);
                break;
        }
    }
    return img;
}

_MathTransforms.add('mglyph', transformMglyph);
