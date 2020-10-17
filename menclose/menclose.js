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

import { _MathTransforms, cloneElementWithShadowRoot, convertToPx, MATHML_NS } from '../common/math-transforms.js'

const BORDER_NOTATIONS = ['left', 'right', 'top', 'bottom', 'actuarial'];

const MENCLOSE_STYLE = {
  'longdiv': 'padding: 0.05em 0.2em 0.0em 0.433em; border-top: 0.067em solid;',  // top/bottom tweaked smaller than MathJax (was .267/0.2)
  'actuarial': 'padding-top: 0.01em; padding-right: 0.1em;',
  'radical': 'padding-top: 0.403em; padding-bottom: 0.112em; padding-left: 1.02em;',
  'box': 'padding: 0.2em;',
  'roundedbox': 'padding: 0.267em;',
  'circle': 'padding: 0.267em;',
  'left': 'padding-left: 0.2em;',
  'right': 'padding-right: 0.2em;',
  'top': 'padding-top: 0.2em;',
  'bottom': 'padding-bottom: 0.2em;',
  'updiagonalstrike': 'padding: 0.267em;',
  'downdiagonalstrike': 'padding: 0.267em;',
  'verticalstrike': 'padding-top: 0.2em; padding-bottom: 0.2em;',
  'horizontalstrike': 'padding-left: 0.2em; padding-right: 0.2em;',
  'phasorangle': 'border-bottom: 0.067em solid; padding: 0.1em 0.1em 0.1em 0.7em;',
  'madruwb': 'padding-bottom: 0.2em; padding-right: 0.2em;',
}

/**
 * 
 * @param {HTMLElement} el  // menclose element
 * @returns  
 */
const transformMEnclose = (el) => {
  // Return an <mrow> element representing the menclose element (might have just one child).
  // The idea comes from how MathJax handles menclose (details are different)
  // The basic idea is that each notation value is mapped to an absolutely positioned mrow
  //   with unique classes for each notation value.
  // These are all nested into an mrow that replaces the menclose. The first child of that mrow containing
  //   the contents of the menclose.
  // Subsequent mrows inherit their size from the parent so that their border is the right size.
  // Exceptions are 'radical' and 'longdiv' notations.
  if (window.chrome === null || typeof window.chrome === "undefined") {
    return el;    // Safari and Firefox handle menclose and at least Firefox doesn't deal with the CSS properly
  }
  
  let notationAttrValue = el.getAttribute('notation');
  if (notationAttrValue === null) {
    notationAttrValue = 'longdiv';
  }
  let notationArray = notationAttrValue.split(' ');
  if (notationArray.includes('box')) {
    // some optimization -- since all borders are drawn, remove the individual borders
    notationArray = notationArray.filter( notation => !BORDER_NOTATIONS.includes(notation));
  }

  // create the mrow that contains the children of the menclose
  const childrenMRow = document.createElementNS(MATHML_NS, 'mrow');
  let child = el.firstElementChild;
  while (child) {
    childrenMRow.appendChild(cloneElementWithShadowRoot(child));
    child = child.nextElementSibling;
  }
  //childrenMRow.style.padding = '3px';
  //childrenMRow.style.margin ='2px';

 // create the mrow container that represents the menclose
  const mencloseMRow = document.createElementNS(MATHML_NS, 'mrow');
  mencloseMRow.className = 'menclose';
  mencloseMRow.appendChild(childrenMRow);

  // deal with the oddball value of radical (use msqrt)
  if (notationArray.includes('radical')) {
    const msqrt = document.createElementNS(MATHML_NS, 'msqrt');
    msqrt.appendChild(mencloseMRow.firstElementChild);
    mencloseMRow.appendChild(msqrt);
    notationArray = notationArray.filter( notation => !notationArray.includes('radical'));

  }

  let mencloseStyle = '';
  const boundingRect = el.getBoundingClientRect();
  // now draw lines and arrows around the box
  notationArray.forEach(word => {
    const wordMRow = document.createElementNS(MATHML_NS, 'mrow');
    if (word === 'updiagonalstrike' || word === 'downdiagonalstrike') {
      const padding = convertToPx(el, '.467em');   // FIX: don't hardcode (2em + 2em + 0.067em) -- get from MENCLOSE_STYLE
      const rect = el.getBoundingClientRect();
      const rectWidth = rect.width + padding;
      const rectHeight = rect.height + padding;
      const hypotenuse = Math.sqrt(rectWidth * rectWidth + rectHeight * rectHeight)
      wordMRow.style.width = `${hypotenuse}px`;    // hypotenuse
      wordMRow.style.transform = 
        `rotate(${(word === 'updiagonalstrike' ? -1 : 1) * Math.atan(rectHeight / rectWidth)}rad) ` +
        `translate(0.0335em, ${word === 'updiagonalstrike' ? '': '-'}0.0335em)`;  // FIX: don't hardcode (0.067/2em) -- get from MENCLOSE_STYLE
    } else if (word === 'phasorangle') {
      const rect = el.getBoundingClientRect();
      const rectWidth = convertToPx(el, '.7em');
      const rectHeight = rect.height;
      wordMRow.style.width = `${Math.sqrt(rectWidth * rectWidth + rectHeight * rectHeight)}px`;    // hypotenuse
      wordMRow.style.transform = `rotate(${-Math.atan(rectHeight / rectWidth)}rad)` +
                                 `translate(-0.067em, 0.0335em)`;
      /*
        width: 2.338em;
        transform: translateX(0.06em) rotate(-1.421rad);
      */
    }

    if (MENCLOSE_STYLE[word] !== null) {
      mencloseStyle += MENCLOSE_STYLE[word];
    }
    wordMRow.className = `menclose-${word}`;
    mencloseMRow.appendChild(wordMRow);
  });

  mencloseMRow.setAttribute('style', mencloseStyle);
  return mencloseMRow;
}

_MathTransforms.add('menclose', transformMEnclose);
