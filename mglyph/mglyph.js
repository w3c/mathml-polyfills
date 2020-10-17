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
