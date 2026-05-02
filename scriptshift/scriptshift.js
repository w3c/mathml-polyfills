/***
 * Polyfills subscriptshift / superscriptshift on msub, msup, msubsup (MathML Full).
 * Uses mpadded + voffset; lengths resolved via convertToPx on the script element.
 * Inner line-ascent / line-descent are measured so height and/or depth grow by the same amount as |voffset|.
 * Spec: minimum shift vs UA default; here the resolved length is applied as extra shift when the UA ignores these attributes.
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

import { _MathTransforms, convertToPx, MATHML_NS, getMathDimensions } from '../common/math-transforms.js'

/**
 * @param {'down' | 'up'} dir subscript baseline down vs superscript baseline up
 * @param {HTMLElement} scriptEl
 * @param {number} shiftPx
 */
function wrapScriptWithShift(scriptEl, shiftPx, dir) {
    if (!Number.isFinite(shiftPx) || shiftPx <= 0) return;
    const mpadded = document.createElementNS(MATHML_NS, 'mpadded');
    const parent = scriptEl.parentElement;
    if (!parent) return;
    parent.insertBefore(mpadded, scriptEl);
    mpadded.appendChild(scriptEl);

    const inner = getMathDimensions(mpadded);
    // Positive voffset moves ink toward line-over (up); subscript down => negative voffset and extra depth.
    const heightPx = Math.max(0, inner.height + (dir === 'up' ? shiftPx : 0));
    const depthPx = Math.max(0, inner.depth + (dir === 'down' ? shiftPx : 0));
    const v = dir === 'down' ? -shiftPx : shiftPx;

    mpadded.setAttribute('height', `${heightPx.toFixed(2)}px`);
    mpadded.setAttribute('depth', `${depthPx.toFixed(2)}px`);
    mpadded.setAttribute('voffset', `${v.toFixed(2)}px`);
}

/**
 * @param {HTMLElement} el
 * @param {number} index
 * @param {string} attrName
 * @param {'down' | 'up'} dir
 */
function applyShiftAttr(el, index, attrName, dir) {
    if (!el.hasAttribute(attrName)) return;
    const raw = el.getAttribute(attrName);
    if (raw == null || !raw.trim()) {
        el.removeAttribute(attrName);
        return;
    }
    const scriptEl = el.children[index];
    if (!scriptEl) return;
    const px = convertToPx(scriptEl, raw.trim());
    el.removeAttribute(attrName);
    wrapScriptWithShift(scriptEl, px, dir);
}

/**
 * @param {HTMLElement} msub
 */
const transformMsub = (msub) => {
    if (msub.childElementCount !== 2) return msub;
    applyShiftAttr(msub, 1, 'subscriptshift', 'down');
    return msub;
};

/**
 * @param {HTMLElement} msup
 */
const transformMsup = (msup) => {
    if (msup.childElementCount !== 2) return msup;
    applyShiftAttr(msup, 1, 'superscriptshift', 'up');
    return msup;
};

/**
 * @param {HTMLElement} el
 */
const transformMsubsup = (el) => {
    if (el.childElementCount !== 3) return el;
    if (!el.hasAttribute('subscriptshift') && !el.hasAttribute('superscriptshift')) {
        return el;
    }
    applyShiftAttr(el, 1, 'subscriptshift', 'down');
    applyShiftAttr(el, 2, 'superscriptshift', 'up');
    return el;
};

_MathTransforms.add('msub[subscriptshift]', transformMsub);
_MathTransforms.add('msup[superscriptshift]', transformMsup);
_MathTransforms.add('msubsup[subscriptshift]', transformMsubsup);
_MathTransforms.add('msubsup[superscriptshift]', transformMsubsup);
