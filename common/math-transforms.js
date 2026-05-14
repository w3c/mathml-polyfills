// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */


export const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

/*
    A really basic implementation, this will be a module.
 */
  export const _MathTransforms = {
    _plugins: new Map(),
    _css: '',
    _createStyleSheet: str => {
      if (str.length !== _MathTransforms.cssKey) {    // always true the first time because _MathTransforms.cssKey is undefined
        _MathTransforms.cssKey = str.length;
        const style = document.createElement ( 'style' );
        style.textContent = str;
        document.head.appendChild ( style );
        _MathTransforms.styleSheet = style      // cached stylesheet
        document.head.removeChild ( style );
      }
      return _MathTransforms.styleSheet
    },

    getCSSStyleSheet: () => {const foo = _MathTransforms._createStyleSheet(_MathTransforms._css).cloneNode(true); 
    return foo; },

    transform: root => {
      for (const selector of _MathTransforms._plugins.keys()) {
        let transformer = _MathTransforms._plugins.get(selector);

        // find the matching elements..
        // this is problematic since you could add some
        let matches = Array.from(root.querySelectorAll(selector));

        // Since these are in tree-order, if we process them in reverse order (child first)
        // we should side-step the gnarliest of potential nesting issues
        matches.reverse().forEach(el => {
          let transformed = transformer(el);
          if (transformed && transformed !== el) {
            el.parentElement.replaceChild(transformed, el);
          }
        });
      }
    },
  
    add: (selector, cb, css='') => {
      _MathTransforms._plugins.set(selector, cb);
      _MathTransforms._css += css;
    }
  };


/**
 * Same as cloneNode(true) except that shadow roots are copied
 * If you are using the transforms and you need to clone a node that potentially has a shadowRoot, use this so the shadowRoot is copied
 * As of November, 2020, Elementary Math and Linebreaking transforms are the only transforms that have shadowRoots. 
 * @param {Element} el 
 * @param {Element} [clone] 
 * @returns {Element} -- the clone (only useful if function is called with one arg)
 */
export function cloneElementWithShadowRoot(el, clone) {
  if (clone === undefined) {
      clone = el.cloneNode(true);
  }

  // rather than clone each element and then the children, we're assuming cloning the whole tree is most efficient
  // however, we still need to search 'el' to check for a shadowRoot.
  if (el.shadowRoot) {
      let shadowRoot = clone.attachShadow({ mode: "open" });
      shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
      for (let i = 0; i < el.shadowRoot.childElementCount; i++) {
        shadowRoot.appendChild( cloneElementWithShadowRoot(el.shadowRoot.children[i]) )
      }
  }

  for (let i = 0; i < el.childElementCount; i++) {
      cloneElementWithShadowRoot(el.children[i], clone.children[i]);
  }

  return clone;
}

/**
 * @typedef {Object} MathDimensions
 * @property {number} width  width in CSS pixels
 * @property {number} height ascent above the baseline in CSS pixels
 * @property {number} depth  descent below the baseline in CSS pixels
 */

/**
 * Force layout of {@code el} so subsequent {@code getBoundingClientRect}-style reads see fresh boxes.
 * Reading {@code offsetHeight} flushes pending layout for the relevant subtree.
 * @param {Element} el
 * @returns {void}
 */
export function forceLayout(el) {
  // @ts-ignore - reading offsetHeight for its side effect (forced reflow)
  void /** @type {HTMLElement} */ (el).offsetHeight;
}

/**
 * Measure the line-box dimensions of an in-DOM element by temporarily wrapping its children
 * with {@code <mrow><mspace/>…children…</mrow>}. The {@code mspace}'s top is the baseline,
 * so we can split the bounding box into ascent ({@code height}) and descent ({@code depth}).
 *
 * The element is replaced with a clone for the measurement and restored afterward; both swaps
 * are within a single tick so they should not visibly reflow.
 * @param {Element} el element already attached to the document
 * @returns {MathDimensions}
 */
export function getMathDimensions(el) {
  if (!el || !el.parentElement) {
    return { width: 0, height: 0, depth: 0 };
  }
  const mrow = document.createElementNS(MATHML_NS, 'mrow');
  mrow.appendChild(document.createElementNS(MATHML_NS, 'mspace'));
  const clone = cloneElementWithShadowRoot(el);
  while (clone.children.length > 0) {
    mrow.appendChild(clone.children[0]); // moves out of clone into mrow
  }
  clone.appendChild(mrow);
  const parent = el.parentElement;
  parent.replaceChild(clone, el);

  const mspace = /** @type {Element} */ (mrow.firstElementChild);
  const mspaceRect = mspace.getBoundingClientRect();
  const outerRect = mrow.getBoundingClientRect();

  parent.replaceChild(el, clone);

  return {
    width: outerRect.width,
    height: mspaceRect.y - outerRect.top,
    depth: outerRect.bottom - mspaceRect.y,
  };
}

/**
 * Measure {@code el} when it is not (yet) in the document by mounting it inside a hidden
 * {@code <math display="block">}, optionally with a leading {@code <mspace>} probe so the
 * baseline can be located. The element is detached and the probe removed before returning.
 * @param {Element} el element to measure (will be appended into the hidden math, then detached)
 * @param {{ withMspaceProbe?: boolean }} [options]
 *   {@code withMspaceProbe} (default {@code true}): include a leading {@code mspace} sibling so
 *   {@code height} / {@code depth} are split at the baseline. With {@code false}, {@code depth} is 0.
 * @returns {MathDimensions}
 */
export function measureInDetachedMath(el, options) {
  const withMspaceProbe = !options || options.withMspaceProbe !== false;
  const math = document.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'block');
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mrow = document.createElementNS(MATHML_NS, 'mrow');
  /** @type {Element | null} */
  let mspace = null;
  if (withMspaceProbe) {
    mspace = document.createElementNS(MATHML_NS, 'mspace');
    mrow.appendChild(mspace);
  }
  mrow.appendChild(el);
  math.appendChild(mrow);
  document.body.appendChild(math);
  forceLayout(math);

  const elRect = el.getBoundingClientRect();
  /** @type {MathDimensions} */
  let dims;
  if (mspace) {
    const baselineY = mspace.getBoundingClientRect().y;
    dims = {
      width: elRect.width,
      height: Math.max(0, baselineY - elRect.top),
      depth: Math.max(0, elRect.bottom - baselineY),
    };
  } else {
    dims = { width: elRect.width, height: elRect.height, depth: 0 };
  }

  el.remove();
  math.remove();
  return dims;
}

/**
 * Converts a CSS length unit to pixels and returns that as a number
 * @param{Element} element
 * @param {string} length 
 * @returns {number}
 */
export function convertToPx(element, length) {
  // quick check to see if we have common case of 'px'
  if (/px/.test(length)) {
      return parseFloat(length);
  }

  // add a temp element with desired length; set it as the width; record the width, then delete the temp element.
  // In Safari (Aug 2020), unknown elements in MathML are thrown out, so adding a 'div' results in 0 width. For some reason, 'img' is ok.
  let img = document.createElement("img");  // create temporary element
  let leafWrapper = document.createElementNS(MATHML_NS, 'mtext'); // mtext is integration point for HTML
  leafWrapper.appendChild(img);
  leafWrapper.style.overflow = "hidden";
  leafWrapper.style.visibility = "hidden";
  img.style.width = length;
  element.appendChild(leafWrapper);
  const result = leafWrapper.getBoundingClientRect().width;
  leafWrapper.remove();

  return result;
}

