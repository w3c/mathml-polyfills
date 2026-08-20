/***
 * Make href work on all MathML elements by adding click, mouseover,
 * and mouseout events
***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

import { _MathTransforms, MATHML_NS } from '../common/math-transforms.js'


/**
 * @param {MathMLElement} el 
 */
const transformHref = (el) => {
    if (el.namespaceURI == MATHML_NS) {
    el.style.cursor="pointer";
    el.tabIndex=0;
    el.setAttribute("role","link");
    el.addEventListener("click", (event) => {
            document.location=event.currentTarget.getAttribute("href");
        });
    el.addEventListener("keydown", (event) => {
        if(event.key=="Enter") document.location=event.currentTarget.getAttribute("href");
        });
    el.addEventListener("mouseover", (event) => {
            event.currentTarget.style.textDecoration="solid underline";
        });
    el.addEventListener("mouseout", (event) => {
            event.currentTarget.style.textDecoration="";
        });
   }
    return el;
}


 _MathTransforms.add('math *[href]', transformHref);

