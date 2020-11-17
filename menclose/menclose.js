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

// Between BORDER_NOTATIONS, MENCLOSE_STYLE, and ARROW_INFO, all valid notation values should be listed
const BORDER_NOTATIONS = ['left', 'right', 'top', 'bottom', 'actuarial', 'madruwb'];

// All special paddings -- anything not listed has implied style "padding: 0.2em"
const MENCLOSE_STYLE = {
  'longdiv': 'padding: 0.05em 0.2em 0.0em 0.433em; border-top: 0.067em solid;',  // top/bottom tweaked smaller than MathJax (was .267/0.2)
  'actuarial': 'padding-top: 0.01em; padding-right: 0.1em;',
  'radical': 'padding-top: 0.403em; padding-bottom: 0.112em; padding-left: 1.02em;',
  'box': 'padding: 0.2em;',       // included because 'box' needs to be listed somewhere
  'roundedbox': 'padding: 0.267em;',
  'circle': 'padding: 0.267em;',
  'phasorangle': 'border-bottom: 0.067em solid; padding: 0.2em 0.2em 0.0em 0.7em;',
  'madruwb': 'padding-bottom: 0.2em; padding-right: 0.2em;',
}

/**
 * The data for strike/arrow notations
 *   [c, angle, double, remove]
 */
const ARROW_INFO = {
  'horizontalstrike':        [0,  0,           false, ''],
  'verticalstrike':          [0,  Math.PI / 2, false, ''],
  'updiagonalstrike':        [-1, 0,           false, ''],
  'downdiagonalstrike':      [ 1, 0,           false, ''],
  'uparrow':                 [0,  -Math.PI / 2,false, 'verticalstrike'],
  'downarrow':               [0,  Math.PI / 2, false, 'verticakstrike'],
  'rightarrow':              [0,  0,           false, 'horizontalstrike'],
  'leftarrow':               [0,  Math.PI,     false, 'horizontalstrike'],
  'updownarrow':             [0,  Math.PI / 2, true,  'verticalstrike uparrow downarrow'],
  'leftrightarrow':          [0,  0,           true,  'horizontalstrike leftarrow rightarrow'],
  'northeastarrow':          [-1, 0,           false, 'updiagonalstrike updiagonalarrow'],
  'southeastarrow':          [ 1, 0,           false, 'downdiagonalstrike'],
  'northwestarrow':          [ 1, Math.PI,     false, 'downdiagonalstrike'],
  'southwestarrow':          [-1, Math.PI,     false, 'updiagonalstrike'],
  'northeastsouthwestarrow': [-1, 0,           true,  'updiagonalstrike northeastarrow updiagonalarrow southwestarrow'],
  'northwestsoutheastarrow': [ 1, 0,           true,  'downdiagonalstrike northwestarrow southeastarrow']
};

const ALL_NOTATIONS = Array.from( new Set(BORDER_NOTATIONS.concat(Object.keys(MENCLOSE_STYLE), Object.keys(ARROW_INFO))) );

/** FIX: from MJ -- make work here */
function removeRedundantNotations() {
  for (const name of Object.keys(this.notations)) {
    if (this.notations[name]) {
      const remove = this.notations[name].remove || '';
      for (const notation of remove.split(/ /)) {
        delete this.notations[notation];
      }
    }
  }
}

/**
 * 
 * @param {HTMLElement} el 
 * @param {string[]} notationArray 
 * @returns {number} -- amount of padding in pixels
 */
function padAmount(el, notationArray) {
  let padding = '0.467em';
  if (notationArray.includes('roundedbox') || notationArray.includes('circle')) {
    padding = '0.601em';
  }
  return convertToPx(el, padding); 
}
/**
 * 
 * @param {HTMLElement} el  // menclose element
 * @returns  
 */
const transformMEnclose = (el) => {
  // Return an <mrow> element representing the menclose element (might have just one child).
  // The idea comes from how MathJax handles menclose (details are a bit different)
  // The basic idea is that each notation value is mapped to an absolutely positioned mrow
  //   with unique classes for each notation value.
  // These are all nested into an mrow that replaces the menclose. The first child of that mrow contains
  //   the contents of the menclose.
  // Subsequent mrows inherit their size from the parent so that their border is the right size.
  // Exceptions are 'radical' and 'longdiv' notations.
  if (window.chrome === null || typeof window.chrome === "undefined") {
    return el;    // Safari and Firefox handle menclose and at least Firefox doesn't deal with the CSS properly
  }
  
  let notationAttrValue = el.getAttribute('notation') || '';
  let notationArray = notationAttrValue.split(' ');

  // get rid of unknown names
  notationArray = notationArray.filter( notation => ALL_NOTATIONS.includes(notation) );

  if (notationArray.length === 0) {
    notationArray.push('longdiv');
  }


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
  const padding = padAmount(el, notationArray);   // FIX: don't hardcode 2*(.2em + 0.0335em) -- get from MENCLOSE_STYLE
  const rect = el.getBoundingClientRect();
  const rectWidth = rect.width + padding;
  const rectHeight = rect.height + padding;

  // now draw lines and arrows around the box
  notationArray.forEach(word => {
    const wordMRow = document.createElementNS(MATHML_NS, 'mrow');
    if (typeof ARROW_INFO[word] !== "undefined") {
      const [c, angle, both, remove] = ARROW_INFO[word];
      const isHorizontal = (angle === 0 || angle === Math.PI);
      const rotate = (c === 0) ? angle : c * (Math.atan2(rectHeight, rectWidth) - angle);

      // if 'word' is an arrow, the arrow heads stick out a pixel (CSS: 'right: -1px", etc), so height/width need to be reduced by a pixel
      let adjustedWidth = rectWidth;
      let adjustedHeight = rectHeight;
      if (/arrow/.test(word)) {
        adjustedWidth--;
        adjustedHeight--;
      }
      const lineLength = (c === 0) ? ( isHorizontal ? adjustedWidth : adjustedHeight ) :
                                     Math.sqrt(adjustedWidth * adjustedWidth + adjustedHeight * adjustedHeight)
      wordMRow.style.width = `${lineLength}px`;
      wordMRow.style.transform = 
          (rotate ? `rotate(${rotate}rad) ` : '') +
          'translate(0.067em, 0.0em';  // FIX: don't hardcode (0.067/2em) -- get from MENCLOSE_STYLE;
      wordMRow.style.left = `${(adjustedWidth - lineLength)/2}px`
    
      const line = document.createElementNS(MATHML_NS, 'mrow');
      line.className = 'line';
      // set border-top-color
      wordMRow.appendChild(line);
  
      if (/arrow/.test(word)) {
        const rthead = document.createElementNS(MATHML_NS, 'mrow');
        rthead.className = 'rthead';
      // set border-left-color
      wordMRow.appendChild(rthead);
  
        const rbhead = document.createElementNS(MATHML_NS, 'mrow');
        rbhead.className = 'rbhead';
      // set border-left-color
      wordMRow.appendChild(rbhead);

        if (both) {     // add other arrowhead
          const lthead = document.createElementNS(MATHML_NS, 'mrow');
          lthead.className = 'lthead';
          // set border-right-color
          wordMRow.appendChild(lthead);
    
          const lbhead = document.createElementNS(MATHML_NS, 'mrow');
          lbhead.className = 'lbhead';
          // set border-right-color
          wordMRow.appendChild(lbhead);  
        }
      }
    } else if (word === 'phasorangle') {
      const rect = el.getBoundingClientRect();
      const rectWidth = convertToPx(el, '.7em');
      const rectHeight = rect.height;
      wordMRow.style.width = `${Math.sqrt(rectWidth * rectWidth + rectHeight * rectHeight)}px`;    // hypotenuse
      wordMRow.style.transform = `rotate(${-Math.atan(rectHeight / rectWidth)}rad)`;
    }

    let paddingStyle = MENCLOSE_STYLE[word] || '';
    if (paddingStyle === '' && mencloseStyle.length === 0) {
      paddingStyle = 'padding: 0.2em;'
    }
    if (!mencloseStyle.includes(paddingStyle)) {
      mencloseStyle += paddingStyle
    }
    wordMRow.className = `menclose-${typeof ARROW_INFO[word] !== "undefined" ? 'arrow' : word}`;
    mencloseMRow.appendChild(wordMRow);
  });

  mencloseMRow.setAttribute('style', mencloseStyle);
  return mencloseMRow;
}

_MathTransforms.add('menclose', transformMEnclose);
