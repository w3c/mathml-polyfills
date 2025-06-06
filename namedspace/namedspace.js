/***
 * Changes namedspaces on lspace and rspace to recommended values.
 * For example, "thinmathspace" -> "0.16666666666666666em"
 ***/
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
import { _MathTransforms } from '../common/math-transforms.js'

/**
 * @param {HTMLElement} el 
 */

// longer keynames first                           
const MATHML_NAMED_SPACES = {
    veryverythinmathspace: "0.05555555555555555em",
    verythinmathspace: "0.1111111111111111em",
    thinmathspace: "0.16666666666666666em",
    veryverythickmathspace: "0.3888888888888889em",
    verythickmathspace:"0.3333333333333333em",
    thickmathspace: "0.2777777777777778em",
    mediummathspace: "0.2222222222222222em",
}
                               
const transformNamedspace = (el) => {
    let attr = el.getAttribute("rspace");
    if(attr){
        for (const [k,v] of Object.entries(MATHML_NAMED_SPACES)) {
            attr = attr.replaceAll(k,v);
        }
        attr=attr.replaceAll("negative0","-0");
        el.setAttribute("rspace", attr);
    }
    attr = el.getAttribute("lspace");
    if(attr){
        for (const [k,v] of Object.entries(MATHML_NAMED_SPACES)) {
            attr = attr.replaceAll(k,v);
        }
        attr=attr.replaceAll("negative0","-0");
        el.setAttribute("lspace", attr);
    }
    return el;
}


// can't use comma to join selectors here it seems
_MathTransforms.add('math *[rspace*="mathspace"]', transformNamedspace);
_MathTransforms.add('math *[lspace*="mathspace"]', transformNamedspace);




