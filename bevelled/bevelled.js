/***
 * Handles the "bevelled" attribute on mfrac
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

import { _MathTransforms, convertToPx, MATHML_NS, measureInDetachedMath } from '../common/math-transforms.js'

/**
 * MathML / HTML boolean for `bevelled` (ASCII case-insensitive; empty = true when attribute present).
 * @param {Element} el
 * @returns {boolean}
 */
function isBevelledTrue(el) {
    if (!el.hasAttribute('bevelled')) return false;
    const raw = el.getAttribute('bevelled');
    if (raw == null) return false;
    const v = raw.trim();
    if (v === '') return true;
    const t = v.toLowerCase();
    if (t === 'false' || t === '0' || t === 'no') return false;
    if (t === 'true' || t === 'yes' || t === '1') return true;
    return false;
}

/**
 * @param {HTMLElement} mfrac
 */
const transformBevelled = (mfrac) => {
    if (!isBevelledTrue(mfrac)) return mfrac;
    if (mfrac.childElementCount !== 2) return mfrac;

    const numerator = mfrac.children[0];
    const denominator = mfrac.children[1];

    // Return an <mrow> element representing the bevelled fraction.
    // The numerator is shifted up 0.5em.
    const shiftAmount = convertToPx(numerator, '0.5em');

    const numeratorStyle = document.createElementNS(MATHML_NS, 'mstyle');
    numeratorStyle.setAttribute('displaystyle', 'false');
    numeratorStyle.setAttribute('scriptlevel', '+1');
    numeratorStyle.appendChild(numerator);

    const denominatorStyle = document.createElementNS(MATHML_NS, 'mstyle');
    denominatorStyle.setAttribute('displaystyle', 'false');
    denominatorStyle.setAttribute('scriptlevel', '+1');
    denominatorStyle.appendChild(denominator);

    // Measure each (in script style) so we can size the slash and the outer mpadded depth.
    const numDims = measureInDetachedMath(numeratorStyle);
    const denDims = measureInDetachedMath(denominatorStyle);
    const height = Math.max(numDims.height, denDims.height) + shiftAmount;

    const shiftedNumeratorHeight = numDims.height + shiftAmount;
    const slashMaxSize = Math.max(
        Math.max(shiftedNumeratorHeight, denDims.height),
        Math.max(numDims.depth + shiftAmount, denDims.depth)
    );

    const mrow = document.createElementNS(MATHML_NS, 'mrow');

    const mpadded = document.createElementNS(MATHML_NS, 'mpadded');
    mpadded.setAttribute('height', `${shiftedNumeratorHeight}px`);
    mpadded.setAttribute('depth', `${numDims.depth - shiftAmount}px`);
    mpadded.setAttribute('voffset', `${shiftAmount}px`);
    mpadded.appendChild(numeratorStyle);
    mrow.appendChild(mpadded);

    const slash = document.createElementNS(MATHML_NS, 'mo');
    slash.setAttribute('stretchy', 'true');
    slash.setAttribute('maxsize', `${Math.round(slashMaxSize)}px`);
    slash.setAttribute('symmetric', 'false');
    slash.setAttribute('lspace', '0px');
    slash.setAttribute('rspace', '0px');

    // looks like a bug in Chrome (https://github.com/w3c/mathml-core/issues/323) that makes the slash too wide -- setting the margins compensates but makes Firefox look bad (too tight)
    // const inset = Math.round(-0.02 * height);
    // slash.setAttribute('style', `margin-left: ${inset}px; margin-right: ${inset}px`);
    slash.appendChild(document.createTextNode('/'));
    mrow.appendChild(slash);

    mrow.appendChild(denominatorStyle);

    const mrowDims = measureInDetachedMath(mrow);

    const outerMpadded = document.createElementNS(MATHML_NS, 'mpadded');
    const downShift = shiftAmount / 2;
    outerMpadded.setAttribute('voffset', `${-downShift}px`);
    outerMpadded.setAttribute('height', `${Math.max(0, height - downShift)}px`);
    outerMpadded.setAttribute('depth', `${mrowDims.depth - shiftAmount}px`);
    outerMpadded.appendChild(mrow);
    return outerMpadded;
}

_MathTransforms.add('mfrac[bevelled]', transformBevelled);
