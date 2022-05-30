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

import { _MathTransforms, cloneElementWithShadowRoot, convertToPx, MATHML_NS } from '../common/math-transforms.js'


/* most of these values are derived from what MathJax uses */
const MENCLOSE_CSS = `
mrow.menclose {
    display: inline-block;
    text-align: left;
    position: relative;
}

/* the following class names should be of the form 'menclose-[notation name]' */
mrow.menclose-longdiv {
    position: absolute;
    top: 0;
    bottom: 0.1em;
    left: -0.4em;
    width: 0.7em;
    border: 0.067em solid;
    transform: translateY(-0.067em);
    border-radius: 70%;
    clip-path: inset(0 0 0 0.4em);
    box-sizing: border-box;
}

mrow.menclose-actuarial {
    position: absolute;
    display: inline-block;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-top: 0.067em solid;
    border-right: 0.067em solid;
}

mrow.menclose-phasorangle {
    display: inline-block;
    left: 0;
    bottom: 0;
    position: absolute;
    border-top: 0.067em solid;
    transform-origin: bottom left;
}

mrow.menclose-phasoranglertl {
    display: inline-block;
    right: 0;
    bottom: 0;
    position: absolute;
    border-top: 0.067em solid;
    transform-origin: bottom right;
}

mrow.menclose-box {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border: 0.067em solid;
}

mrow.menclose-roundedbox {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border: 0.067em solid;
    border-radius: 0.267em;
}

mrow.menclose-circle {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border: 0.067em solid;
    border-radius: 50%;
}

mrow.menclose-box {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border: 0.067em solid;
}

mrow.menclose-left {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-left: 0.067em solid;
}

mrow.menclose-right {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-right: 0.067em solid;
}

mrow.menclose-top {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-top: 0.067em solid;
}

mrow.menclose-bottom {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-bottom: 0.067em solid;
}

mrow.menclose-madruwb {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-right: 0.067em solid;
    border-bottom: 0.067em solid;
}

/*
 * Arrows and 'strikes' are composed of an 'menclose-arrow' wrapper and one, three or five children
 * Strikes just have class 'line'
 * Single-headed arrows have the children with classes 'line', 'rthead' (right top arrow head), and 'rbhead'
 * Double-headed arrows add lthead' (left top arrow head), and 'lbhead'
 */
mrow.menclose-arrow {
    position: absolute;
    left: 0;
    bottom: 50%;
    height: 0;
    width: 0;
}

mrow.menclose > mrow.menclose-arrow > * {
    display: block;
    position: absolute;
    transform-origin: bottom;
    border-left: 0.268em solid;
    border-right: 0;
    box-sizing: border-box;
  }

mrow.menclose-arrow  > mrow.line{
    left: 0;
    top: -0.0335em;
    right: 0.201em;
    height: 0;
    border-top: 0.067em solid;
    border-left: 0;
}

mrow.menclose-arrow > mrow.rthead {
    transform: skewX(0.464rad);
    right: 1px;
    bottom: -1px;
    border-bottom: 1px solid transparent;
    border-top: 0.134em solid transparent;
}

mrow.menclose-arrow > mrow.rbhead {
    transform: skewX(-0.464rad);
    transform-origin: top;
    right: 1px;
    top: -1px;
    border-top: 1px solid transparent;
    border-bottom: 0.134em solid transparent;
}

mrow.menclose-arrow > mrow.lthead {
    transform: skewX(-0.464rad);
    left: 0;
    bottom: -1px;
    border-left: 0;
    border-right: 0.268em solid;
    border-bottom: 1px solid transparent;
    border-top: 0.134em solid transparent;
}

mrow.menclose-arrow > mrow.lbhead {
    transform: skewX(0.464rad);
    transform-origin: top;
    left: 0;
    top: -1px;
    border-left: 0;
    border-right: 0.268em solid;
    border-top: 1px solid transparent;
    border-bottom: 0.134em solid transparent;
}
`



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
  'phasoranglertl': 'border-bottom: 0.067em solid; padding: 0.2em 0.7em 0.0em 0.2em;',
  'madruwb': 'padding-bottom: 0.2em; padding-right: 0.2em;',
}

/**
 * The data for strike/arrow notations
 *   [c, angle, double, remove]
 */
const ARROW_INFO = {
  'horizontalstrike':        [0,  0,           false, ['']],
  'verticalstrike':          [0,  Math.PI / 2, false, ['']],
  'updiagonalstrike':        [-1, 0,           false, ['']],
  'downdiagonalstrike':      [ 1, 0,           false, ['']],
  'uparrow':                 [0,  -Math.PI / 2,false, ['verticalstrike']],
  'downarrow':               [0,  Math.PI / 2, false, ['verticakstrike']],
  'rightarrow':              [0,  0,           false, ['horizontalstrike']],
  'leftarrow':               [0,  Math.PI,     false, ['horizontalstrike']],
  'updownarrow':             [0,  Math.PI / 2, true,  ['verticalstrike', 'uparrow', 'downarrow']],
  'leftrightarrow':          [0,  0,           true,  ['horizontalstrike', 'leftarrow', 'rightarrow']],
  'northeastarrow':          [-1, 0,           false, ['updiagonalstrike', 'updiagonalarrow']],
  'southeastarrow':          [ 1, 0,           false, ['downdiagonalstrike']],
  'northwestarrow':          [ 1, Math.PI,     false, ['downdiagonalstrike']],
  'southwestarrow':          [-1, Math.PI,     false, ['updiagonalstrike']],
  'northeastsouthwestarrow': [-1, 0,           true,  ['updiagonalstrike', 'northeastarrow', 'updiagonalarrow', 'southwestarrow']],
  'northwestsoutheastarrow': [ 1, 0,           true,  ['downdiagonalstrike', 'northwestarrow', 'southeastarrow']]
};

const ALL_NOTATIONS = Array.from( new Set(BORDER_NOTATIONS.concat(Object.keys(MENCLOSE_STYLE), Object.keys(ARROW_INFO))) );

function getWidthOf(mathmlStr) {
  const math = document.createElementNS(MATHML_NS, 'math');
  math.innerHTML = mathmlStr;
  document.body.appendChild(math);
  const width = math.getBoundingClientRect().width;
  document.body.lastElementChild.remove();
  return width;
}

/**
 * 
 * @param {string} notationAttrValue
 * @returns {boolean} -- true if the transform should be used
 */
function useMencloseTransform(notationAttrValue) {
  // Could use browser detection, but that's frowned on/not reliable over time
  // As of 11/2020, the situation is:
  //  chrome/edge -- no menclose support but MathML support if experimental features is on
  //  firefox -- doesn't support arrows, CSS on MathML (hence this code won't work in Firefox), and problems with defaults
  //  safari -- doesn't support radical, phasorangle, arrows CSS on MathML (hence this code won't work in Safari), and problems with defaults

  // Start by seeing if CSS on MathML elements works (try it on mrow since that's what the this transform uses)
  // if (getWidthOf('<math display="block"><mrow><mi>x</mi></mrow></math>') === getWidthOf('<math display="block"><mrow style="border: 100px;"><mi>x</mi></mrow></math>')) {
  //   console.log("CSS not supported on MathML element -- transform skipped.")
  //   return false;   // CSS not supported -- transform won't work
  // }

  // Test if basic support of menclose
  if (getWidthOf('<mi>x</mi>') === getWidthOf('<menclose notation="box"><mi>x</mi></menclose>')) {
    return true;    // doesn't have even basic support
  }

  // Could test all cases, but in practice it is phasorangle and arrows that are not implemented in Safari and Firefox
  //  (actually there are also RTL dir problems, but hopefully they will fix those)
  if (/arrow/.test(notationAttrValue)) {
    if (getWidthOf('<math display="block"><mi>x</mi></math>') === 
        getWidthOf('<math display="block"><menclose notation="rightarrow"><mi>x</mi></menclose></math>')) {
      return true;    // uses an arrow and not supported
    }
  }
  if (/phasorangle/.test(notationAttrValue)) {
    if (getWidthOf('<math display="block"><mi>x</mi></math>') === 
        getWidthOf('<math display="block"><menclose notation="phasorangle"><mi>x</mi></menclose></math>')) {
      return true;    // uses an phasorangle and not supported
    }   
  }
  return false;   // looks like all the notations are supported.
}

/**
 * 
 * @param {string[]} notationArray 
 * @returns {string[]} notationArray
 */
function removeRedundantNotations(notationArray) {
  // remove repeated names
  notationArray = Array.from( new Set(notationArray) );

  if (notationArray.includes('box')) {
    // since all borders are drawn, remove the individual borders
    notationArray = notationArray.filter( notation => !BORDER_NOTATIONS.includes(notation));
  }

  // some more drawing optimizations -- this time using ARROW_INFO
  for (const [notation, values] of Object.entries(ARROW_INFO)) {
    const removeArray = values[3];
    if (removeArray !== [''] && notationArray.includes(notation)) {
      // if there is a 'remove' list and the entry key is a notation to draw...
      notationArray = notationArray.filter( notation => !removeArray.includes(notation) );
    }
  }
  return notationArray;
}

/**
 * 
 * @param {HTMLElement} element 
 * @returns {boolean}
 */
function isDirLTR(element) {
  let lookingForMathElement = true;
  do {
      if (element.hasAttribute('dir')) {
          return element.getAttribute('dir') === 'ltr';
      }
      lookingForMathElement = (element.tagName !== 'math')
      element = element.parentElement;
  } while (lookingForMathElement);
  return true;
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
  
  // Firefox (as of 11/2020) handles menclose (except arrows) and doesn't deal with the CSS properly on MathML elements
  // if (!useMencloseTransform()) {
  //   return el;
  // }

  let notationAttrValue = el.getAttribute('notation') || '';
  if (!useMencloseTransform(notationAttrValue)) {
    return el;
  }

  let notationArray = notationAttrValue.split(' ');

  // get rid of unknown names
  notationArray = notationArray.filter( notation => ALL_NOTATIONS.includes(notation) );

  // if nothing, use the default
  if (notationArray.length === 0) {
    notationArray.push('longdiv');
  }

  // drawing optimizations
  notationArray = removeRedundantNotations(notationArray);

  // handle rtl -- affects only 'radical' (which relies on msqrt) and 'phasorangle'
  // if rtl, we change phasorangle to parosoranglertl and use the css rule
  if (notationArray.includes('phasorangle') && !isDirLTR(el)) {
    const i = notationArray.indexOf('phasorangle');
    notationArray[i] = 'phasoranglertl';
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
    notationArray = notationArray.filter( notation => notation !== 'radical');
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
      const lineLength = (c === 0) ? (isHorizontal ? adjustedWidth : adjustedHeight) :
                                     Math.sqrt(adjustedWidth * adjustedWidth + adjustedHeight * adjustedHeight)
      wordMRow.style.width = `${lineLength}px`;
      wordMRow.style.transform =
          (rotate ? `rotate(${rotate}rad) ` : '') +
          'translate(0.067em, 0.0em)';  // FIX: don't hardcode (0.067/2em) -- get from MENCLOSE_STYLE;
      wordMRow.style.left = `${(adjustedWidth - lineLength) / 2}px`

      const line = document.createElementNS(MATHML_NS, 'mrow');
      line.className = 'line';
      wordMRow.appendChild(line);

      if (/arrow/.test(word)) {
        const rthead = document.createElementNS(MATHML_NS, 'mrow');
        rthead.className = 'rthead';
        wordMRow.appendChild(rthead);

        const rbhead = document.createElementNS(MATHML_NS, 'mrow');
        rbhead.className = 'rbhead';
        wordMRow.appendChild(rbhead);

        if (both) {     // add other arrowhead
          const lthead = document.createElementNS(MATHML_NS, 'mrow');
          lthead.className = 'lthead';
          wordMRow.appendChild(lthead);

          const lbhead = document.createElementNS(MATHML_NS, 'mrow');
          lbhead.className = 'lbhead';
          wordMRow.appendChild(lbhead);
        }
      }
    } else if (word === 'phasorangle' || word === 'phasoranglertl') {
      const rectWidth = convertToPx(el, '.7em');
      const rectHeight = rect.height;
      wordMRow.style.width = `${Math.sqrt(rectWidth * rectWidth + rectHeight * rectHeight)}px`;    // hypotenuse
      wordMRow.style.transform = `rotate(${word === 'phasoranglertl' ? '' : '-'}${Math.atan(rectHeight / rectWidth)}rad) translateY(0.067em)`;
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

_MathTransforms.add('menclose', transformMEnclose, MENCLOSE_CSS);
