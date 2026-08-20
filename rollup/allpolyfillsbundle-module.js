// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */

/* See the file ../LICENSE.txt for the LICENSE of this file. */

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

/*
    A really basic implementation, this will be a module.
 */
  const _MathTransforms = {
    _plugins: new Map(),
    _css: '',
    _createStyleSheet: str => {
      if (str.length !== _MathTransforms.cssKey) {    // always true the first time because _MathTransforms.cssKey is undefined
        _MathTransforms.cssKey = str.length;
        const style = document.createElement ( 'style' );
        style.textContent = str;
        document.head.appendChild ( style );
        _MathTransforms.styleSheet = style;      // cached stylesheet
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
function cloneElementWithShadowRoot(el, clone) {
  if (clone === undefined) {
      clone = el.cloneNode(true);
  }

  // rather than clone each element and then the children, we're assuming cloning the whole tree is most efficient
  // however, we still need to search 'el' to check for a shadowRoot.
  if (el.shadowRoot) {
      let shadowRoot = clone.attachShadow({ mode: "open" });
      shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
      for (let i = 0; i < el.shadowRoot.childElementCount; i++) {
        shadowRoot.appendChild( cloneElementWithShadowRoot(el.shadowRoot.children[i]) );
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
function forceLayout(el) {
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
function getMathDimensions(el) {
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
function measureInDetachedMath(el, options) {
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
  {
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
function convertToPx(element, length) {
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

/***
 * Convert mglyph into img element.
 * This conversion should be valid everwhere mglyph is legal.
 ***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */



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
};

_MathTransforms.add('mglyph', transformMglyph);

/***
 * Converts mfenced to the equivalent mrows.
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


const namespaceURI = "http://www.w3.org/1998/Math/MathML";

function collapseWhiteSpace$1(text) {
    // Collapse the whitespace as specified by the MathML specification.
    // https://w3c.github.io/mathml/chapter2.html#fund.collapse
    return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
}

function newOperator(text, separator) {
    // Create <mo fence="true">text</mo> or <mo separator="true">text</mo>.
    let operator = document.createElementNS(namespaceURI, "mo");
    operator.appendChild(document.createTextNode(text));
    operator.setAttribute("fence", "true");
    return operator;
}

function newMrow() {
    // Create an empty <mrow>.
    return document.createElementNS(namespaceURI, "mrow");
}

function getSeparatorList(text) {
    // Split the separators attribute into a list of characters.
    // We ignore whitespace and handle surrogate pairs.
    if (text === null) {
        return [","];
    }
    let separatorList = [];
    for (let i = 0; i < text.length; i++) {
        if (!/\s/g.test(text.charAt(i))) {
            let c = text.charCodeAt(i);
            if (c >= 0xD800 && c < 0xDC00 && i + 1 < text.length) {
                separatorList.push(text.substr(i, 2));
                i++;
            } else {
                separatorList.push(text.charAt(i));
            }
        }
    }
    return separatorList;
}

function shouldCopyAttribute(attribute) {
    // The <mfenced> and <mrow> elements have the same attributes except
    // that dir is only accepted on <mrow> and open/close/separators are
    // only accepted on <mfenced>.
    // https://w3c.github.io/mathml/appendixa.html#parsing.rnc.pres
    const excludedAttributes = ["dir", "open", "close", "separators"];
    return attribute.namespaceURI || !excludedAttributes.includes(attribute.localName);
}

const expandFencedElement = (mfenced) => {
    // Return an <mrow> element representing the expanded <mfenced>.
    // https://w3c.github.io/mathml/chapter3.html#presm.mfenced
    let outerMrow = newMrow();
    outerMrow.appendChild(newOperator(collapseWhiteSpace$1(mfenced.getAttribute("open") || "(")));
    if (mfenced.childElementCount === 1) {
        outerMrow.appendChild(cloneElementWithShadowRoot(mfenced.firstElementChild));
    } else if (mfenced.childElementCount > 1) {
        let separatorList = getSeparatorList(mfenced.getAttribute("separators")),
            innerMrow = newMrow(),
            child = mfenced.firstElementChild;
        while (child) {
            innerMrow.appendChild(cloneElementWithShadowRoot(child));
            child = child.nextElementSibling;
            if (child && separatorList.length) {
                innerMrow.appendChild(newOperator(separatorList.length >  1 ? separatorList.shift() : separatorList[0]));
            }
        }
        outerMrow.appendChild(innerMrow);
    }
    outerMrow.appendChild(newOperator(collapseWhiteSpace$1(mfenced.getAttribute("close") || ")")));
    for (let i = 0; i < mfenced.attributes.length; i++) {
        let attribute = mfenced.attributes[i];
        if (shouldCopyAttribute(attribute)) {
            outerMrow.setAttributeNS(attribute.namespaceURI, attribute.localName, attribute.value);
        }
    }
    return outerMrow;
};

_MathTransforms.add('mfenced', expandFencedElement);

/***
 * Ensures the first child of <semantics> is the presentation MathML fragment.
 * If presentation is only inside <annotation-xml encoding="...">, its children
 * are hoisted to become the first child(ren) of <semantics> (per MathML 4).
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/**
 * @param {Element} el
 * @returns {boolean}
 */
function isMathMLElement(el) {
    return el.namespaceURI === MATHML_NS;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isSemanticsAnnotation(el) {
    if (!isMathMLElement(el)) return false;
    const n = el.localName;
    return n === 'annotation' || n === 'annotation-xml';
}

/**
 * @param {string|null} encoding
 * @returns {boolean}
 */
function isPresentationAnnotationXmlEncoding(encoding) {
    if (encoding == null) return false;
    const base = encoding.trim().split(';')[0].trim().toLowerCase();
    return (
        base === 'application/mathml-presentation+xml' ||
        base === 'mathml-presentation'
    );
}

/**
 * @param {Element} semantics
 */
const transformSemantics = (semantics) => {
    if (semantics.localName !== 'semantics' || !isMathMLElement(semantics)) {
        return semantics;
    }

    const first = semantics.firstElementChild;
    if (first && isMathMLElement(first) && !isSemanticsAnnotation(first)) {
        return semantics;
    }

    /** @type {Element|null} */
    let presentation_xml = null;
    for (const el of semantics.children) {
        if (!isMathMLElement(el) || el.localName !== 'annotation-xml') continue;
        if (!isPresentationAnnotationXmlEncoding(el.getAttribute('encoding'))) {
            continue;
        }
        if (el.hasChildNodes()) {
            presentation_xml = el;
            break;
        }
    }

    if (presentation_xml) {
        const frag = document.createDocumentFragment();
        while (presentation_xml.firstChild) {
            frag.appendChild(presentation_xml.firstChild);
        }
        semantics.insertBefore(frag, semantics.firstChild);
        presentation_xml.remove();
        return semantics;
    }

    /** @type {Element|null} */
    let pres = null;
    for (const el of semantics.children) {
        if (!isMathMLElement(el) || isSemanticsAnnotation(el)) continue;
        pres = el;
        break;
    }

    if (pres) {
        semantics.insertBefore(pres, semantics.firstChild);
    }
    return semantics;
};

_MathTransforms.add('math semantics', transformSemantics);

/***
 * Handles the "bevelled" attribute on mfrac
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */


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
};

_MathTransforms.add('mfrac[bevelled]', transformBevelled);

/***
 * Handles the "accent" attribute on an mo when it inside of
 *   munder, mover, and munderover
 * Handles the "accentunder" attribute on an mo when it inside of
 *   munderover
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */


const EmbellishedOpsElements = ["msub", "msup", "msubsup", "munder", "mover", "munderover", "mmultiscripts", "mfrac", "semantics"];
const MRowLikeElements =["mrow", "mstyle", "mphantom", "mpadded"];

/**
 * 
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isSpaceLike(el) {
  // FIX: doesn't check maction element whose selected sub-expression exists and is an embellished operator;
  if (el.tagName === 'mtext'|| el.tagName === 'mspace'|| el.tagName === 'maligngroup'|| el.tagName === 'malignmark') {
    return true;
   }
   if (MRowLikeElements.includes(el.tagName)) {
    for (let i=0; i < el.children.length; i++) {
      if (!isSpaceLike(el.children[i])) {
        return false;
      }
    }    if (el.tagName === 'maction' && el.hasAttribute("selection") && isSpaceLike(el.children[el.elAttribute("selection")])) {
      return true;
    }
    return true;
  }

  return false;
 
}
 
/**
 * 
 * @param {HTMLElement} el
 * @returns {[HTMLElement|null]}
 */
function getEmbellishedOperator$1(el) {
 if (el.tagName === 'mo') {
   return el;
  }
  if (EmbellishedOpsElements.includes(el.tagName)) {
    return getEmbellishedOperator$1(el.firstChild);
  }

  if (MRowLikeElements.includes(el.tagName)) {
    for (let i=0; i < el.children.length; i++) {
      if (!isSpaceLike(el.children[i])) {
        return getEmbellishedOperator$1(el.children[i]);
      }
    }    return null;
  }

  return null;
}

/**
 * 
 * @param {HTMLElement} child 
 * @param {string} attrName 
 */
function setAccentValue(child,attrName) {
  const op = getEmbellishedOperator$1(child);
  if (op === null) {
    return;
  }

  let accentVal = op.getAttribute("accent");
  if (accentVal === null && child.tagName === 'mo') {
    accentVal = "true";
  }  if (accentVal !== null) {
    child.parentElement.setAttribute(attrName, accentVal);
  }
}

/**
 * 
 * @param {HTMLElement} el 
 */
const transformAccents = (el) => {
  // If the 2nd/3rd args are <mo> or if they have accent=true,
  // add 'accent'/'accentunder' = true to 'el' (mover, etc)
  if (!el.getAttribute("accentunder") && el.tagName !== 'mover') {
    // if accentunder is not set on munder/munderover, check to see if we should set it
    setAccentValue(el.children[1], 'accentunder');
  }
  if (!el.getAttribute("accent") && el.tagName !== 'munder') {
    // if accent is not set on mover/munderover, check to see if we should set it
    const child = el.children.length === 2 ? el.children[1] : el.children[2];
    setAccentValue(child, 'accent');
  }
};

_MathTransforms.add('munder', transformAccents);
_MathTransforms.add('mover', transformAccents);
_MathTransforms.add('munderover', transformAccents);

/***
 * Handles the "numalign" and "denomalign" attributes on mfrac
 * Handles the "align" attribute on munder, mover, and munderover
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/**
 * @param {HTMLElement} child
 * @returns {number}
 */
function getChildWidth(child) {
    return child.getBoundingClientRect().width;
}

/**
 * Handles left/right alignment by creating an mspace of the appropriate width
 *   on either the left or right side.
 * For something like a fraction numerator, 'child' is the numerator and 'maxWidth'
 *   is the denominator's width
 * @param {HTMLElement} child
 * @param {number} childWidth
 * @param {string} align
 * @param {number} maxWidth
 * @returns {HTMLElement}
 */
function doAlignment(child, childWidth, align, maxWidth) {
    if (childWidth >= maxWidth || align === 'center') {
        return child;
    }

    // need to wrap child with mrow if it is not one already
    if (child.tagName !== 'mrow') {
        const sibling = child.nextElementSibling;
        const mrow = document.createElementNS(MATHML_NS, 'mrow');
        const parent = child.parentElement;
        mrow.appendChild(child);
        parent.insertBefore(mrow, sibling);
        child = mrow;
    }

    let mspace = document.createElementNS(MATHML_NS, 'mspace');
    mspace.setAttribute('width', `${(maxWidth - childWidth).toPrecision(2)}px`);
    if (align === 'left') {
        child.appendChild(mspace);
    } else if (align === 'right') {
        child.insertBefore(mspace, child.firstElementChild);
    }
    return child;

}
/**
 * @param {HTMLElement} el
 * @param {number} iChild
 * @param {number} iOther
 * @param {string} attr
 * @returns {HTMLElement}
 */
function alignChild(el,iChild, iOther, attr) {
    doAlignment(el.children[iChild], getChildWidth(el.children[iChild]), el.getAttribute(attr),  getChildWidth(el.children[iOther]));
    return el;
}

/**
 * @param {HTMLElement} mfrac 
 */
const transformNumerator = (mfrac) => {
    return alignChild(mfrac, 0, 1, 'numalign');
};

/**
 * @param {HTMLElement} mfrac 
 */
const transformDenominator = (mfrac) => {
    return alignChild(mfrac, 1, 0, 'denomalign');
};

/**
 * @param {HTMLElement} el 
 */
const transformMunderAndMover = (el) => {
    return alignChild(el, 1, 0, 'align');
};

/**
 * @param {HTMLElement} el 
 */
const transformMunderover = (el) => {
    const align = el.getAttribute('align');
    const baseWidth = getChildWidth(el.children[0]);
    const underWidth = getChildWidth(el.children[1]);
    const overWidth = getChildWidth(el.children[2]);
    const maxWidth = Math.max(baseWidth, underWidth, overWidth);

    doAlignment(el.children[1], underWidth, align, maxWidth);
    doAlignment(el.children[2], overWidth, align, maxWidth);
    return el;
};

_MathTransforms.add('mfrac[numalign]', transformNumerator);
_MathTransforms.add('mfrac[denomalign]', transformDenominator);

_MathTransforms.add('munder[align]', transformMunderAndMover);
_MathTransforms.add('mover[align]', transformMunderAndMover);
_MathTransforms.add('munderover[align]', transformMunderover);

/***
 * Polyfills subscriptshift / superscriptshift on msub, msup, msubsup (MathML Full).
 * Uses mpadded + voffset; lengths resolved via convertToPx on the script element.
 * Inner line-ascent / line-descent are measured so height and/or depth grow by the same amount as |voffset|.
 * Spec: minimum shift vs UA default; here the resolved length is applied as extra shift when the UA ignores these attributes.
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


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

/***
 * Handles mathsize values "small", "normal", and "big"
***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

/**
 * @param {HTMLElement} el 
 */
const transformSmall = (el) => {
    // this should only be called when mathsize="small"
    el.setAttribute("mathsize", "75%");
    return el;
};

/**
 * @param {HTMLElement} el 
 */
const transformNormal = (el) => {
    // this should only be called when mathsize="normal"
    el.setAttribute("mathsize", "100%");
    return el;
};

/**
 * @param {HTMLElement} el 
 */
const transformBig = (el) => {
    // this should only be called when mathsize="big"
    el.setAttribute("mathsize", "150%");
    return el;
};

_MathTransforms.add('[mathsize="small"]', transformSmall);
_MathTransforms.add('[mathsize="normal"]', transformNormal);
_MathTransforms.add('[mathsize="big"]', transformBig);

/***
 * Changes namedspaces on lspace and rspace to recommended values.
 * For example, "thinmathspace" -> "0.16666666666666666em"
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

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
};
                               
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
};


// can't use comma to join selectors here it seems
_MathTransforms.add('math *[rspace*="mathspace"]', transformNamedspace);
_MathTransforms.add('math *[lspace*="mathspace"]', transformNamedspace);

/***
 * Handles all of the notation values on menclose mentioned in the spec.
 * It does this via CSS, which is only fully supported in chrome/edge
 * as of 06/25.
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */



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
`;



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
};

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
  'downarrow':               [0,  Math.PI / 2, false, ['verticalstrike']],
  'rightarrow':              [0,  0,           false, ['horizontalstrike']],
  'leftarrow':               [0,  Math.PI,     false, ['horizontalstrike']],
  'updownarrow':             [0,  Math.PI / 2, true,  ['verticalstrike', 'uparrow', 'downarrow']],
  'leftrightarrow':          [0,  0,           true,  ['horizontalstrike', 'leftarrow', 'rightarrow']],
  'northeastarrow':          [-1, 0,           false, ['updiagonalstrike']],
  'southeastarrow':          [ 1, 0,           false, ['downdiagonalstrike']],
  'northwestarrow':          [ 1, Math.PI,     false, ['downdiagonalstrike']],
  'southwestarrow':          [-1, Math.PI,     false, ['updiagonalstrike']],
  'northeastsouthwestarrow': [-1, 0,           true,  ['updiagonalstrike', 'northeastarrow', 'southwestarrow']],
  'northwestsoutheastarrow': [ 1, 0,           true,  ['downdiagonalstrike', 'northwestarrow', 'southeastarrow']]
};

// 'phasoranglertl' is an internal-only notation produced by the RTL handler in transformMEnclose,
// so it's excluded here to prevent author markup from triggering it directly.
const ALL_NOTATIONS = Array.from(
  new Set(
    BORDER_NOTATIONS.concat(
      Object.keys(MENCLOSE_STYLE).filter(n => n !== 'phasoranglertl'),
      Object.keys(ARROW_INFO)
    )
  )
);

/** Notations whose polyfill uses mrow.menclose-arrow and/or phasorangle transforms (needs working MathML CSS transforms). */
const TRANSFORM_HEAVY_NOTATIONS = new Set([
  ...Object.keys(ARROW_INFO),
  'phasorangle',
  'phasoranglertl',
]);

/**
 * Shrink-wrap probe math so getBoundingClientRect reflects intrinsic content, not a full-line
 * block box (display="block" on &lt;math&gt; was making width comparisons always tie).
 * @param {string} mathInnerHtml inner XML of the &lt;math&gt; element
 * @returns {{ width: number, height: number }}
 */
function measureProbeMath(mathInnerHtml) {
  const wrapper = document.createElement('div');
  wrapper.setAttribute(
    'style',
    'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;display:inline-block;width:max-content;height:max-content;margin:0;padding:0;border:0;'
  );
  const math = document.createElementNS(MATHML_NS, 'math');
  math.innerHTML = mathInnerHtml;
  wrapper.appendChild(math);
  document.body.appendChild(wrapper);
  const rect = math.getBoundingClientRect();
  const out = { width: rect.width, height: rect.height };
  wrapper.remove();
  return out;
}

/**
 * Compare two probe sizes with a small tolerance for sub-pixel layout differences.
 * @param {{ width: number, height: number }} a
 * @param {{ width: number, height: number }} b
 * @returns {boolean}
 */
function probeRectsEqual(a, b) {
  const e = 0.51;
  return Math.abs(a.width - b.width) < e && Math.abs(a.height - b.height) < e;
}

/** Cached: true when a bordered &lt;mrow&gt; inside &lt;math&gt; grows layout (border/padding path). */
let mathmlCssLayoutSupportedCache;

/** Cached: true when CSS positioning (the arrow polyfill's central layout mechanism) actually works on MathML mrow. */
let mathmlArrowCssLayoutSupportedCache;

/**
 * Probe whether **position: absolute** on a nested MathML &lt;mrow&gt; is honored by layout
 * (not just by computed style). Computed-style probes for `transform` or `position` pass in
 * Firefox even when MathML layout ignores those rules, so we measure the side effect:
 * an absolutely-positioned child is removed from flow and stops contributing to its
 * parent's intrinsic width. The arrow polyfill's CSS depends on that mechanism (every
 * `mrow.menclose-arrow` and arrow-head child uses `position: absolute`); without it the
 * arrow heads/lines stack inline as visible garbage.
 * @returns {boolean}
 */
function mathmlArrowCssLayoutSupported() {
  if (mathmlArrowCssLayoutSupportedCache !== undefined) {
    return mathmlArrowCssLayoutSupportedCache;
  }
  const outerCls = 'menclose-pos-probe-outer';
  const absCls = 'menclose-pos-probe-abs';
  const style = document.createElement('style');
  style.textContent =
    `mrow.${outerCls}{display:inline-block;position:relative;}` +
    `mrow.${absCls}{position:absolute;top:0;left:0;}`;
  document.head.appendChild(style);

  const baseline = measureProbeMath(
    `<mrow class="${outerCls}"><mtext>X</mtext></mrow>`
  );
  const withAbsChild = measureProbeMath(
    `<mrow class="${outerCls}"><mtext>X</mtext><mrow class="${absCls}"><mtext>MMMMMMMM</mtext></mrow></mrow>`
  );
  style.remove();

  // If position:absolute is honored, the wide MMMMMMMM child is taken out of flow and
  // the outer width matches the baseline (just X). Allow a few px slack for sub-pixel
  // rounding. If it is ignored, withAbsChild grows by ~MMMMMMMM width (tens of px).
  mathmlArrowCssLayoutSupportedCache =
    withAbsChild.width < baseline.width + 4;
  return mathmlArrowCssLayoutSupportedCache;
}

/**
 * Cached: true when CSS border (and by extension padding) on a MathML &lt;mrow&gt; affects layout.
 * Prerequisite for the polyfill to render anything visible.
 * @returns {boolean}
 */
function mathmlBorderLayoutSupported() {
  if (mathmlCssLayoutSupportedCache !== undefined) {
    return mathmlCssLayoutSupportedCache;
  }
  const plain = measureProbeMath('<mrow><mi>x</mi></mrow>');
  const bordered = measureProbeMath(
    '<mrow style="border:8px solid"><mi>x</mi></mrow>'
  );
  mathmlCssLayoutSupportedCache =
    bordered.width > plain.width + 1 || bordered.height > plain.height + 1;
  return mathmlCssLayoutSupportedCache;
}

/**
 * Decide whether to replace native {@code <menclose>} with the CSS-based polyfill for this
 * {@code notation} attribute value. Returns false when MathML CSS layout is insufficient (e.g.
 * Firefox arrow path) or when the UA already implements the requested notations natively.
 * @param {string} notationAttrValue raw {@code notation} attribute (space-separated tokens)
 * @returns {boolean} {@code true} if the polyfill should run; {@code false} to leave the element unchanged
 */
function useMencloseTransform(notationAttrValue) {
  if (!mathmlBorderLayoutSupported()) {
    return false;
  }

  const rawTokens = notationAttrValue.trim().split(/\s+/).filter(Boolean);
  if (
    rawTokens.some((t) => TRANSFORM_HEAVY_NOTATIONS.has(t)) &&
    !mathmlArrowCssLayoutSupported()
  ) {
    return false;
  }

  // Test if basic support of menclose (box should add padding vs bare mi)
  const miProbe = measureProbeMath('<mi>x</mi>');
  const boxProbe = measureProbeMath('<menclose notation="box"><mi>x</mi></menclose>');
  if (probeRectsEqual(miProbe, boxProbe)) {
    return true;    // doesn't have even basic support
  }

  // Could test all cases, but in practice it is phasorangle and arrows that are not implemented in Safari and Firefox
  //  (actually there are also RTL dir problems, but hopefully they will fix those)
  if (/arrow/.test(notationAttrValue)) {
    const arrowProbe = measureProbeMath('<menclose notation="rightarrow"><mi>x</mi></menclose>');
    if (probeRectsEqual(miProbe, arrowProbe)) {
      return true;    // uses an arrow and not supported
    }
  }
  if (/phasorangle/.test(notationAttrValue)) {
    const phasorProbe = measureProbeMath('<menclose notation="phasorangle"><mi>x</mi></menclose>');
    if (probeRectsEqual(miProbe, phasorProbe)) {
      return true;    // uses a phasorangle and not supported
    }
  }
  return false;   // looks like all the notations are supported.
}

/**
 * Deduplicate notation tokens and drop redundant ones (e.g. individual borders when {@code box}
 * is present; strike tokens implied by a composite arrow notation per {@code ARROW_INFO}).
 * @param {string[]} notationArray notation tokens from the element
 * @returns {string[]} filtered list safe to iterate for drawing
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
    const hasMeaningfulRemovals = removeArray.some((x) => x !== '');
    if (hasMeaningfulRemovals && notationArray.includes(notation)) {
      // if there is a 'remove' list and the entry key is a notation to draw...
      notationArray = notationArray.filter(n => !removeArray.includes(n));
    }
  }
  return notationArray;
}

/**
 * Walk from {@code element} up to the enclosing {@code <math>} and return whether the nearest
 * explicit {@code dir} is {@code ltr}. If no {@code dir} is found on that path, defaults to
 * {@code true} (LTR).
 * @param {Element} element starting node (e.g. a {@code menclose})
 * @returns {boolean}
 */
function isDirLTR(element) {
  let lookingForMathElement = true;
  do {
      if (element.hasAttribute('dir')) {
          return element.getAttribute('dir') === 'ltr';
      }
      lookingForMathElement = (element.tagName !== 'math');
      element = element.parentElement;
  } while (lookingForMathElement);
  return true;
}

/**
 * Extra padding (in pixels) added around the menclose bounding box for arrow/strike layout,
 * depending on whether rounded or circular borders need more clearance.
 * @param {Element} el menclose element (used as font-size context for {@code em})
 * @param {string[]} notationArray active notation tokens after filtering
 * @returns {number} padding amount in CSS pixels
 */
function padAmount(el, notationArray) {
  let padding = '0.467em';
  if (notationArray.includes('roundedbox') || notationArray.includes('circle')) {
    padding = '0.601em';
  }
  return convertToPx(el, padding); 
}

/** Presentation attributes that belong only to <menclose>, not the replacement <mrow>. */
const MENCLOSE_ONLY_ATTR_NAMES = new Set(['notation']);

/**
 * Copy presentation attributes from {@code <menclose>} onto the replacement {@code <mrow>},
 * skipping {@code notation}; merge user {@code class} / {@code style} with the polyfill's
 * {@code menclose} class and assembled inline styles.
 * @param {Element} fromMenclose original menclose node
 * @param {Element} toMrow replacement container mrow
 * @param {string} computedStyle semicolon-separated CSS from {@link MENCLOSE_STYLE} assembly
 * @returns {void}
 */
function copyMencloseAttrsToReplacementMrow(fromMenclose, toMrow, computedStyle) {
  for (const { name, value } of [...fromMenclose.attributes]) {
    const lower = name.toLowerCase();
    if (MENCLOSE_ONLY_ATTR_NAMES.has(lower)) continue;
    if (lower === 'class' || lower === 'style') continue;
    if (lower.startsWith('xmlns')) continue;
    toMrow.setAttribute(name, value);
  }
  const userClasses = (fromMenclose.getAttribute('class') || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  toMrow.setAttribute('class', ['menclose', ...userClasses].join(' '));

  const userStyle = fromMenclose.getAttribute('style');
  const parts = [userStyle?.trim(), computedStyle?.trim()].filter(Boolean);
  if (parts.length) {
    toMrow.setAttribute('style', parts.join('; '));
  }
}

/**
 * Transform a {@code <menclose>} into an {@code <mrow class="menclose">} with nested absolutely
 * positioned {@code mrow} children (borders, strikes, arrows, phasor angle) per the active
 * notation list. If {@link useMencloseTransform} is false for this notation, returns {@code el}
 * unchanged.
 * @param {Element} el menclose element to replace
 * @returns {Element} replacement {@code mrow} or the original {@code el}
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

  let notationAttrValue = el.getAttribute('notation') || '';
  if (!useMencloseTransform(notationAttrValue)) {
    return el;
  }

  let notationArray = notationAttrValue.trim().split(/\s+/).filter(Boolean);

  // get rid of unknown names
  notationArray = notationArray.filter( notation => ALL_NOTATIONS.includes(notation) );

  // if nothing, use the default
  if (notationArray.length === 0) {
    notationArray.push('longdiv');
  }

  // drawing optimizations
  notationArray = removeRedundantNotations(notationArray);

  // handle rtl -- affects only 'radical' (which relies on msqrt) and 'phasorangle'
  // if rtl, we change phasorangle to phasoranglertl and use the css rule
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
                                     Math.sqrt(adjustedWidth * adjustedWidth + adjustedHeight * adjustedHeight);
      wordMRow.style.width = `${lineLength}px`;
      wordMRow.style.transform =
          (rotate ? `rotate(${rotate}rad) ` : '') +
          'translate(0.067em, 0.0em)';  // FIX: don't hardcode (0.067/2em) -- get from MENCLOSE_STYLE;
      wordMRow.style.left = `${(adjustedWidth - lineLength) / 2}px`;

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
      const phasorWidth = convertToPx(el, '.7em');
      const phasorHeight = rect.height;
      wordMRow.style.width = `${Math.sqrt(phasorWidth * phasorWidth + phasorHeight * phasorHeight)}px`;    // hypotenuse
      wordMRow.style.transform = `rotate(${word === 'phasoranglertl' ? '' : '-'}${Math.atan(phasorHeight / phasorWidth)}rad) translateY(0.067em)`;
    }

    let paddingStyle = MENCLOSE_STYLE[word] || '';
    if (paddingStyle === '' && mencloseStyle.length === 0) {
      paddingStyle = 'padding: 0.2em;';
    }
    if (!mencloseStyle.includes(paddingStyle)) {
      mencloseStyle += paddingStyle;
    }
    wordMRow.className = `menclose-${typeof ARROW_INFO[word] !== "undefined" ? 'arrow' : word}`;
    mencloseMRow.appendChild(wordMRow);
  });

  copyMencloseAttrsToReplacementMrow(el, mencloseMRow, mencloseStyle);
  return mencloseMRow;
};

_MathTransforms.add('menclose', transformMEnclose, MENCLOSE_CSS);

/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/**
 * @param {HTMLElement} el 
 */
const transformThin = (el) => {
    // this should only be called when linethickness="thin"
    el.setAttribute("linethickness", "67%");
    return el;
};

/**
 * @param {HTMLElement} el 
 */
const transformMedium = (el) => {
    // this should only be called when linethickness="medium"
    el.setAttribute("linethickness", "100%");
    return el;
};

/**
 * @param {HTMLElement} el 
 */
const transformThick = (el) => {
    // this should only be called when linethickness="thick"
    el.setAttribute("linethickness", "167%");
    return el;
};

_MathTransforms.add('[linethickness="thin"]', transformThin);
_MathTransforms.add('[linethickness="medium"]', transformMedium);
_MathTransforms.add('[linethickness="thick"]', transformThick);

/***
 * Handles lquote and rquote attrs on ms by replacing with mtext (MathML Core).
 ***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/**
 * @param {string} text
 * @returns {string}
 */
function collapseWhiteSpace(text) {
    // Collapse the whitespace as specified by the MathML specification.
    // https://w3c.github.io/mathml/chapter2.html#fund.collapse
    return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
}

/**
 * @param {HTMLElement} ms
 * @returns {Element}
 */
const transformMs = (ms) => {
    const lquote = ms.getAttribute('lquote') || '"';
    const rquote = ms.getAttribute('rquote') || '"';
    let content = collapseWhiteSpace(ms.textContent);
    if (lquote === rquote) {
        content = content.split(lquote).join('\\' + lquote);
    } else {
        content = content.split(lquote).join('\\' + lquote);
        content = content.split(rquote).join('\\' + rquote);
    }
    const mtext = document.createElementNS(MATHML_NS, 'mtext');
    for (const attr of Array.from(ms.attributes)) {
        if (attr.name !== 'lquote' && attr.name !== 'rquote') {
            mtext.setAttribute(attr.name, attr.value);
        }
    }
    mtext.textContent = lquote + content + rquote;
    return mtext;
};

_MathTransforms.add('ms', transformMs);

/***
 * Converts an element with a mathvariant attribute other than 'normal' into
 * the same kind of element with the corresponding math-style character(s)
 * and no mathvariant attribute. To test the algorithm against an explicit
 * table, rename mathvariant.js to be mathvariantoriginal.js and rename
 * mathvarianttest.js to be mathvariant.js
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */


const mathvariants = {
    // MathML mathvariant values to TeX unicode-math names in unimath-symbols.pdf
    // plus possible TeX names for Arabic math alphabets, roundhand, and chancery.
    'normal': 'mup',
    'bold': 'mbf',
    'italic': 'mit',
    'bold-italic': 'mbfit',
    'double-struck': 'Bbb',
    'bold-fraktur': 'mbffrak',
    'script': 'mscr',
    'bold-script': 'mbfscr',
    'fraktur': 'mfrak',
    'sans-serif': 'msans',
    'bold-sans-serif': 'mbfsans',
    'sans-serif-italic': 'mitsans',
    'sans-serif-bold-italic': 'mbfitsans',
    'monospace': 'mtt',
    'isolated': 'misol',
    'initial': 'minit',
    'tailed': 'mtail',
    'looped': 'mloop',
    'stretched': 'mstrc',
    'chancery': 'mchan',
    'roundhand': 'mrhnd'
};

const convertMathvariant = (el) => {
    // If the element el has a mathvariant attribute other than 'normal',
    // replace the character(s) in el.textContent by the corresponding
    // math-style characters and remove the attribute.
    let mathVariant = el.getAttribute('mathvariant');
    if (!mathVariant || mathVariant == 'normal')
        return

    let mathStyle = mathvariants[mathVariant];
    if (!mathStyle)
        return

    let text = el.textContent;
    let val = '';
    let removeAttr = true;

    for (let i = 0; i < text.length; i++) {
        let ch = getMathAlphanumeric(text[i], mathStyle);
        if (ch == text[i])                  // Math styled char not in Unicode
            removeAttr = false;
        val += ch;
    }
    el.textContent = val;
    if (removeAttr)
        el.removeAttribute('mathVariant');
};

const abjad = [0, 1, -1, 21, 22, 2, 7, 23, 3, 24, 19, 6, 14, 20, 17, 25, 8,
    26, 15, 27, -1, -1, -1, -1, -1, -1, 16, 18, 10, 11, 12, 13, 4, 5, -1, 9];
const dottedChars = '\u066E\u06BA\u06A1\u066F';
const letterlikeDoubleStruck = {'C':'ℂ','H':'ℍ','N':'ℕ','P':'ℙ','Q':'ℚ','R':'ℝ','Z':'ℤ'};
const letterlikeFraktur = {'C':'ℭ','H':'ℌ','I':'ℑ','R':'ℜ','Z':'ℨ'};
const letterlikeScript = {'B':'ℬ','E':'ℰ','F':'ℱ','H':'ℋ','I':'ℐ','L':'ℒ','M':'ℳ','R':'ℛ','e':'ℯ','g':'ℊ','o':'ℴ'};
//                          minit       mtail       mstrc       mloop        Bbb
const missingCharMask = [0xF5080169, 0x5569157B, 0xA1080869, 0xF0000000, 0xF0000000];
const offsetsGr = {'∂':51,'∇':25,'ϴ':17,'ϵ':52,'ϑ':53,'ϰ':54,'ϕ':55,'ϱ':56,'ϖ':57};
const setsAr = ['misol', 'minit','mtail', 'mstrc', 'mloop', 'Bbb'];
const setsDigit = ['mbf', 'Bbb', 'msans', 'mbfsans', 'mtt'];
const setsEn = ['mbf', 'mit', 'mbfit', 'mscr', 'mbfscr', 'mfrak', 'Bbb', 'mbffrak', 'msans', 'mbfsans', 'mitsans', 'mbfitsans', 'mtt'];
const setsGr = ['mbf', 'mit', 'mbfit', 'mbfsans', 'mbfitsans'];

function getMathAlphanumeric(ch, mathStyle) {
    // Return the Unicode math alphanumeric character corresponding to the
    // unstyled character ch and the mathStyle. If no such math alphanumeric
    // exists, return ch. The Unicode math alphanumerics are divided into four
    // categories (ASCII digits, ASCII letters, Greek letters, and Arabic
    // letters) each of which contains math-style character sets with specific
    // character counts, e.g., 10 for the digit sets. This leads to a simple
    // encoding scheme (see the ASCII digits category) that's a bit complicated
    // by exceptions in the letter categories.
    if (!mathStyle || mathStyle == 'mup')
        return ch                           // No change for upright

    let code = ch.charCodeAt(0);
    let n;                                   // Set index

    // ASCII digits
    if (ch >= '0' && ch <= '9') {
        code += 0x1D7CE - 0x30;              // Get math-digit codepoint
        n = setsDigit.indexOf(mathStyle);
        return n != -1 ? String.fromCodePoint(code + n * 10) : ch
    }

    // ASCII letters
    if (/[A-Za-z]/.test(ch)) {
        // Set up roundhand and chancery script styles
        let varsel = '';
        if (mathStyle == 'mchan' || mathStyle == 'mrhnd') {
            varsel = mathStyle == 'mchan' ? '\uFE00' : '\uFE01';
            mathStyle = 'mscr';
        }
		// Handle legacy Unicode Letterlike characters
		let chT = '';
		switch (mathStyle) {
			case 'mit':                     // Math italic
				if (ch == 'h')
					return 'ℎ'			    // Letterlike italic h
				break
			case 'mfrak':                   // Math fraktur
				chT = letterlikeFraktur[ch];
				break
			case 'mscr':                    // Math script
				chT = letterlikeScript[ch];
				break
			case 'Bbb':                     // Math blackboard bold (double-struck)
				chT = letterlikeDoubleStruck[ch];
				break
		}
        if (chT)
            return chT + varsel

        n = setsEn.indexOf(mathStyle);       // Get set index
		if (n == -1)                        // mathStyle isn't in setsEn
			return ch

		code -= 0x41;                        // Compute char offset in set
		if (code > 26)
			code -= 6;						// No punct between lower & uppercase

        return String.fromCodePoint(code + 52 * n + 0x1D400) + varsel
    }

    // Greek letters
    if (ch >= '\u0391' && ch <= '\u03F5' || ch == '∂' || ch == '∇') {
        if (mathStyle == 'mbf') {           // Math bold Greek special cases
            if (ch == 'Ϝ')
                return '𝟊'                  // Digamma
            if (ch == 'ϝ')
                return '𝟋'                  // digamma
        }
        n = setsGr.indexOf(mathStyle);
        if (n == -1)
            return ch
        let code0 = offsetsGr[ch];           // Offset if noncontiguous char
        if (code0) {
            code = code0;
        } else {
            code -= 0x391;                   // Map \Alpha to 0
            if (code > 25)
                code -= 6;                   // Map 𝛼 down to end of UC Greek
        }
        return String.fromCodePoint(code + 58 * n + 0x1D6A8)
    }
    if (code < 0x627)                       // Unhandled codes preceding Arabic
        return ch == 'ı'                    // Dotless i and j
            ? '𝚤' : ch == 'ȷ'
            ? '𝚥' : ch

    if (code > 0x6BA)                       // No unhandled chars above U+06BA
        return ch

    // Arabic letters
    n = setsAr.indexOf(mathStyle);
    if (n == -1)
        return ch

    if (code <= 0x64A) {
        // Translate code from the dictionary order followed approximately
        // in the Unicode Arabic block to the abjad order used by Arabic math
        // alphabetics. Both orders start with alef, e.g., U+0627
        code = abjad[code - 0x0627];
        if (code == -1)
            return ch
    } else {
        code = dottedChars.indexOf(ch);     // Get dotted-char offset
        if (code == -1)
            return ch
        code += 28;
    }
    // Handle missing Arabic math characters
    if (mathStyle == 'misol') {
        if (code == 4)
            n = 1;                           // Use initial style's heh
    } else if ((1 << code) & missingCharMask[n - 1])
        return ch                           // Math-styled char not defined

    return String.fromCodePoint(32 * n + code + 0x1EE00)
}

_MathTransforms.add('*[mathvariant]', convertMathvariant);

/***
 * Handles width/height/depth attributes with % values for mpadded
 ***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {'width'|'height'|'depth'} dimension
 * @param {{ width: number, height: number, depth: number }} dimensions
 * @returns {boolean}
 */
function replacePseudoAttr(el, attr, dimension, dimensions) {
    const raw = el.getAttribute(attr);
    if (raw == null) return false;
    const attrValue = raw.toLowerCase();
    if (attrValue.includes(dimension)) {
        const floatVal = parseFloat(attrValue) * dimensions[dimension] / (attrValue.includes('%') ? 100.0 : 1.0);
        el.setAttribute(attr, floatVal.toFixed(1) + 'px');
        return true;
    }
    return false;
}

/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {{ width: number, height: number, depth: number }} dimensions
 * @returns {boolean} true if handled
 */
function handleAttr(el, attr, dimensions) {
    if (!el.hasAttribute(attr)) {
        return false;
    }

    if (replacePseudoAttr(el, attr, 'width', dimensions)) {
        return true;
    }
    if (replacePseudoAttr(el, attr, 'height', dimensions)) {
        return true;
    }
    if (replacePseudoAttr(el, attr, 'depth', dimensions)) {
        return true;
    }

    return false;
}

/**
 * @param {HTMLElement} el 
 */
const transformMpadded = (el) => {
    // if the attr value contains a pseudo-unit (width, height, depth),
    // these are converted to pixels
    const dimensions = getMathDimensions(el);       // do this before changing the attr values

    handleAttr(el, 'width', dimensions);
    handleAttr(el, 'height', dimensions);
    handleAttr(el, 'depth', dimensions);
    handleAttr(el, 'lspace', dimensions);
    handleAttr(el, 'voffset', dimensions);
    return el;
};

_MathTransforms.add('mpadded', transformMpadded);

/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80 */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/** @type {boolean | null} */
let nativeMtablePresentationAttrsCache = null;

/** @type {boolean | null} */
let nativeMlabeledtrSideLayoutCache = null;

/** @type {readonly string[]} */
const ROWALIGN_VALUES = ['top', 'bottom', 'center', 'baseline', 'axis'];

/** @type {readonly string[]} */
const COLUMNALIGN_VALUES = ['left', 'center', 'right'];

/** @type {readonly string[]} */
const LINESTYLE_VALUES = ['none', 'solid', 'dashed'];

/**
 * Fallback axis-height length when the U+2212 measurement probe fails (pixels via {@link convertToPx}).
 */
const AXIS_ROWALIGN_FALLBACK_EX = '0.25ex';

/**
 * Whether the UA supports column {@code subgrid} for cross-row {@code mtable} column sizing.
 * @returns {boolean}
 */
function supportsColumnSubgrid() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('grid-template-columns', 'subgrid')
  );
}

/**
 * ASCII-lowercase trim for MathML enumerated values.
 * @param {string} s
 * @returns {string}
 */
function normToken(s) {
  return s.trim().toLowerCase();
}

/**
 * Split a MathML-style attribute list on whitespace (commas become spaces first).
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseSpaceList(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw)
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @param {string[]} list
 * @param {number} index
 * @param {string} fallback
 * @returns {string}
 */
function pickListEntry(list, index, fallback) {
  if (!list.length) return fallback;
  if (index < list.length) return list[index];
  return list[list.length - 1];
}

/**
 * @param {string} token
 * @param {readonly string[]} allowed
 * @param {string} fallback
 * @returns {string}
 */
function normalizeEnum(token, allowed, fallback) {
  const t = normToken(token);
  for (const a of allowed) {
    if (t === a) return a;
  }
  return fallback;
}

/**
 * @param {string | null | undefined} raw
 * @param {string} fallback
 * @returns {string[]}
 */
function parseLineList(raw, fallback) {
  const parts = parseSpaceList(raw);
  if (!parts.length) return [fallback];
  return parts.map((p) => normalizeEnum(p, LINESTYLE_VALUES, 'none'));
}

/**
 * @param {string[]} list
 * @returns {boolean}
 */
function lineListHasVisible(list) {
  return list.some((t) => t !== 'none');
}

/**
 * Build a 1×2 {@code mtable} (one {@code mtr}, two {@code mtd}) for probing native {@code columnspacing}.
 * @param {string} columnspacing
 * @returns {Element}
 */
function buildColumnspacingProbeMtable(columnspacing) {
  const tbl = document.createElementNS(MATHML_NS, 'mtable');
  tbl.setAttribute('columnspacing', columnspacing);
  const tr = document.createElementNS(MATHML_NS, 'mtr');
  for (let i = 0; i < 2; i++) {
    const td = document.createElementNS(MATHML_NS, 'mtd');
    const mi = document.createElementNS(MATHML_NS, 'mi');
    mi.textContent = String.fromCharCode(97 + i);
    td.appendChild(mi);
    tr.appendChild(td);
  }
  tbl.appendChild(tr);
  return tbl;
}

/**
 * Lay out a probe {@code mtable} off-screen and return its border-box width (CSS pixels).
 * @param {string} columnspacing
 * @returns {number}
 */
function measureProbeMtableWidth(columnspacing) {
  const math = document.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'block');
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mtable = buildColumnspacingProbeMtable(columnspacing);
  math.appendChild(mtable);
  document.body.appendChild(math);
  forceLayout(math);
  const w = mtable.getBoundingClientRect().width;
  math.remove();
  return w;
}

/**
 * Whether the engine already lays out MathML 4–style {@code mtable} presentation attributes (e.g.
 * {@code columnspacing}). Probed once: a 1×2 table with {@code columnspacing="3em"} should be wider
 * than with {@code columnspacing="0em"}; if widths match, assume attributes are ignored and the polyfill
 * is needed.
 * @returns {boolean}
 */
function detectNativeMtablePresentationAttrs() {
  if (nativeMtablePresentationAttrsCache !== null) {
    return nativeMtablePresentationAttrsCache;
  }
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }
  try {
    const w0 = measureProbeMtableWidth('0em');
    const w3 = measureProbeMtableWidth('3em');
    nativeMtablePresentationAttrsCache = w3 - w0 > 1;
  } catch {
    nativeMtablePresentationAttrsCache = false;
  }
  return nativeMtablePresentationAttrsCache;
}

/**
 * Whether {@code mtable@side} with {@code mlabeledtr} places the label {@code mtd} on the correct side
 * of the equation {@code mtd}s (probed once with a 1×2 labeled row: label first, then equation, in
 * document order).
 * @returns {boolean}
 */
function detectNativeMlabeledtrSideLayout() {
  if (nativeMlabeledtrSideLayoutCache !== null) {
    return nativeMlabeledtrSideLayoutCache;
  }
  if (typeof document === 'undefined' || !document.body) {
    nativeMlabeledtrSideLayoutCache = false;
    return false;
  }
  try {
    nativeMlabeledtrSideLayoutCache =
      probeMlabeledtrSideLayout('right') && probeMlabeledtrSideLayout('left');
  } catch {
    nativeMlabeledtrSideLayoutCache = false;
  }
  return nativeMlabeledtrSideLayoutCache;
}

/**
 * @param {'left' | 'right'} side
 * @returns {boolean}
 */
function probeMlabeledtrSideLayout(side) {
  const math = document.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'block');
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mtable = document.createElementNS(MATHML_NS, 'mtable');
  mtable.setAttribute('side', side);
  const mlabeledtr = document.createElementNS(MATHML_NS, 'mlabeledtr');
  const mtdLabel = document.createElementNS(MATHML_NS, 'mtd');
  const tL = document.createElementNS(MATHML_NS, 'mtext');
  tL.textContent = 'L';
  mtdLabel.appendChild(tL);
  const mtdEq = document.createElementNS(MATHML_NS, 'mtd');
  const mi = document.createElementNS(MATHML_NS, 'mi');
  mi.textContent = 'E';
  mtdEq.appendChild(mi);
  mlabeledtr.appendChild(mtdLabel);
  mlabeledtr.appendChild(mtdEq);
  mtable.appendChild(mlabeledtr);
  math.appendChild(mtable);
  document.body.appendChild(math);
  forceLayout(math);
  const rL = mtdLabel.getBoundingClientRect();
  const rE = mtdEq.getBoundingClientRect();
  math.remove();
  const gap = 0.5;
  if (side === 'right') {
    return rE.left + gap < rL.left;
  }
  return rL.left + gap < rE.left;
}

/**
 * Vertical placement for {@code display:flex; flex-direction: column} on {@code mtd} when the cell
 * is stretched in the row grid (avoids {@code align-self: end} fighting {@code align-items: first baseline}
 * on {@code mtr} for tall cells).
 * @param {string} rowalign
 * @returns {string}
 */
function rowalignToFlexMainJustify(rowalign) {
  const v = normalizeEnum(rowalign, ROWALIGN_VALUES, 'baseline');
  if (v === 'top') return 'flex-start';
  if (v === 'bottom') return 'flex-end';
  if (v === 'center') return 'center';
  return 'flex-start';
}

/**
 * True if {@code el} is a leading zero-sized {@code mspace} used as a baseline probe.
 * @param {Element | null} el
 * @returns {boolean}
 */
function isZeroBaselineProbe(el) {
  if (!el || el.namespaceURI !== MATHML_NS || el.localName !== 'mspace') return false;
  const w = normToken(el.getAttribute('width') ?? '0');
  const h = normToken(el.getAttribute('height') ?? '0');
  const d = normToken(el.getAttribute('depth') ?? '0');
  return w === '0' && h === '0' && d === '0';
}

/**
 * Insert a leading {@code <mspace width="0" height="0" depth="0"/>} in {@code mrow} when missing,
 * so {@link runLinedMtdVerticalLayout} can read the row’s math baseline.
 * @param {Element} mrow
 * @returns {void}
 */
function ensureLeadingBaselineProbe(mrow) {
  if (isZeroBaselineProbe(mrow.firstElementChild)) return;
  const doc = mrow.ownerDocument;
  if (!doc) return;
  const sp = doc.createElementNS(MATHML_NS, 'mspace');
  sp.setAttribute('width', '0');
  sp.setAttribute('height', '0');
  sp.setAttribute('depth', '0');
  mrow.insertBefore(sp, mrow.firstChild);
}

/**
 * @param {Element} mtd
 * @returns {Element | null}
 */
function getFirstMrowChild(mtd) {
  const el = mtd.firstElementChild;
  if (!el || el.namespaceURI !== MATHML_NS || el.localName !== 'mrow') return null;
  return el;
}

/**
 * Effective MathML {@code rowalign} for one cell: {@code mtable} list (one entry per row, last
 * repeated), then {@code mtr} list (one entry per column in that row, last repeated), then {@code mtd}
 * (list applies to the cell; a single-column {@code mtd} uses the first entry).
 * @param {Element} mtd
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {string[]} mtableRowalign
 * @param {Element | null} mtr
 * @param {Element | null} mtable Used to map the label column to list index {@code n−1} for {@code mtr} lists.
 * @returns {string}
 */
function resolveEffectiveRowalign(mtd, rowIndex, colIndex, mtableRowalign, mtr, mtable) {
  const listCol =
    mtable && mtr ? presentationColumnListIndex(mtd, colIndex, mtable, mtr) : colIndex;
  let ra = pickListEntry(mtableRowalign, rowIndex, 'baseline');
  if (mtr) {
    const mtrRaList = parseSpaceList(mtr.getAttribute('rowalign'));
    if (mtrRaList.length) {
      ra = normalizeEnum(
        pickListEntry(mtrRaList, listCol, ra),
        ROWALIGN_VALUES,
        ra
      );
    }
  }
  const mtdRaRaw = mtd.getAttribute('rowalign');
  if (mtdRaRaw != null && String(mtdRaRaw).trim() !== '') {
    const mtdRaList = parseSpaceList(mtdRaRaw);
    if (mtdRaList.length) {
      ra = normalizeEnum(pickListEntry(mtdRaList, 0, ra), ROWALIGN_VALUES, ra);
    }
  }
  return normalizeEnum(ra, ROWALIGN_VALUES, 'baseline');
}

/**
 * Effective MathML {@code columnalign} for one cell: {@code mtable} list (one entry per column, last
 * repeated), then {@code mtr} list (one entry per column in that row, last repeated), then {@code mtd}
 * (list applies to the cell; a single-column {@code mtd} uses the first entry).
 * @param {Element} mtd
 * @param {number} colIndex Physical column index.
 * @param {string[]} mtableColumnalign
 * @param {Element | null} mtr
 * @param {Element | null} mtable Label column maps to list index {@code n−1} (does not consume the first entry).
 * @returns {string}
 */
function resolveEffectiveColumnalign(mtd, colIndex, mtableColumnalign, mtr, mtable) {
  const listCol =
    mtable && mtr ? presentationColumnListIndex(mtd, colIndex, mtable, mtr) : colIndex;
  let ca = pickListEntry(mtableColumnalign, listCol, 'center');
  if (mtr) {
    const mtrCaList = parseSpaceList(mtr.getAttribute('columnalign'));
    if (mtrCaList.length) {
      ca = normalizeEnum(
        pickListEntry(mtrCaList, listCol, ca),
        COLUMNALIGN_VALUES,
        ca
      );
    }
  }
  const mtdCaRaw = mtd.getAttribute('columnalign');
  if (mtdCaRaw != null && String(mtdCaRaw).trim() !== '') {
    const mtdCaList = parseSpaceList(mtdCaRaw);
    if (mtdCaList.length) {
      ca = normalizeEnum(pickListEntry(mtdCaList, 0, ca), COLUMNALIGN_VALUES, ca);
    }
  }
  return normalizeEnum(ca, COLUMNALIGN_VALUES, 'center');
}

/**
 * Math axis height (baseline → axis, in CSS px): distance from an {@code mrow} baseline (from a
 * leading zero-sized {@code mspace}) to the vertical center of {@code <mo>U+2212</mo>} (MINUS
 * SIGN), which tracks the math axis in typical fonts.
 *
 * @param {Element} mtable source for {@code displaystyle} on the probe {@code math} element
 * @returns {number | null} positive pixels, or {@code null} if measurement is unavailable
 */
function measureMathAxisHeightPxFromMinusU2212(mtable) {
  const doc = mtable.ownerDocument;
  if (!doc || !doc.body) return null;
  const math = doc.createElementNS(MATHML_NS, 'math');
  math.setAttribute('display', 'inline');
  const rawDs = mtable.getAttribute('displaystyle');
  if (rawDs != null && String(rawDs).trim() !== '') {
    math.setAttribute('displaystyle', parseBooleanAttr(rawDs, false) ? 'true' : 'false');
  } else {
    math.setAttribute('displaystyle', 'false');
  }
  Object.assign(/** @type {HTMLElement} */ (math).style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const mrow = doc.createElementNS(MATHML_NS, 'mrow');
  const mspace = doc.createElementNS(MATHML_NS, 'mspace');
  mspace.setAttribute('width', '0');
  mspace.setAttribute('height', '0');
  mspace.setAttribute('depth', '0');
  const mo = doc.createElementNS(MATHML_NS, 'mo');
  mo.textContent = '\u2212';
  mrow.appendChild(mspace);
  mrow.appendChild(mo);
  math.appendChild(mrow);
  doc.body.appendChild(math);
  forceLayout(math);
  const baselineY = mspace.getBoundingClientRect().top;
  const moRect = mo.getBoundingClientRect();
  if (!(moRect.height > 0)) {
    math.remove();
    return null;
  }
  const axisCenterY = moRect.top + moRect.height / 2;
  const axisHeightPx = baselineY - axisCenterY;
  math.remove();
  if (!Number.isFinite(axisHeightPx) || axisHeightPx <= 0) return null;
  return axisHeightPx;
}

/**
 * @param {string} columnalign
 * @returns {string}
 */
function columnalignToJustifySelf(columnalign) {
  const v = normalizeEnum(columnalign, COLUMNALIGN_VALUES, 'center');
  if (v === 'left') return 'start';
  if (v === 'right') return 'end';
  return 'center';
}

/**
 * @param {string} columnalign
 * @returns {'left' | 'center' | 'right'}
 */
function columnalignToTextAlign(columnalign) {
  const v = normalizeEnum(columnalign, COLUMNALIGN_VALUES, 'center');
  if (v === 'left') return 'left';
  if (v === 'right') return 'right';
  return 'center';
}

/**
 * {@code justify-content} on a row-direction flex {@code mtd}, or {@code align-items} (cross axis)
 * on a column-direction flex {@code mtd} when internal grid lines are visible.
 * @param {string} columnalign
 * @returns {string}
 */
function columnalignToJustifyContent(columnalign) {
  const v = normalizeEnum(columnalign, COLUMNALIGN_VALUES, 'center');
  if (v === 'left') return 'flex-start';
  if (v === 'right') return 'flex-end';
  return 'center';
}

/**
 * @typedef {Object} PlacedCell
 * @property {Element} mtd
 * @property {number} row
 * @property {number} col
 */

/**
 * Wrap an {@code mtd}'s contents in an explicit {@code <mrow>} when it has more than one
 * element child, so the MathML inferred-mrow becomes explicit. Chrome drops the implicit row
 * (children render stacked) once an ancestor has {@code display: grid}, which the polyfill
 * sets on each {@code mtr}; an explicit {@code mrow} renders horizontally regardless.
 *
 * When there is exactly one MathML element child that is not already an {@code mrow}, wrap it in
 * an {@code mrow} for the same reason.
 *
 * A leading zero {@code mspace} is inserted into each explicit {@code mrow} when missing so
 * {@link runLinedMtdVerticalLayout} can read the math baseline when internal lines are on.
 * @param {Element} mtd
 * @returns {void}
 */
function wrapMtdInferredMrow(mtd) {
  const elementKids = Array.from(mtd.children);
  if (elementKids.length >= 2) {
    const doc = mtd.ownerDocument;
    if (!doc) return;
    const mrow = doc.createElementNS(MATHML_NS, 'mrow');
    while (mtd.firstChild) {
      mrow.appendChild(mtd.firstChild);
    }
    mtd.appendChild(mrow);
  } else if (elementKids.length === 1) {
    const only = elementKids[0];
    if (only.namespaceURI === MATHML_NS && only.localName !== 'mrow') {
      const doc = mtd.ownerDocument;
      if (!doc) return;
      const mrow = doc.createElementNS(MATHML_NS, 'mrow');
      mtd.replaceChild(mrow, only);
      mrow.appendChild(only);
    }
  }
  const inner = mtd.firstElementChild;
  if (inner && inner.namespaceURI === MATHML_NS && inner.localName === 'mrow') {
    ensureLeadingBaselineProbe(inner);
  }
}

/**
 * @param {string | null | undefined} raw
 * @returns {'left' | 'right'}
 */
function normalizeMtableSide(raw) {
  const s = normToken(raw || 'right');
  if (s === 'left' || s === 'right') return s;
  return 'right';
}

/**
 * Index into {@code mtable} / {@code mtr} column-wise token lists ({@code columnalign}, {@code mtr}
 * {@code rowalign}, {@code columnwidth}, etc.): equation columns use consecutive indices; the label
 * column (number or empty padding) uses index {@code n−1} so it does not consume the first list entry.
 * @param {Element} mtd
 * @param {number} physicalCol
 * @param {Element | null} mtable
 * @param {Element | null} mtr
 * @returns {number}
 */
function presentationColumnListIndex(mtd, physicalCol, mtable, mtr) {
  if (!mtable || !mtable.hasAttribute('data-mlabeledtr-expanded')) return physicalCol;
  if (!mtr || mtr.namespaceURI !== MATHML_NS || mtr.localName !== 'mtr') return physicalCol;
  const n = Array.from(mtr.children).filter(
    (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
  ).length;
  if (n < 2) return physicalCol;
  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;
  if (physicalCol === labelCol) return n - 1;
  if (side === 'left') return physicalCol - 1;
  return physicalCol;
}

/**
 * Rewrite {@code rowalign} / {@code columnalign} on an {@code mtr} converted from {@code mlabeledtr}.
 * List entries on {@code mlabeledtr} apply to <em>equation</em> {@code mtd}s only (not the label); the label
 * column uses {@code mtable} defaults for that row/column. Tokens are ordered for final DOM column order
 * (label first or last per {@code side}).
 * @param {Element} mtable
 * @param {Element} mtr
 * @param {number} rowIndex0 0-based row index among {@code mtable} children (before expansion).
 * @param {'left' | 'right'} side
 * @param {number} kEq Number of equation cells (total {@code mtd} minus label).
 * @returns {void}
 */
function rewriteMlabeledtrRowPresentationAttrs(mtable, mtr, rowIndex0, side, kEq) {
  const { rowalign: mtableRA, columnalign: mtableCA } = readMtableAlignLists(mtable);
  const rowFB = pickListEntry(mtableRA, rowIndex0, 'baseline');
  const labelDomCol = side === 'right' ? kEq : 0;
  const labelRA = normalizeEnum(rowFB, ROWALIGN_VALUES, 'baseline');
  const labelCA = normalizeEnum(
    pickListEntry(mtableCA, labelDomCol, 'center'),
    COLUMNALIGN_VALUES,
    'center'
  );

  /** @param {'rowalign' | 'columnalign'} which */
  const build = (which) => {
    const attr = which === 'rowalign' ? 'rowalign' : 'columnalign';
    if (!mtr.hasAttribute(attr)) return null;
    const raw = mtr.getAttribute(attr);
    if (raw == null || String(raw).trim() === '') return null;
    const list = parseSpaceList(raw);
    const values = which === 'rowalign' ? ROWALIGN_VALUES : COLUMNALIGN_VALUES;
    const eqParts = [];
    for (let i = 0; i < kEq; i++) {
      const mtableCol = side === 'right' ? i : i + 1;
      const fb = which === 'rowalign' ? rowFB : pickListEntry(mtableCA, mtableCol, 'center');
      const picked = list.length ? pickListEntry(list, i, fb) : fb;
      eqParts.push(normalizeEnum(picked, values, fb));
    }
    const labelTok = which === 'rowalign' ? labelRA : labelCA;
    const ordered = side === 'right' ? [...eqParts, labelTok] : [labelTok, ...eqParts];
    return ordered.join(' ');
  };

  const ra = build('rowalign');
  const ca = build('columnalign');
  if (ra != null) mtr.setAttribute('rowalign', ra);
  if (ca != null) mtr.setAttribute('columnalign', ca);
}

/**
 * Add {@code :equation-label} to label {@code mtd} intent (merge-safe with existing intent).
 * @param {Element} mtd
 * @returns {void}
 */
function addEquationLabelIntent(mtd) {
  if (!mtd.hasAttribute('intent')) {
    mtd.setAttribute('intent', ':equation-label');
    return;
  }
  let intentValue = mtd.getAttribute('intent') || '';
  const iOpenParen = intentValue.indexOf('(');
  const head = iOpenParen === -1 ? intentValue : intentValue.substring(0, iOpenParen);
  if (head.includes(':equation-label')) {
    return;
  }
  intentValue = head + ':equation-label' + intentValue.substring(head.length);
  mtd.setAttribute('intent', intentValue);
}

/**
 * Replace each {@code mlabeledtr} with an {@code mtr} and pad plain {@code mtr} rows with an empty
 * label {@code mtd} so column counts match. Must run before {@link listTableRowsAndCells}.
 * @param {Element} mtable
 * @returns {Element}
 */
function expandMlabeledtrRows(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return mtable;
  }

  const topRows = Array.from(mtable.children);
  const hasLabeled = topRows.some(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mlabeledtr'
  );
  if (!hasLabeled) {
    mtable.removeAttribute('data-mlabeledtr-expanded');
    return mtable;
  }

  mtable.setAttribute('data-mlabeledtr-expanded', '');
  const doc = mtable.ownerDocument;
  if (!doc) return mtable;

  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const emptyColumnEntry = doc.createElementNS(MATHML_NS, 'mtd');
  emptyColumnEntry.setAttribute('intent', ':no-equation-label');

  for (let rowIndex0 = 0; rowIndex0 < topRows.length; rowIndex0++) {
    const row = topRows[rowIndex0];
    if (row.namespaceURI !== MATHML_NS) continue;

    if (row.localName === 'mlabeledtr') {
      const label = row.firstElementChild;
      if (!label) continue;
      addEquationLabelIntent(/** @type {Element} */ (label));

      const newRow = doc.createElementNS(MATHML_NS, 'mtr');
      for (const attr of row.attributes) {
        newRow.setAttribute(attr.name, attr.value);
      }

      const leadIdx = side === 'left' ? 0 : 1;
      const lead = row.children[leadIdx];
      if (lead) newRow.appendChild(lead);
      while (row.firstChild) {
        newRow.appendChild(row.firstChild);
      }
      if (side === 'right') {
        newRow.appendChild(label);
      }

      const numCells = Array.from(newRow.children).filter(
        (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
      ).length;
      const kEq = numCells - 1;
      if (kEq >= 1) {
        rewriteMlabeledtrRowPresentationAttrs(mtable, newRow, rowIndex0, side, kEq);
      }

      row.replaceWith(newRow);
    } else if (row.localName === 'mtr') {
      const newColEntry = /** @type {Element} */ (emptyColumnEntry.cloneNode(false));
      if (side === 'right') {
        row.appendChild(newColEntry);
      } else {
        row.insertBefore(newColEntry, row.firstChild);
      }
    }
  }

  return mtable;
}

/** Presentation attributes moved from outer {@code mtable} to the inner equation-only {@code mtable}. */
const MTABLE_LAYOUT_ATTRS_EQUATION_ONLY_FOR_NATIVE_WRAP = [
  'frame',
  'framespacing',
  'rowlines',
  'columnlines',
  'columnspacing',
  'equalcolumns',
  'columnwidth',
  'columnalign',
  'width',
];

/** Per-row presentation attributes mirrored on both inner equation and label {@code mtable}s. */
const MTABLE_LAYOUT_ATTRS_SHARED_FOR_NATIVE_WRAP = [
  'rowspacing',
  'rowalign',
  'equalrows',
  'displaystyle',
];

/**
 * Build the per-row {@code rowalign} attributes for the split row pair when wrapping an expanded
 * {@code mlabeledtr} table. Equation row gets a list with the label-column entry removed; label row
 * gets the single label-column entry. When the source {@code mtr} has no {@code rowalign}, both
 * return {@code null} (no attribute set).
 * @param {Element} oldRow
 * @param {number} totalCols Total physical columns in {@code oldRow} (label + equation columns).
 * @param {number} labelCol Physical index of the label column.
 * @returns {{ equationRowalign: string | null, labelRowalign: string | null }}
 */
function splitRowalignForWrappedMlabeledtr(oldRow, totalCols, labelCol) {
  if (!oldRow.hasAttribute('rowalign')) {
    return { equationRowalign: null, labelRowalign: null };
  }
  const raw = oldRow.getAttribute('rowalign');
  if (raw == null || String(raw).trim() === '') {
    return { equationRowalign: null, labelRowalign: null };
  }
  const tokens = parseSpaceList(raw);
  if (!tokens.length) {
    return { equationRowalign: null, labelRowalign: null };
  }
  const labelTok = normalizeEnum(
    pickListEntry(tokens, labelCol, 'baseline'),
    ROWALIGN_VALUES,
    'baseline'
  );
  const eqTokens = [];
  for (let i = 0; i < totalCols; i++) {
    if (i === labelCol) continue;
    eqTokens.push(
      normalizeEnum(pickListEntry(tokens, i, 'baseline'), ROWALIGN_VALUES, 'baseline')
    );
  }
  return {
    equationRowalign: eqTokens.length ? eqTokens.join(' ') : null,
    labelRowalign: labelTok,
  };
}

/**
 * Insert a leading {@code <mrow>} with a zero baseline probe into an {@code mtd} when missing so
 * baseline-sync measurements work. Empty {@code mtd}s (e.g. {@code :no-equation-label} padding cells)
 * get a fresh {@code mrow + mspace}; multi-element or single non-{@code mrow} content goes through
 * {@link wrapMtdInferredMrow}; single existing {@code mrow} just gets its probe ensured.
 * @param {Element} mtd
 * @returns {void}
 */
function ensureMtdHasBaselineProbeMrow(mtd) {
  const elementKids = Array.from(mtd.children);
  if (elementKids.length === 0) {
    const doc = mtd.ownerDocument;
    if (!doc) return;
    const mrow = doc.createElementNS(MATHML_NS, 'mrow');
    mtd.appendChild(mrow);
    ensureLeadingBaselineProbe(mrow);
    return;
  }
  wrapMtdInferredMrow(mtd);
}

/**
 * When the UA uses native {@code mtable} spacing but {@code mlabeledtr} was expanded to {@code mtr},
 * {@code frame} / {@code rowlines} / {@code columnlines} on the outer table still span the label column.
 * Replace the flat row grid with one wrapper {@code mtr} and two {@code mtd}s: an inner equation
 * {@code mtable} (receives equation-only layout attributes) and an inner label {@code mtable} (one
 * column, one row per original row). Per-row attributes ({@code rowspacing}, {@code rowalign},
 * {@code equalrows}, {@code displaystyle}) go to both inner mtables so row gaps and per-row alignment
 * track each other. A {@link scheduleWrappedMlabeledtrBaselineSync} pass equalizes per-row baselines
 * after layout (multiple labels with different row heights all stay glued to their equation rows).
 * Removes {@code data-mlabeledtr-expanded}.
 * @param {Element} mtable
 * @returns {void}
 */
function wrapExpandedMtableForNativeEquationLabelSplit(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return;
  }
  if (!mtable.hasAttribute('data-mlabeledtr-expanded')) {
    return;
  }
  if (!detectNativeMtablePresentationAttrs()) {
    return;
  }

  const doc = mtable.ownerDocument;
  if (!doc) return;

  const oldRows = Array.from(mtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  const n = maxColumnCount(oldRows);
  // Total columns = 1 label + (# equation columns). Wrapping needs at least one equation column.
  const equationColCount = n - 1;
  if (oldRows.length === 0 || equationColCount < 1) {
    mtable.removeAttribute('data-mlabeledtr-expanded');
    return;
  }

  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;

  for (const oldRow of oldRows) {
    const k = Array.from(oldRow.children).filter(
      (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
    ).length;
    if (k !== n) {
      return;
    }
  }

  const innerMtable = doc.createElementNS(MATHML_NS, 'mtable');
  const labelMtable = doc.createElementNS(MATHML_NS, 'mtable');
  innerMtable.setAttribute('data-mlabeledtr-equation-table', '');
  labelMtable.setAttribute('data-mlabeledtr-label-table', '');

  for (const oldRow of oldRows) {
    const cells = Array.from(oldRow.children).filter(
      (c) => c.namespaceURI === MATHML_NS && c.localName === 'mtd'
    );

    const eqRow = doc.createElementNS(MATHML_NS, 'mtr');
    const labRow = doc.createElementNS(MATHML_NS, 'mtr');
    const { equationRowalign, labelRowalign } = splitRowalignForWrappedMlabeledtr(
      oldRow,
      n,
      labelCol
    );
    if (equationRowalign) eqRow.setAttribute('rowalign', equationRowalign);
    if (labelRowalign) labRow.setAttribute('rowalign', labelRowalign);

    for (let i = 0; i < cells.length; i++) {
      if (i === labelCol) {
        labRow.appendChild(cells[i]);
      } else {
        eqRow.appendChild(cells[i]);
      }
    }
    innerMtable.appendChild(eqRow);
    labelMtable.appendChild(labRow);
  }

  for (const name of MTABLE_LAYOUT_ATTRS_EQUATION_ONLY_FOR_NATIVE_WRAP) {
    if (!mtable.hasAttribute(name)) continue;
    const v = mtable.getAttribute(name);
    if (v != null) innerMtable.setAttribute(name, v);
    mtable.removeAttribute(name);
  }
  for (const name of MTABLE_LAYOUT_ATTRS_SHARED_FOR_NATIVE_WRAP) {
    if (!mtable.hasAttribute(name)) continue;
    const v = mtable.getAttribute(name);
    if (v == null) continue;
    innerMtable.setAttribute(name, v);
    labelMtable.setAttribute(name, v);
    mtable.removeAttribute(name);
  }
  mtable.removeAttribute('side');
  mtable.removeAttribute('data-mlabeledtr-expanded');

  while (mtable.firstChild) {
    mtable.removeChild(mtable.firstChild);
  }

  for (const mtr of innerMtable.children) {
    if (mtr.namespaceURI !== MATHML_NS || mtr.localName !== 'mtr') continue;
    for (const mtd of mtr.children) {
      if (mtd.namespaceURI === MATHML_NS && mtd.localName === 'mtd') {
        ensureMtdHasBaselineProbeMrow(/** @type {Element} */ (mtd));
      }
    }
  }
  for (const mtr of labelMtable.children) {
    if (mtr.namespaceURI !== MATHML_NS || mtr.localName !== 'mtr') continue;
    for (const mtd of mtr.children) {
      if (mtd.namespaceURI === MATHML_NS && mtd.localName === 'mtd') {
        ensureMtdHasBaselineProbeMrow(/** @type {Element} */ (mtd));
      }
    }
  }

  const wrapRow = doc.createElementNS(MATHML_NS, 'mtr');
  const mtdEq = doc.createElementNS(MATHML_NS, 'mtd');
  const mtdLb = doc.createElementNS(MATHML_NS, 'mtd');
  mtdEq.appendChild(innerMtable);
  mtdLb.appendChild(labelMtable);
  if (side === 'right') {
    wrapRow.appendChild(mtdEq);
    wrapRow.appendChild(mtdLb);
  } else {
    wrapRow.appendChild(mtdLb);
    wrapRow.appendChild(mtdEq);
  }
  mtable.appendChild(wrapRow);

  scheduleWrappedMlabeledtrBaselineSync(mtable);
}

/** @type {WeakMap<Element, ResizeObserver>} */
const wrappedMlabeledtrResizeObservers = new WeakMap();

/**
 * Find the inner equation / label {@code mtable} produced by
 * {@link wrapExpandedMtableForNativeEquationLabelSplit}.
 * @param {Element} outerMtable
 * @param {string} marker {@code data-mlabeledtr-equation-table} or {@code data-mlabeledtr-label-table}
 * @returns {Element | null}
 */
function findWrappedInnerMtable(outerMtable, marker) {
  const wrapRow = outerMtable.firstElementChild;
  if (!wrapRow) return null;
  for (const mtd of wrapRow.children) {
    if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
    const inner = mtd.firstElementChild;
    if (
      inner &&
      inner.namespaceURI === MATHML_NS &&
      inner.localName === 'mtable' &&
      inner.hasAttribute(marker)
    ) {
      return /** @type {Element} */ (inner);
    }
  }
  return null;
}

/**
 * Reset per-row baseline-sync adjustments (leading {@code mrow} {@code margin-top} and the trailing
 * descent {@code mspace}) so a fresh measurement reflects natural row heights.
 * @param {Element[]} mtrs
 * @returns {void}
 */
function resetWrappedMlabeledtrSyncOnRows(mtrs) {
  for (const mtr of mtrs) {
    for (const mtd of mtr.children) {
      if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
      const mrow = getFirstMrowChild(/** @type {Element} */ (mtd));
      if (!mrow) continue;
      /** @type {HTMLElement} */ (mrow).style.marginTop = '';
      const last = mrow.lastElementChild;
      if (
        last &&
        last.namespaceURI === MATHML_NS &&
        last.localName === 'mspace' &&
        last.hasAttribute('data-mlabeledtr-descent-pad')
      ) {
        last.remove();
      }
    }
  }
}

/**
 * Measure the row's natural ascent (rect top → baseline probe top) and descent (probe top → rect
 * bottom) using the first MathML {@code mtd} that has a leading baseline probe. Returns zeros when no
 * usable probe is found.
 * @param {Element} mtr
 * @returns {{ ascent: number, descent: number }}
 */
function measureMtrBaselineGeometry(mtr) {
  for (const mtd of mtr.children) {
    if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
    const mrow = getFirstMrowChild(/** @type {Element} */ (mtd));
    if (!mrow) continue;
    const probe = mrow.firstElementChild;
    if (!isZeroBaselineProbe(probe)) continue;
    const mtdRect = /** @type {Element} */ (mtd).getBoundingClientRect();
    const probeRect = /** @type {Element} */ (probe).getBoundingClientRect();
    const ascent = Math.max(0, probeRect.top - mtdRect.top);
    const descent = Math.max(0, mtdRect.bottom - probeRect.top);
    return { ascent, descent };
  }
  return { ascent: 0, descent: 0 };
}

/**
 * Apply baseline-sync adjustments: shift each cell's leading {@code mrow} down by
 * {@code ascent - ownAscent} via {@code margin-top}, and append a trailing {@code <mspace depth>} of
 * {@code descent - ownDescent} so the row's bottom extends to the unified row height.
 * @param {Element} mtr
 * @param {number} ascent Unified row ascent (px).
 * @param {number} descent Unified row descent (px).
 * @param {number} ownAscent Row's own ascent before adjustment (px).
 * @param {number} ownDescent Row's own descent before adjustment (px).
 * @returns {void}
 */
function applyWrappedMlabeledtrRowSync(mtr, ascent, descent, ownAscent, ownDescent) {
  const dyAscent = Math.max(0, ascent - ownAscent);
  const dyDescent = Math.max(0, descent - ownDescent);
  for (const mtd of mtr.children) {
    if (mtd.namespaceURI !== MATHML_NS || mtd.localName !== 'mtd') continue;
    const mrow = getFirstMrowChild(/** @type {Element} */ (mtd));
    if (!mrow) continue;
    /** @type {HTMLElement} */ (mrow).style.marginTop = dyAscent > 0 ? `${dyAscent}px` : '';
    if (dyDescent > 0) {
      const doc = mtd.ownerDocument;
      if (!doc) continue;
      const sp = doc.createElementNS(MATHML_NS, 'mspace');
      sp.setAttribute('width', '0');
      sp.setAttribute('height', '0');
      sp.setAttribute('depth', `${dyDescent}px`);
      sp.setAttribute('data-mlabeledtr-descent-pad', '');
      mrow.appendChild(sp);
    }
  }
}

/**
 * Per-row baseline + height sync for a wrapped {@code mlabeledtr} table on the native path. For each
 * row, equalize ascent (row top → baseline) and descent (baseline → row bottom) between the equation
 * and label inner {@code mtable}s so the label sits on its equation row's baseline regardless of
 * mismatched row content heights or differing baselines.
 * @param {Element} outerMtable
 * @returns {void}
 */
function runWrappedMlabeledtrBaselineSync(outerMtable) {
  if (!outerMtable || !outerMtable.isConnected) return;
  const eqMtable = findWrappedInnerMtable(outerMtable, 'data-mlabeledtr-equation-table');
  const labMtable = findWrappedInnerMtable(outerMtable, 'data-mlabeledtr-label-table');
  if (!eqMtable || !labMtable) return;

  const eqRows = Array.from(eqMtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  const labRows = Array.from(labMtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  if (eqRows.length === 0 || eqRows.length !== labRows.length) return;

  resetWrappedMlabeledtrSyncOnRows(eqRows);
  resetWrappedMlabeledtrSyncOnRows(labRows);
  forceLayout(outerMtable);

  for (let i = 0; i < eqRows.length; i++) {
    const eqRow = eqRows[i];
    const labRow = labRows[i];
    const eqGeom = measureMtrBaselineGeometry(eqRow);
    const labGeom = measureMtrBaselineGeometry(labRow);
    const A = Math.max(eqGeom.ascent, labGeom.ascent);
    const D = Math.max(eqGeom.descent, labGeom.descent);
    applyWrappedMlabeledtrRowSync(eqRow, A, D, eqGeom.ascent, eqGeom.descent);
    applyWrappedMlabeledtrRowSync(labRow, A, D, labGeom.ascent, labGeom.descent);
  }
}

/**
 * Schedule {@link runWrappedMlabeledtrBaselineSync} on layout / size changes (double {@code rAF} on
 * setup plus a {@code ResizeObserver} on the outer table).
 * @param {Element} outerMtable
 * @returns {void}
 */
function scheduleWrappedMlabeledtrBaselineSync(outerMtable) {
  const prev = wrappedMlabeledtrResizeObservers.get(outerMtable);
  if (prev) {
    prev.disconnect();
    wrappedMlabeledtrResizeObservers.delete(outerMtable);
  }
  const run = () => runWrappedMlabeledtrBaselineSync(outerMtable);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(run);
    });
    ro.observe(outerMtable);
    wrappedMlabeledtrResizeObservers.set(outerMtable, ro);
  }
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * @param {Element} mtable
 * @returns {{ rows: Element[], placed: PlacedCell[] }}
 */
function listTableRowsAndCells(mtable) {
  /** @type {Element[]} */
  const rows = Array.from(mtable.children).filter(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtr'
  );
  /** @type {PlacedCell[]} */
  const placed = [];

  for (let r = 0; r < rows.length; r++) {
    const rowEl = rows[r];
    const cells = Array.from(rowEl.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    let c = 0;
    for (const mtd of cells) {
      wrapMtdInferredMrow(mtd);
      placed.push({ mtd, row: r, col: c });
      c += 1;
    }
  }
  return { rows, placed };
}

/**
 * Parse {@code mtable@align}: {@code ("top"|"bottom"|"center"|"baseline"|"axis") rownumber?}.
 * Row number may be separated by spaces or commas (e.g. {@code "baseline 2"}, {@code "baseline,2"}).
 * @param {string | null | undefined} raw
 * @returns {{ mode: string, row1Based: number | null }}
 */
function parseMtableAlign(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { mode: 'axis', row1Based: null };
  }
  const parts = String(raw)
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return { mode: 'axis', row1Based: null };
  }
  /** @type {number | null} */
  let row1Based = null;
  /** @type {string[]} */
  let modeParts = parts;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^-?\d+$/.test(last)) {
      row1Based = parseInt(last, 10);
      modeParts = parts.slice(0, -1);
    }
  }
  const modeToken = modeParts.join(' ');
  const mode = normalizeEnum(modeToken, ROWALIGN_VALUES, 'axis');
  return { mode, row1Based };
}

/**
 * @param {string | null | undefined} raw
 * @param {boolean} defaultVal
 * @returns {boolean}
 */
function parseBooleanAttr(raw, defaultVal) {
  if (raw == null || String(raw).trim() === '') return defaultVal;
  const t = String(raw).trim().toLowerCase();
  if (t === 'true' || t === 'yes' || t === '1') return true;
  if (t === 'false' || t === 'no' || t === '0') return false;
  return defaultVal;
}

/**
 * @param {string | null | undefined} raw
 * @returns {[string, string]}
 */
function parseFramespacing(raw) {
  const parts = parseSpaceList(raw);
  if (parts.length === 0) return ['0.4em', '0.5ex'];
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts[0], parts[1]];
}

/**
 * @param {Element} el
 * @param {string} extraCss
 * @returns {void}
 */
function appendInlineStyle(el, extraCss) {
  const cur = el.getAttribute('style') || '';
  const t = cur.trim();
  const add = extraCss.trim();
  if (!add) return;
  el.setAttribute('style', t ? `${t}; ${add}` : add);
}

/**
 * Apply {@code frame} on {@code mtable}, internal {@code rowlines} as a full-width
 * {@code border-top} on each {@code mtr} after the first (or on equation {@code mtd}s only when
 * {@code data-mlabeledtr-expanded} is set), and {@code columnlines} as
 * {@code border-left} on {@code mtd} from the second column onward. When {@code internalLinesVisible}
 * is true and there is no frame, each {@code mtr} gets {@code min-width: 100%}. When there is a frame,
 * rows use negative margins equal to {@code framespacing} and {@code width: calc(100% + …)} so internal
 * rules meet the inner edge of the frame border (the grid extends into the padding band). With
 * {@code data-mlabeledtr-expanded} and a non-{@code none} {@code frame}, the outline is drawn on equation
 * {@code mtd}s only (see {@link appendEquationOnlyFrameBorders}). Last-row cells get extra
 * {@code padding-bottom} on equation columns so vertical column borders reach the bottom padding edge.
 * @param {Element} mtable
 * @param {string[]} rowlines
 * @param {string[]} columnlines
 * @param {string} frame
 * @param {string} hFrameSpace
 * @param {string} vFrameSpace
 * @param {PlacedCell[]} placed
 * @param {Element[]} rows Each {@code mtr} (same order as {@code listTableRowsAndCells}).
 * @param {boolean} internalLinesVisible Any non-{@code none} {@code rowlines} or {@code columnlines}.
 * @returns {void}
 */
function applyLineAndFrameStyles(
  mtable,
  rowlines,
  columnlines,
  frame,
  hFrameSpace,
  vFrameSpace,
  placed,
  rows,
  internalLinesVisible
) {
  const frameStyle = normalizeEnum(frame, LINESTYLE_VALUES, 'none');
  const borderStyle = frameStyle === 'none' ? 'none' : frameStyle;
  const frameCss =
    frameStyle === 'none'
      ? ''
      : `border: 0.067em ${borderStyle} currentColor; padding: ${vFrameSpace} ${hFrameSpace}; box-sizing: border-box;`;
  const expandedLabeled = mtable.hasAttribute('data-mlabeledtr-expanded');
  const ncolsLabeled = expandedLabeled ? maxColumnCount(rows) : 0;
  const sideLabeled = normalizeMtableSide(mtable.getAttribute('side'));
  const labelColPhysical =
    expandedLabeled && ncolsLabeled >= 2 ? (sideLabeled === 'right' ? ncolsLabeled - 1 : 0) : -1;

  if (frameStyle !== 'none' && expandedLabeled) {
    appendInlineStyle(
      mtable,
      `border: none; padding: ${vFrameSpace} ${hFrameSpace}; box-sizing: border-box;`
    );
    appendEquationOnlyFrameBorders(mtable, placed, rows, borderStyle);
  } else if (frameCss) {
    appendInlineStyle(mtable, frameCss);
  }

  if (internalLinesVisible && frameStyle !== 'none') {
    appendInlineStyle(mtable, 'overflow: visible;');
  }

  if (internalLinesVisible) {
    const n = rows.length;
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      const bits = ['box-sizing: border-box'];
      if (frameStyle !== 'none') {
        bits.push(`margin-left: -${hFrameSpace}`);
        bits.push(`margin-right: -${hFrameSpace}`);
        bits.push(`width: calc(100% + ${hFrameSpace} + ${hFrameSpace})`);
        if (i === 0) bits.push(`margin-top: -${vFrameSpace}`);
        if (i === n - 1) bits.push(`margin-bottom: -${vFrameSpace}`);
      } else {
        bits.push('min-width: 100%');
      }
      appendInlineStyle(r, bits.join('; '));
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const rl = pickListEntry(rowlines, i - 1, 'none');
    if (rl === 'none') continue;
    if (labelColPhysical >= 0) {
      for (const p of placed) {
        if (p.row !== i || p.col === labelColPhysical) continue;
        appendInlineStyle(
          p.mtd,
          `border-top: 0.067em ${rl} currentColor; box-sizing: border-box;`
        );
      }
    } else {
      appendInlineStyle(
        rows[i],
        `border-top: 0.067em ${rl} currentColor; box-sizing: border-box;`
      );
    }
  }

  for (const p of placed) {
    const { mtd, col } = p;
    if (col <= 0) continue;
    const cl = resolveColumnlineForMtdBorderLeft(mtable, col, columnlines, rows);
    if (cl === 'none') continue;
    appendInlineStyle(
      mtd,
      `border-left: 0.067em ${cl} currentColor; box-sizing: border-box;`
    );
  }

  if (internalLinesVisible && frameStyle !== 'none' && rows.length > 0) {
    const lastR = rows.length - 1;
    for (const p of placed) {
      if (p.row === lastR && p.col !== labelColPhysical) {
        appendInlineStyle(p.mtd, `padding-bottom: ${vFrameSpace}; box-sizing: border-box;`);
      }
    }
  }
}

/**
 * @param {Element} mtable
 * @returns {{ rowalign: string[], columnalign: string[] }} Non-empty lists; absent attributes become
 *   {@code ['baseline']} and {@code ['center']}.
 */
function readMtableAlignLists(mtable) {
  let rowalign = parseSpaceList(mtable.getAttribute('rowalign')).map((t) =>
    normalizeEnum(t, ROWALIGN_VALUES, 'baseline')
  );
  if (!rowalign.length) {
    rowalign = ['baseline'];
  }
  let columnalign = parseSpaceList(mtable.getAttribute('columnalign')).map((t) =>
    normalizeEnum(t, COLUMNALIGN_VALUES, 'center')
  );
  if (!columnalign.length) {
    columnalign = ['center'];
  }
  return { rowalign, columnalign };
}

/**
 * MathML 4 defaults for {@code mtable}: {@code rowalign} baseline, {@code columnalign} center.
 * The {@code mtable} (or each {@code mtr} when subgrid is unsupported) grid sets
 * {@code justify-items: stretch}. With column subgrid, the outer {@code mtable} uses
 * {@code align-items: first baseline} by default, or {@code stretch} when {@code equalrows} is true
 * so each {@code mtr} fills {@code 1fr} row tracks (columnlines on {@code mtd} span the row).
 * Each {@code mtr} row grid uses {@code align-items: stretch} when internal grid lines are visible
 * so {@code mtd} boxes fill row tracks (continuous column rules). Vertical {@code rowalign} is
 * applied after layout via {@link runLinedMtdVerticalLayout} (margin on the leading {@code mrow}).
 * Each {@code mtd} gets {@code justify-self} / {@code text-align} from {@code columnalign} when lines
 * are off; for {@code rowalign} {@code top}/{@code center}/{@code bottom} without lines, {@code mtd} uses
 * {@code align-self: stretch} with {@code display: flex; flex-direction: column} and {@code justify-content}
 * so math sits at the top/center/bottom inside the row track (grid {@code align-items: first baseline} on
 * {@code mtr} otherwise fights {@code align-self: end} for tall cells). With lines, {@code display: flex}
 * and {@code align-items} map horizontal placement (MathML often ignores {@code text-align} on {@code mtd}).
 * {@code axis} also gets composed {@code padding-top} with row spacing (U+2212 probe or {@code ex} fallback).
 * {@link readMtableAlignLists} supplies {@code ['baseline']} / {@code ['center']} when {@code mtable}
 * omits those attributes.
 *
 * @param {Element} mtd
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {string[]} mtableRowalign
 * @param {string[]} mtableColumnalign
 * @param {Element | null} mtr
 * @param {boolean} cellMinWidthZero When true, set {@code min-width: 0} so {@code mtd} can shrink inside
 *   {@code minmax(0, 1fr)} tracks ({@code equalcolumns} or {@code columnwidth="fit"}). Omit otherwise so
 *   {@code auto} columns keep an intrinsic minimum width (avoids crushing MathML in narrow tracks).
 * @param {boolean} internalLinesVisible When true, stretch cells for grid lines and column flex; vertical
 *   alignment is finalized by {@link scheduleLinedMtdVerticalLayout}.
 * @param {Element} mtable
 * @returns {void}
 */
function applyCellAlignments(
  mtd,
  rowIndex,
  colIndex,
  mtableRowalign,
  mtableColumnalign,
  mtr,
  cellMinWidthZero,
  internalLinesVisible,
  mtable
) {
  const ra = resolveEffectiveRowalign(mtd, rowIndex, colIndex, mtableRowalign, mtr, mtable);
  const ca = resolveEffectiveColumnalign(mtd, colIndex, mtableColumnalign, mtr, mtable);
  const parts = [];
  if (cellMinWidthZero) {
    parts.push('min-width: 0');
  }
  if (internalLinesVisible) {
    parts.push('box-sizing: border-box');
    parts.push('justify-self: stretch');
    parts.push('align-self: stretch');
    parts.push('display: flex');
    parts.push('flex-direction: column');
    parts.push('width: 100%');
    parts.push('height: 100%');
    parts.push('min-height: 0');
    parts.push(`align-items: ${columnalignToJustifyContent(ca)}`);
  } else {
    parts.push(`justify-self: ${columnalignToJustifySelf(ca)}`);
    if (ra === 'top' || ra === 'bottom' || ra === 'center') {
      parts.push('align-self: stretch');
      parts.push('display: flex');
      parts.push('flex-direction: column');
      parts.push('width: 100%');
      parts.push('height: 100%');
      parts.push('min-height: 0');
      parts.push(`justify-content: ${rowalignToFlexMainJustify(ra)}`);
      parts.push(`align-items: ${columnalignToJustifyContent(ca)}`);
    } else {
      parts.push('align-self: baseline');
    }
  }
  parts.push(`text-align: ${columnalignToTextAlign(ca)}`);
  appendInlineStyle(mtd, `${parts.join('; ')};`);
}

/**
 * @param {Element[]} rows
 * @returns {number}
 */
function maxColumnCount(rows) {
  let n = 0;
  for (const row of rows) {
    let c = 0;
    for (const child of row.children) {
      if (child.namespaceURI === MATHML_NS && child.localName === 'mtd') c += 1;
    }
    if (c > n) n = c;
  }
  return n;
}

/**
 * {@code border-left} on an {@code mtd} at physical column {@code physicalCol} draws the line between
 * columns {@code physicalCol - 1} and {@code physicalCol}. When {@code data-mlabeledtr-expanded} is set,
 * {@code columnlines} tokens apply only between equation columns (no rule touching the label column).
 * @param {Element} mtable
 * @param {number} physicalCol
 * @param {string[]} columnlines
 * @param {Element[]} rows
 * @returns {string}
 */
function resolveColumnlineForMtdBorderLeft(mtable, physicalCol, columnlines, rows) {
  if (physicalCol <= 0) return 'none';
  if (!mtable.hasAttribute('data-mlabeledtr-expanded')) {
    return pickListEntry(columnlines, physicalCol - 1, 'none');
  }
  const n = maxColumnCount(rows);
  if (n < 2) return pickListEntry(columnlines, physicalCol - 1, 'none');
  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;
  const leftCol = physicalCol - 1;
  const rightCol = physicalCol;
  if (leftCol === labelCol || rightCol === labelCol) {
    return 'none';
  }
  const listIndex = side === 'right' ? physicalCol - 1 : physicalCol - 2;
  return pickListEntry(columnlines, listIndex, 'none');
}

/**
 * Draw {@code frame} on the equation block only (perimeter {@code mtd} borders). The label column is
 * skipped so the outline does not wrap the label.
 * @param {Element} mtable
 * @param {PlacedCell[]} placed
 * @param {Element[]} rows
 * @param {string} borderStyle Normalized line style (not {@code none}).
 * @returns {void}
 */
function appendEquationOnlyFrameBorders(mtable, placed, rows, borderStyle) {
  const n = maxColumnCount(rows);
  if (n < 2) return;
  const side = normalizeMtableSide(mtable.getAttribute('side'));
  const labelCol = side === 'right' ? n - 1 : 0;
  const firstEq = side === 'right' ? 0 : 1;
  const lastEq = side === 'right' ? n - 2 : n - 1;
  const lastR = rows.length - 1;
  const bw = `0.067em ${borderStyle} currentColor`;
  for (const p of placed) {
    if (p.col === labelCol) continue;
    const bits = [];
    if (p.row === 0) bits.push(`border-top: ${bw}`);
    if (p.row === lastR) bits.push(`border-bottom: ${bw}`);
    if (p.col === firstEq) bits.push(`border-left: ${bw}`);
    if (p.col === lastEq) bits.push(`border-right: ${bw}`);
    if (!bits.length) continue;
    bits.unshift('box-sizing: border-box');
    appendInlineStyle(p.mtd, bits.join('; '));
  }
}

/**
 * @param {string[]} columnwidthList
 * @param {number} cols
 * @returns {string}
 */
function buildGridTemplateColumns(columnwidthList, cols) {
  if (cols <= 0) return 'none';
  if (!columnwidthList.length) return `repeat(${cols}, auto)`;
  const out = [];
  for (let i = 0; i < cols; i++) {
    const raw = pickListEntry(columnwidthList, i, 'auto');
    const t = normToken(raw);
    if (t === 'auto') out.push('auto');
    else if (t === 'fit') out.push('minmax(0, 1fr)');
    else out.push(raw);
  }
  return out.join(' ');
}

/**
 * @param {number} row1Based
 * @param {number} numRows
 * @returns {number}
 */
function resolveRowIndex0(row1Based, numRows) {
  if (numRows <= 0) return -1;
  let r = row1Based > 0 ? row1Based - 1 : numRows + row1Based;
  if (r < 0 || r >= numRows) return -1;
  return r;
}

/**
 * Vertical center of a DOMRect (CSS pixels).
 * @param {DOMRect} r
 * @returns {number}
 */
function rectCenterY(r) {
  return r.top + r.height / 2;
}

/**
 * Vertical span (top, bottom, mid) of element children of {@code parent}, excluding {@code skip}.
 * @param {Element} parent
 * @param {Element} skip
 * @returns {{ top: number, bottom: number, mid: number } | null}
 */
function siblingsVerticalSpanExcluding(parent, skip) {
  let uTop = Infinity;
  let uBottom = -Infinity;
  for (const c of parent.children) {
    if (c === skip || c.nodeType !== 1) continue;
    const el = /** @type {Element} */ (c);
    const r = el.getBoundingClientRect();
    uTop = Math.min(uTop, r.top);
    uBottom = Math.max(uBottom, r.bottom);
  }
  if (!Number.isFinite(uTop) || uTop === Infinity) return null;
  return { top: uTop, bottom: uBottom, mid: (uTop + uBottom) / 2 };
}

/**
 * Measure the environment line baseline at the {@code mtable}'s position by inserting a zero-sized
 * {@code <mspace>} sibling and reading its bounding-rect top (which equals the line baseline).
 * @param {Element} mtable
 * @returns {number | null}
 */
function measureEnvironmentBaselineY(mtable) {
  const doc = mtable.ownerDocument;
  const parent = mtable.parentElement;
  if (!doc || !parent) return null;
  const probe = doc.createElementNS(MATHML_NS, 'mspace');
  probe.setAttribute('width', '0');
  probe.setAttribute('height', '0');
  probe.setAttribute('depth', '0');
  parent.insertBefore(probe, mtable.nextSibling);
  forceLayout(probe);
  const baselineY = probe.getBoundingClientRect().top;
  probe.remove();
  if (!Number.isFinite(baselineY)) return null;
  return baselineY;
}

/**
 * Measure the baseline Y and full vertical extent of {@code mtd}'s laid-out content. Wraps the
 * existing content in {@code <mrow><mspace/>…children…</mrow>} so the probe shares an explicit
 * MathML inferred-mrow baseline with the content (needed because inserting a probe directly into
 * {@code mtd} as a grid item can position it at the cell top rather than the baseline in some
 * engines, e.g. for {@code <mfrac>} content where baseline is at the fraction bar). Restores the
 * original children before returning.
 * @param {Element} mtd
 * @returns {{ baselineY: number, top: number, bottom: number } | null}
 */
function measureMtdDimensions(mtd) {
  const doc = mtd.ownerDocument;
  if (!doc) return null;
  const wrapper = doc.createElementNS(MATHML_NS, 'mrow');
  const probe = doc.createElementNS(MATHML_NS, 'mspace');
  probe.setAttribute('width', '0');
  probe.setAttribute('height', '0');
  probe.setAttribute('depth', '0');
  wrapper.appendChild(probe);
  /** @type {Node[]} */
  const moved = [];
  while (mtd.firstChild) {
    const n = mtd.firstChild;
    moved.push(n);
    wrapper.appendChild(n);
  }
  mtd.appendChild(wrapper);
  forceLayout(probe);
  const probeRect = probe.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  /** @type {{ baselineY: number, top: number, bottom: number } | null} */
  const result = Number.isFinite(probeRect.top)
    ? { baselineY: probeRect.top, top: wrapperRect.top, bottom: wrapperRect.bottom }
    : null;
  for (const n of moved) {
    mtd.appendChild(n);
  }
  wrapper.remove();
  return result;
}

/**
 * Sibling line geometry for aligning an {@code mtable} to its MathML environment. Uses a zero-sized
 * {@code <mspace>} probe to read the line baseline so we are not at the mercy of glyph bounding
 * boxes (e.g. {@code <mo>U+2212</mo>}, whose box may not reach the descender).
 * @param {Element} mtable
 * @returns {{ span: { top: number, bottom: number, mid: number } | null, refBaseline: number | null }}
 */
function readAlignEnvironmentRefs(mtable) {
  const parent = mtable.parentElement;
  if (!parent) return { span: null, refBaseline: null };
  const span = siblingsVerticalSpanExcluding(parent, mtable);
  const refBaseline = measureEnvironmentBaselineY(mtable);
  return { span, refBaseline };
}

/**
 * Run {@code fn} after the table is in the document and layout has produced reliable bounds
 * ({@code queueMicrotask} + double {@code requestAnimationFrame}, then {@link forceLayout}).
 * @param {Element} mtable
 * @param {() => void} fn
 * @returns {void}
 */
function scheduleDeferredTableLayoutTask(mtable, fn) {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mtable.isConnected) return;
        forceLayout(mtable);
        fn();
      });
    });
  });
}

/**
 * After layout, adjust {@code mtable@align} when no row index is given (whole table vs siblings).
 * Uses {@link applyAlignShift} which combines {@code transform: translateY} with directional padding
 * so the table actually moves (math layout ignores {@code vertical-align}) while the layout box
 * grows to fit (no HTML {@code td} clipping).
 * @param {Element} mtable
 * @param {string} mode
 * @param {Element[]} rows
 * @returns {void}
 */
function scheduleWholeMtableAlignAdjustment(mtable, mode, rows) {
  scheduleDeferredTableLayoutTask(mtable, () => {
    const { refBaseline } = readAlignEnvironmentRefs(mtable);
    if (refBaseline == null) return;

    const tableRect = mtable.getBoundingClientRect();
    const m = normalizeEnum(mode, ROWALIGN_VALUES, 'axis');
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    const axisPx = ax != null && ax > 0 ? ax : convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX);

    /** @type {number} */
    let dy = 0;
    if (m === 'top') {
      dy = refBaseline - tableRect.top;
    } else if (m === 'bottom') {
      dy = refBaseline - tableRect.bottom;
    } else if (m === 'center' || m === 'baseline') {
      dy = refBaseline - rectCenterY(tableRect);
    } else if (m === 'axis') {
      dy = refBaseline - axisPx - rectCenterY(tableRect);
    } else {
      return;
    }

    if (!Number.isFinite(dy) || Math.abs(dy) < 0.25) return;
    applyAlignShift(mtable, dy);
  });
}

/**
 * Apply a vertical shift to {@code mtable} that is robust against MathML layout. Uses
 * {@code transform: translateY} for the visual move (CSS {@code vertical-align} and {@code margin}
 * are ignored by some browsers for math children) and grows the box with padding so the
 * surrounding line / HTML {@code td} accommodates the shift (prevents the painted content from
 * spilling beyond the table's layout box and being clipped/overlapped).
 * @param {Element} mtable
 * @param {number} dy positive = shift down, negative = shift up (CSS px)
 * @returns {void}
 */
function applyAlignShift(mtable, dy) {
  const padTop = dy < 0 ? -dy : 0;
  const padBottom = dy > 0 ? dy : 0;
  const css = [
    `transform: translateY(${dy}px)`,
    `padding-top: ${padTop}px`,
    `padding-bottom: ${padBottom}px`,
    'box-sizing: content-box',
  ].join('; ');
  appendInlineStyle(mtable, `${css};`);
}

/**
 * After layout, adjust {@code mtable@align} when a row number is given: that row's geometry is
 * aligned to the MathML environment (sibling baseline / axis), not to the whole-table box.
 * @param {Element} mtable
 * @param {{ mode: string, row1Based: number | null }} alignSpec
 * @param {Element[]} rows
 * @returns {void}
 */
function scheduleAlignRowAdjustment(mtable, alignSpec, rows) {
  const { mode, row1Based } = alignSpec;
  if (row1Based == null) return;
  const r0 = resolveRowIndex0(row1Based, rows.length);
  if (r0 < 0) return;

  scheduleDeferredTableLayoutTask(mtable, () => {
    const { refBaseline } = readAlignEnvironmentRefs(mtable);
    if (refBaseline == null) return;

    const rowEl = rows[r0];
    const mtds = Array.from(rowEl.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    if (!mtds.length) return;

    let uTop = Infinity;
    let uBottom = -Infinity;
    /** @type {number | null} */
    let rowBaseline = null;
    for (const mtd of mtds) {
      const dims = measureMtdDimensions(mtd);
      if (!dims) continue;
      uTop = Math.min(uTop, dims.top);
      uBottom = Math.max(uBottom, dims.bottom);
      rowBaseline = rowBaseline == null ? dims.baselineY : Math.max(rowBaseline, dims.baselineY);
    }
    if (
      rowBaseline == null ||
      !Number.isFinite(rowBaseline) ||
      !Number.isFinite(uTop) ||
      !Number.isFinite(uBottom)
    ) {
      return;
    }
    const rowMid = (uTop + uBottom) / 2;
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    const axisPx = ax != null && ax > 0 ? ax : convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX);

    const m = normalizeEnum(mode, ROWALIGN_VALUES, 'axis');
    /** @type {number} */
    let dy = 0;
    if (m === 'top') {
      dy = refBaseline - uTop;
    } else if (m === 'bottom') {
      dy = refBaseline - uBottom;
    } else if (m === 'center') {
      dy = refBaseline - rowMid;
    } else if (m === 'baseline') {
      dy = refBaseline - rowBaseline;
    } else if (m === 'axis') {
      // Row's math axis sits axisPx above its typographic baseline; the environment's axis is
      // axisPx above its baseline. The axisPx terms cancel, so the required shift is the same as
      // baseline alignment: bring row_baseline onto env_baseline.
      dy = refBaseline - axisPx - (rowBaseline - axisPx);
    } else {
      return;
    }

    if (!Number.isFinite(dy) || Math.abs(dy) < 0.25) return;
    applyAlignShift(mtable, dy);
  });
}

/**
 * MathML 4: if {@code displaystyle} is absent on {@code mtable}, it is false inside the table.
 * @param {Element} mtable
 * @param {boolean} hadDisplaystyleAttr
 * @returns {void}
 */
function applyDisplaystyleDefault(mtable, hadDisplaystyleAttr) {
  if (!hadDisplaystyleAttr) {
    mtable.setAttribute('displaystyle', 'false');
    return;
  }
  const on = parseBooleanAttr(mtable.getAttribute('displaystyle'), false);
  mtable.setAttribute('displaystyle', on ? 'true' : 'false');
}

/** @type {WeakMap<Element, ResizeObserver>} */
const linedMtableResizeObservers = new WeakMap();

/**
 * With visible internal lines, {@code mtr}/{@code mtd} stay stretched so column borders span the row;
 * vertical {@code rowalign} is applied by setting {@code margin-top} on each cell’s leading {@code mrow}
 * after layout (baseline/axis share a reference depth from a leading zero {@code mspace}).
 * @param {Element} mtable
 * @param {Element[]} rows
 * @param {string[]} mtableRowalign
 * @returns {void}
 */
function runLinedMtdVerticalLayout(mtable, rows, mtableRowalign) {
  if (!mtable || !rows.length) return;

  for (let r = 0; r < rows.length; r++) {
    const mtr = rows[r];
    const cells = Array.from(mtr.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    for (const mtd of cells) {
      const mrow = getFirstMrowChild(mtd);
      if (mrow) mrow.style.marginTop = '0';
    }
  }
  forceLayout(mtable);

  for (let r = 0; r < rows.length; r++) {
    const mtr = rows[r];
    const cells = Array.from(mtr.children).filter(
      (n) => n.namespaceURI === MATHML_NS && n.localName === 'mtd'
    );
    if (!cells.length) continue;

    const innerHs = cells.map((mtd) => {
      const cs = getComputedStyle(mtd);
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      return Math.max(0, mtd.clientHeight - pt - pb);
    });
    const H = Math.max(...innerHs, 0);

    /** @type {{ mrow: Element; ra: string; h: number; b: number }[]} */
    const items = [];
    let col = 0;
    for (const mtd of cells) {
      const ra = resolveEffectiveRowalign(mtd, r, col, mtableRowalign, mtr, mtable);
      col += 1;
      const mrow = getFirstMrowChild(mtd);
      if (!mrow) continue;

      const cs = getComputedStyle(mtd);
      const borderTop = parseFloat(cs.borderTopWidth) || 0;
      const padTop = parseFloat(cs.paddingTop) || 0;
      const mtdRect = mtd.getBoundingClientRect();
      const contentTopY = mtdRect.top + borderTop + padTop;
      const mrowRect = mrow.getBoundingClientRect();
      const h = mrowRect.height;
      const probe = mrow.firstElementChild;
      let b = 0;
      if (isZeroBaselineProbe(probe)) {
        b = probe.getBoundingClientRect().top - contentTopY;
      } else if (h > 0) {
        b = h * 0.75;
      }
      items.push({ mrow, ra, h, b });
    }

    let refBaseline = 0;
    for (const it of items) {
      if (it.ra === 'baseline' || it.ra === 'axis') {
        refBaseline = Math.max(refBaseline, it.b);
      }
    }

    for (const it of items) {
      const { mrow, ra, h, b } = it;
      let t = 0;
      if (ra === 'top') t = 0;
      else if (ra === 'bottom') t = Math.max(0, H - h);
      else if (ra === 'center') t = Math.max(0, (H - h) / 2);
      else if (ra === 'baseline' || ra === 'axis') t = Math.max(0, refBaseline - b);
      mrow.style.marginTop = `${t}px`;
    }
  }
  forceLayout(mtable);
}

/**
 * @param {Element} mtable
 * @param {Element[]} rows
 * @param {string[]} mtableRowalign
 * @returns {void}
 */
function scheduleLinedMtdVerticalLayout(mtable, rows, mtableRowalign) {
  const prev = linedMtableResizeObservers.get(mtable);
  if (prev) {
    prev.disconnect();
    linedMtableResizeObservers.delete(mtable);
  }
  const run = () => runLinedMtdVerticalLayout(mtable, rows, mtableRowalign);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(run);
    });
    ro.observe(mtable);
    linedMtableResizeObservers.set(mtable, ro);
  }
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * Apply MathML 4 table presentation attributes using CSS on {@code mtable}, {@code mtr}, and {@code mtd}.
 * Expands {@code mlabeledtr} to {@code mtr} when required for the CSS grid path or when the UA does not
 * honor {@code mtable@side} on labeled rows (see {@link detectNativeMlabeledtrSideLayout}). Per-gap
 * {@code rowspacing} / {@code columnspacing} use cell margins (grid row-gap/column-gap are uniform).
 * @param {Element} mtable
 * @returns {Element}
 */
function applyMtablePresentationAttrsWithCss(mtable) {
  if (!mtable || mtable.localName !== 'mtable' || mtable.namespaceURI !== MATHML_NS) {
    return mtable;
  }

  const nativeTableAttrs = detectNativeMtablePresentationAttrs();
  const hasMlabeledtr = Array.from(mtable.children).some(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mlabeledtr'
  );
  if (hasMlabeledtr && (!nativeTableAttrs || !detectNativeMlabeledtrSideLayout())) {
    expandMlabeledtrRows(mtable);
  } else {
    mtable.removeAttribute('data-mlabeledtr-expanded');
  }

  if (nativeTableAttrs && mtable.hasAttribute('data-mlabeledtr-expanded')) {
    wrapExpandedMtableForNativeEquationLabelSplit(mtable);
  }

  if (nativeTableAttrs) {
    return mtable;
  }

  const hadDisplaystyleAttr =
    mtable.hasAttribute('displaystyle') && String(mtable.getAttribute('displaystyle')).trim() !== '';

  const { rows, placed } = listTableRowsAndCells(mtable);
  if (!rows.length) {
    applyDisplaystyleDefault(mtable, hadDisplaystyleAttr);
    return mtable;
  }

  const cols = maxColumnCount(rows);
  const mtableRowspacing = parseSpaceList(mtable.getAttribute('rowspacing'));
  const mtableColumnspacing = parseSpaceList(mtable.getAttribute('columnspacing'));
  const defaultRowGap = '1.0ex';
  const defaultColGap = '0.8em';
  const equalrows = parseBooleanAttr(mtable.getAttribute('equalrows'), false);
  const equalcolumns = parseBooleanAttr(mtable.getAttribute('equalcolumns'), false);
  const columnwidthList = parseSpaceList(mtable.getAttribute('columnwidth'));
  const gridCols = equalcolumns
    ? `repeat(${cols}, minmax(0, 1fr))`
    : buildGridTemplateColumns(columnwidthList, cols);
  const gridRows = equalrows
    ? `repeat(${rows.length}, minmax(0, 1fr))`
    : `repeat(${rows.length}, auto)`;

  const { rowalign: mtableRowalign, columnalign: mtableColumnalign } = readMtableAlignLists(mtable);

  const rowlines = parseLineList(mtable.getAttribute('rowlines'), 'none');
  const columnlines = parseLineList(mtable.getAttribute('columnlines'), 'none');
  const internalLinesVisible =
    lineListHasVisible(columnlines) || lineListHasVisible(rowlines);
  // With subgrid, `mtable` row tracks can be taller than content (`equalrows` uses `1fr`). Baseline
  // alignment of `mtr` items leaves the row box short, so `mtd` borders (columnlines) do not span
  // the track — use stretch so each `mtr` fills its row when heights are equalized.
  const mtableOuterAlignItems = equalrows ? 'stretch' : 'first baseline';

  const useSubgrid = supportsColumnSubgrid();
  const gridColsPerMtr =
    !useSubgrid && internalLinesVisible
      ? `repeat(${cols}, minmax(0, 1fr))`
      : gridCols;
  if (useSubgrid) {
    appendInlineStyle(
      mtable,
      `display: inline-grid; vertical-align: baseline; grid-template-columns: ${gridCols}; grid-template-rows: ${gridRows}; row-gap: 0; column-gap: 0; justify-items: stretch; align-items: ${mtableOuterAlignItems};`
    );
    for (let i = 0; i < rows.length; i++) {
      const mtrRowAlignItems = internalLinesVisible ? 'stretch' : 'first baseline';
      appendInlineStyle(
        rows[i],
        `display: grid; grid-column: 1 / -1; grid-row: ${
          i + 1
        }; grid-template-columns: subgrid; grid-template-rows: auto; justify-items: stretch; align-items: ${mtrRowAlignItems};`
      );
    }
  } else {
    appendInlineStyle(
      mtable,
      `display: inline-grid; vertical-align: baseline; grid-template-columns: minmax(0, auto); grid-template-rows: ${gridRows}; row-gap: 0; column-gap: 0;`
    );
    for (let i = 0; i < rows.length; i++) {
      const mtrRowAlignItems = internalLinesVisible ? 'stretch' : 'first baseline';
      appendInlineStyle(
        rows[i],
        `display: grid; grid-template-columns: ${gridColsPerMtr}; grid-column: 1 / -1; grid-row: ${
          i + 1
        }; justify-items: stretch; align-items: ${mtrRowAlignItems};`
      );
    }
  }

  let axisShiftCss = `${convertToPx(mtable, AXIS_ROWALIGN_FALLBACK_EX)}px`;
  if (
    placed.some((p) => {
      const mtr = rows[p.row] ?? null;
      return resolveEffectiveRowalign(p.mtd, p.row, p.col, mtableRowalign, mtr, mtable) === 'axis';
    })
  ) {
    const ax = measureMathAxisHeightPxFromMinusU2212(mtable);
    if (ax != null && ax > 0) axisShiftCss = `${ax}px`;
  }

  for (const p of placed) {
    const mtr = rows[p.row] ?? null;
    const ra = resolveEffectiveRowalign(p.mtd, p.row, p.col, mtableRowalign, mtr, mtable);
    const mt = pickListEntry(mtableRowspacing, Math.max(0, p.row - 1), defaultRowGap);
      const ml = pickListEntry(mtableColumnspacing, Math.max(0, p.col - 1), defaultColGap);
    const spacing = [];
    if (internalLinesVisible) {
      spacing.push('box-sizing: border-box');
    }
    const rowSpaceKey = internalLinesVisible ? 'padding-top' : 'margin-top';
    const colSpaceKey = internalLinesVisible ? 'padding-left' : 'margin-left';
    if (p.row > 0) {
      const top = ra === 'axis' ? `calc(${mt} + ${axisShiftCss})` : mt;
      spacing.push(`${rowSpaceKey}: ${top}`);
    } else if (ra === 'axis') {
      spacing.push(`${rowSpaceKey}: ${axisShiftCss}`);
    }
    if (p.col > 0) spacing.push(`${colSpaceKey}: ${ml}`);
    if (spacing.length) appendInlineStyle(p.mtd, spacing.join('; '));
  }

  const widthAttr = mtable.getAttribute('width');
  if (widthAttr != null && String(widthAttr).trim() !== '') {
    const w = String(widthAttr).trim();
    const wt = normToken(w);
    appendInlineStyle(
      mtable,
      wt === 'auto' ? 'width: auto;' : `width: ${w}; max-width: 100%;`
    );
  }

  if (mtable.hasAttribute('align')) {
    const alignSpec = parseMtableAlign(mtable.getAttribute('align'));
    if (alignSpec.row1Based != null) {
      scheduleAlignRowAdjustment(mtable, alignSpec, rows);
    } else {
      scheduleWholeMtableAlignAdjustment(mtable, alignSpec.mode);
    }
  }

  applyDisplaystyleDefault(mtable, hadDisplaystyleAttr);

  const frame = mtable.getAttribute('frame') ?? 'none';
  const [hFrame, vFrame] = parseFramespacing(mtable.getAttribute('framespacing'));
  applyLineAndFrameStyles(
    mtable,
    rowlines,
    columnlines,
    frame,
    hFrame,
    vFrame,
    placed,
    rows,
    internalLinesVisible
  );

  for (const p of placed) {
    const mtr = rows[p.row] ?? null;
    const colWidthTok = normToken(
      pickListEntry(
        columnwidthList,
        presentationColumnListIndex(p.mtd, p.col, mtable, mtr),
        'auto'
      )
    );
    const cellMinWidthZero =
      equalcolumns || colWidthTok === 'fit' || (!useSubgrid && internalLinesVisible);
    applyCellAlignments(
      p.mtd,
      p.row,
      p.col,
      mtableRowalign,
      mtableColumnalign,
      mtr,
      cellMinWidthZero,
      internalLinesVisible,
      mtable
    );
  }

  if (internalLinesVisible) {
    scheduleLinedMtdVerticalLayout(mtable, rows, mtableRowalign);
  }

  return mtable;
}

/**
 * @param {Element} mtable
 * @returns {Element}
 */
function transformMtable(mtable) {
  const nativeTable = detectNativeMtablePresentationAttrs();
  const hasMlabeledtr = Array.from(mtable.children).some(
    (n) => n.namespaceURI === MATHML_NS && n.localName === 'mlabeledtr'
  );
  const needMlabeledtrDomFix = hasMlabeledtr && !detectNativeMlabeledtrSideLayout();

  if (nativeTable && !needMlabeledtrDomFix) {
    return mtable;
  }
  const c = cloneElementWithShadowRoot(mtable);
  applyMtablePresentationAttrsWithCss(c);
  return c;
}

_MathTransforms.add('mtable', transformMtable);

// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */


/** Uppercase `tagName` for the `m-elem-math` custom element. */
const M_ELEM_MATH_TAG = 'M-ELEM-MATH';

/** CSS for the grid container (`.elem-math`) and cells; concatenated into the global polyfill stylesheet. */
const ELEM_MATH_CSS = `
div.elem-math {
    display: inline-grid;
    grid-auto-flow: row;
    /* Use baseline so plain-digit cells line up with merged-carry cells whose digit sits below the carry. */
    align-items: baseline;
    grid-auto-columns: max-content;
    gap: 0;
}

.elem-math-cell {
    display: inline-block;
    /* IMPORTANT: do not set 'align-self: stretch' on every cell -- that overrides 'align-items: baseline'
       from the grid. Exception: cells that only draw a vertical rule (border-left/right) must stretch to
       the row height so the rule meets rows where neighbors use border-bottom (msline); otherwise the
       rule ends short by the border-bottom width. */
    position: relative;
    overflow: visible;
}

.elem-math-cell.elem-math-vrule-cell {
    align-self: stretch;
    box-sizing: border-box;
}

/* Empty rows added after underlines need explicit height (no content to give them one). */
.elem-math-spacer {
    align-self: stretch;
    height: .5ex;
}

/* Curved bracket: absolutely positioned child so placement is relative to the cell box, not the grid item. */
.elem-math-cell .curved-line {
    position: absolute;
    top: 0;
    left: 0;
    padding-top: 0em;
    width: 0.75em;
    border: 0.3ex solid;  /* match border bottom */
    transform: translate(0.48em, -0.15em);
    border-radius: 70%;
    clip-path: inset(0.1em 0 0 0.45em);
    box-sizing: border-box;
    margin-left: -0.85em;
    margin-right: 0.75em;
}

/* .precedes-separator / .separator / .follows-separator: horizontal padding set in JS (expandMStackElement). */

.carry {
    font-size: 60%;
    line-height: 90%;
    width: 1px;
    overflow: visible;
}

.hidden-digit {
    visibility: hidden;
}

.crossout-horiz, .crossout-vert, .crossout-up, .crossout-down{
    position: relative;
    display: inline-block;
}
.crossout-horiz:before {
    content: '';
    border-bottom: .3ex solid black;
    width: 140%;
    position: absolute;
    right: -20%;
    top: 40%;
}

.crossout-vert::before {
    content: '';
    border-left: .3ex solid black;
    height: 100%;
    position: absolute;
    right: 35%;
    top: 0%;
}

.crossout-up::before {
    content: '';
    width: 100%;
    position: absolute;
    right: 0;
    top: 40%;
}
.crossout-up::before {
    border-bottom: .2em solid black;
    transform: skewY(-60deg);
}

.crossout-down::after {
    content: '';
    width: 100%;
    position: absolute;
    right: 0;
    top: 40%;
}
.crossout-down::after {
    border-bottom: .2em solid black;
    transform: skewY(60deg);
}
`;

/** `msline` / `mslinethickness="thin"` resolved length. */
const MSLINETHICKNESS_THIN = '.1ex';
/** Default `mslinethickness="medium"`. */
const MSLINETHICKNESS_MEDIUM = '.35ex';
/** `mslinethickness="thick"`. */
const MSLINETHICKNESS_THICK = '.65ex';

/** `charspacing="tight"` on `mstack` / `mlongdiv`. */
const MSTACK_TIGHT = '0em';
/** `charspacing="medium"` (default). */
const MSTACK_MEDIUM = '.2em';
/** `charspacing="loose"`. */
const MSTACK_LOOSE = '.4em';

const NON_BREAKING_SPACE = '\u00A0';
/** Hair space (U+200A); placeholder in padded / empty cells so columns and borders lay out consistently. */
const NO_SPACE = '\u200A';

/**
 * Inherited MathML attributes gathered from ancestor `mstyle` and `math` (first wins per name).
 */
class MathMLAttrs {
    /**
     * @param {Element} el - Starting node (`mstack`, `mlongdiv`, or `mstyle` when merging).
     * @param {Record<string, string>} [previousAttrs] - Copy-on-write base when `el` is `mstyle`.
     */
    constructor(el, previousAttrs) {
        this.attrs = {};
        if (!previousAttrs) {
            while (el && el.tagName.toLowerCase() !== 'math') {
                if (el.tagName.toLowerCase() === 'mstyle') {
                    this.addAttrs(el);
                }
                el = el.parentElement;
            }
            if (el && el.tagName.toLowerCase() === 'math') {
                this.addAttrs(el);
            }
        } else {
            this.attrs = Object.assign({}, previousAttrs);
            if (el.tagName.toLowerCase() === 'mstyle') {
                for (let attr of el.attributes) {
                    this.attrs[attr.name] = attr.value;
                }
            }
        }
    }

    /**
     * Records attributes from `el` only for names not already in `this.attrs`.
     * @param {Element} el
     */
    addAttrs(el) {
        for (let attr of el.attributes) {
            if (!this.attrs[attr.name]) {
                this.attrs[attr.name] = attr.value;
            }
        }
    }

    /**
     * @param {Element} el
     * @param {string} name
     * @param {string} defaultVal
     * @returns {string}
     */
    getAttr(el, name, defaultVal) {
        if (el.hasAttribute(name)) {
            return el.getAttribute(name);
        }
        return this.attrs[name] ? this.attrs[name] : defaultVal;
    }
}

/** Metadata for one `mscarry` merged into a digit cell. */
class Carry {
    /**
     * @param {string} location - `mscarry` `location` (e.g. `n`, `nw`, `s`).
     * @param {string} crossout - `crossout` token(s).
     * @param {number} scriptsizemultiplier - Percent scale for carry glyph (e.g. 60).
     */
    constructor(location, crossout, scriptsizemultiplier) {
        this.location = location;
        this.crossout = crossout;
        this.scriptsizemultiplier = scriptsizemultiplier;
    }
}

/**
 * One column cell in the internal grid (digit, padding, carry wrapper, etc.).
 */
class TableCell {
    /**
     * @param {string | Element} value - Digit string, or element for `mscarry`.
     * @param {string} [style=''] - Extra inline CSS for the rendered cell.
     * @param {Carry} [carry] - If set, `value` must be an `Element`.
     */
    constructor(value, style, carry) {
        if (carry) {
            if (typeof value !== "object") {
                throw new Error("Elementary math mscarry isn't an 'object'");
            }
            this.data = document.createElement((carry.location === 'n' || carry.location === 's') ? 'div' : 'span');
            this.data.appendChild(value);
            this.data.className = 'carry';
            this.data.style.fontSize = Math.round(carry.scriptsizemultiplier).toString() + '%';
        } else {
            if (typeof value !== "string") {
                throw new Error("Elementary math mscarry isn't a 'string'");
            }
            // `<none/>` in `msrow` yields `''`; empty text collapses line height and breaks row `border-bottom` alignment.
            this.data = document.createTextNode(value === '' ? NO_SPACE : value);
        }
        /** @type {Carry | undefined} */
        this.carry = carry;
        this.style = style || '';
    }
}

/**
 * One row of {@link TableCell}s after `msgroup` / `position` shifts are applied.
 */
class TableRow {
    /**
     * @param {TableCell[]} data - Cells left-to-right.
     * @param {number} [digitsOnRight] - Cells right of decimal align point (includes `.`), for `stackalign="decimalpoint"`.
     * @param {number} [shift] - `msgroup` / `position` shift; negative pads left and adjusts `nRight`.
     */
    constructor(data, digitsOnRight, shift) {
        if (shift === 0) {
            this.data = data; 
        } else if (shift > 0) {
            this.data = this.padOnRight(data, shift);
        } else if (shift < 0) {
            this.data = this.padOnLeft(data, -shift);
            digitsOnRight -= shift;
        }
        this.nRight = digitsOnRight;
        this.shift = shift;
        this.style = '';
        /** Insert a spacer grid row after this one (e.g. after `msline` underline). */
        this.addSpacingAfterRow = false;
        /** Carry merge hint: `1` first line, `-1` last line, `0` none. */
        this.alignAt = 0;
    }

    /**
     * Full-width `border-bottom` on this row (e.g. `msline` with default length).
     * @param {string} lineUnderThickness - CSS border width (e.g. `.35ex`).
     * @param {string} color - `mathcolor` / resolved color.
     */
    addUnderline(lineUnderThickness, color) {
        this.style += `border-bottom: ${lineUnderThickness} solid ${color};`;
        this.addSpacingAfterRow = true;
    }

    /**
     * Underline a run of cells with `border-bottom` (finite `msline length`).
     * @param {number} shift - Column index offset (`msline` / `position`).
     * @param {number} length - Number of cells to underline.
     * @param {string} thickness - CSS border width.
     * @param {string} color - Border color.
     */
    addUnderlineToCells(shift, length, thickness, color) {
        let nLeftOfDecimalPoint = this.data.length - this.nRight;
        let right = nLeftOfDecimalPoint - shift;
        if (shift + length > nLeftOfDecimalPoint) {
            this.data = this.padOnLeft(this.data, shift + length - nLeftOfDecimalPoint);
            right = length;
        }
        if (shift < -this.nRight) {
            this.data = this.padOnRight(this.data, this.nRight - shift);
            this.nRight -= shift;
            right = this.data.length;
        }

        for (let i = right - length; i < right; i++) {
            this.data[i].style += `border-bottom: ${thickness} solid ${color};`;
        }
        this.addSpacingAfterRow = true;
    }

    /**
     * @param {TableCell[]} arr
     * @param {number} amount
     * @returns {TableCell[]}
     */
    padOnLeft(arr, amount) {
        let newCells = Array(amount);
        for (let i = 0; i < amount; i++) {
            newCells[i] = new TableCell(NO_SPACE);
        }
        return newCells.concat(arr);
    }
    
    /**
     * @param {TableCell[]} arr
     * @param {number} amount
     * @returns {TableCell[]}
     */
    padOnRight(arr, amount) {
        let newCells = Array(amount);
        for (let i = 0; i < amount; i++) {
            newCells[i] = new TableCell(NO_SPACE);
        }
        return arr.concat(newCells);
     }
}


/**
 * Expands one `mstack` or `mlongdiv` into a grid DOM. Rows are not stored on the instance; methods take {@link TableRow} arrays.
 */
class ElemMath {
    /**
     * @param {Element} mstackOrLongDiv - `mstack` or `mlongdiv` element.
     */
	constructor(mstackOrLongDiv) {
        this.stack = mstackOrLongDiv;
        this.attrs = new MathMLAttrs(mstackOrLongDiv);

        this.stackAlign = this.getAttr(mstackOrLongDiv, 'stackalign', 'decimalpoint');
        this.charAlign = this.getAttr(mstackOrLongDiv, 'charalign', 'right');
        this.charSpacing = this.getAttr(mstackOrLongDiv, 'charspacing', 'medium');
        if (this.charSpacing === 'loose') {
            this.charSpacing = MSTACK_LOOSE;
        } else if (this.charSpacing === 'medium') {
            this.charSpacing = MSTACK_MEDIUM;
        } else if (this.charSpacing === 'tight') {
            this.charSpacing = MSTACK_TIGHT;
        }

        this.longdivstyle = mstackOrLongDiv.tagName === 'mstack' ? '' : this.getAttr(mstackOrLongDiv, 'longdivstyle', 'lefttop');

        // FIX: todo -- not yet dealt with
        /* `align` on mstack is not implemented (source reads typo `algin`). */
        this.align = this.getAttr(mstackOrLongDiv,'algin', 'baseline');
    }

    /**
     * @param {Element} el
     * @param {string} name
     * @param {string} defaultVal
     * @returns {string}
     */
    getAttr(el, name, defaultVal) {
        return this.attrs.getAttr(el, name, defaultVal);
    }
    
    /**
     * Appends `newRow`, or merges it into the previous row when that row is `mscarries`.
     * @param {TableRow[]} rows
     * @param {TableRow} newRow
     * @returns {void}
     */
    add(rows, newRow) {
        /**
         * @param {TableCell} cell
         * @param {string} crossoutStyle - Space-separated `crossout` tokens.
         * @returns {TableCell}
         */
        function addCrossoutToData(cell, crossoutStyle) {
            const crossouts = crossoutStyle.split(' ');
            let result = cell.data;
            crossouts.forEach( function(crossout) {
                if (crossout === 'none' || crossout==='') {
                    return;
                }
                let span = document.createElement("span");
                span.appendChild(result);

                switch (crossout) {
                    case 'updiagonalstrike':
                        span.className = 'crossout-up';
                       break;
                    case 'downdiagonalstrike':
                        span.className = 'crossout-down';
                        break;
                    case 'verticalstrike':
                        span.className = 'crossout-vert';
                        break;
                    case 'horizontalstrike':
                        span.className = 'crossout-horiz';
                        break;
                    default:
                        span.className = 'crossout-up';
                        console.log(`Unknown crossout type '${crossoutStyle}`);
                        break;               
                }
                result = span;
            } );
            cell.data = result;
            return cell;
        }
        /**
         * @param {TableCell} cell
         * @param {TableCell} previousCell
         * @returns {TableCell}
         */
        function mergeCarryAndData(cell, previousCell) {
            let data = cell.data;
            if (data.textContent === NO_SPACE) {
                let span = document.createElement('span');
                span.appendChild(data);
                data.textContent = '0';
                span.className = "hidden-digit";
                data = span;
            }
            let parent = document.createElement('span');
            parent.appendChild(data);
            switch (previousCell.carry.location) {
                case 'n':
                case 'w':
                    parent.prepend(previousCell.data);
                    break;
                case 'nw': {
                    let newElement = document.createElement('sup');
                    newElement.appendChild(previousCell.data);
                    parent.prepend(newElement);
                    break;
                }
                case 'ne': {
                    let newElement = document.createElement('sup');
                    newElement.appendChild(previousCell.data);
                    parent.appendChild(newElement);
                    break;
                }
                case 'e':
                case 's':
                    parent.appendChild(previousCell.data);
                    break;
                case 'se': {
                    let newElement = document.createElement('sub');
                    newElement.appendChild(previousCell.data);
                    parent.appendChild(newElement);
                    break;
                }
                case 'sw': {
                    let newElement = document.createElement('sub');
                    newElement.appendChild(previousCell.data);
                    parent.prepend(newElement);
                    break;
                }
                default:
                    console.log(`Unknown crossout location '${previousCell.carry.location}`);
                    break;
            }
            cell.data = parent;
            return cell;
        }

        let previousRow = rows[rows.length - 1];

        if (rows.length === 0 ||
            !previousRow.data.find( cell => cell.carry )) {
            rows.push(newRow);
            return;
        }

        const extraToAddOnLeft = (newRow.data.length - newRow.nRight) - (previousRow.data.length - previousRow.nRight);
        if (extraToAddOnLeft !== 0) {
            if (extraToAddOnLeft < 0) {
                newRow.data = newRow.padOnLeft(newRow.data, -extraToAddOnLeft);
            } else {
                previousRow.data = previousRow.padOnLeft(previousRow.data, extraToAddOnLeft);
            }
        }

        const extraToAddOnRight = newRow.nRight - previousRow.nRight;
        if (extraToAddOnRight !== 0) {
            if (extraToAddOnRight < 0) {
                newRow.data = newRow.padOnRight(newRow.data, -extraToAddOnRight);
                newRow.nRight = previousRow.nRight;
            } else {
                previousRow.data = previousRow.padOnRight(previousRow.data, extraToAddOnRight);
                previousRow.nRight += extraToAddOnRight;
                newRow.nRight = previousRow.nRight;
            }
        }

        for (let i=0; i < newRow.data.length; i++) {
            const prevCell = previousRow.data[i];
            let cell = newRow.data[i];
            if (prevCell.carry) {
                cell = addCrossoutToData(cell, prevCell.carry.crossout);
                cell = mergeCarryAndData(cell, prevCell);
                cell.alignAt = prevCell.carry.location === 's' ? 1 : -1;
                newRow.data[i] = cell; 
            }
        }
        rows[rows.length - 1] = newRow;
    }

    /**
     * Flattens `msrow` / `mstyle` row content into cells; decimal alignment uses the first `mn`'s decimal point.
     * @param {Element} msrow
     * @returns {[TableCell[], number]} Cells and `nRight` when `stackalign === 'decimalpoint'`.
     */
    process_msrow(msrow) {
        let foundNumber = false;
        let nDigitsRightOfDecimalPt = 0;
        /** @type {TableCell[]} */
        let cells = [];
        for (let i=0; i<msrow.children.length; i++) {
            const child = msrow.children[i];
            if (child.tagName.toLowerCase() === 'mn') {
                const chars = child.textContent.trim().split('');
                cells = cells.concat( chars.map( c => new TableCell(c)) );
                if (foundNumber) {
                    nDigitsRightOfDecimalPt += chars.length;
                } else {
                    const iDecimalPt = child.textContent.trim().indexOf(this.getAttr(child, 'decimalpoint', '.'));
                    nDigitsRightOfDecimalPt = iDecimalPt < 0 ? 0 : chars.length - iDecimalPt;
                    foundNumber = true;
                }
            } else {
                // everything should be in one column.
                // FIX: the child might be something complex -- textContent might be inappropriate
                let text = child.textContent.trim();
                if (text === '-') {
                    text = '\u2212';  // use proper minus sign
                }
                cells.push( new TableCell(text) );
                if (foundNumber) {
                    nDigitsRightOfDecimalPt += 1;
                }
            }
        }
        return [cells, this.stackAlign !== 'decimalpoint' ? 0 : nDigitsRightOfDecimalPt];
    }

    /**
     * @param {Element} row - `mscarries` element.
     * @param {string} location - Default `mscarry` `location`.
     * @param {string} crossout - Default `mscarry` `crossout`.
     * @param {number} scriptsizemultiplier - Percent (already scaled, e.g. 60).
     * @returns {TableCell[]}
     */
    process_mscarries(row, location, crossout, scriptsizemultiplier) {
        let cells = [];
        let child = row.children[0];
        while (child) {
            let nextChild = child.nextElementSibling;
            let cellLocation = location;
            let cellCrossout = crossout;
            if (child.tagName.toLowerCase() === 'mscarry') {
                cellLocation = this.getAttr(child, 'location', 'n');
                cellCrossout = this.getAttr(child, 'crossout', 'none');
                // FIX: child could be any MathML construct -- currently only supporting a *leaf*
                // the text content of the parent will match that of the *leaf* child, so nothing to change here
            }
            cells.push( new TableCell(child, '', new Carry(cellLocation, cellCrossout, scriptsizemultiplier)) );
            child = nextChild;
        }
        return cells;
    }

    /**
     * Walks `node` children (`msgroup` applies `rowShift` to subsequent siblings).
     * @param {Element} node - `mstack`, `mlongdiv`, or `msgroup`.
     * @param {TableRow[]} rows
     * @param {number} position - Base column offset from ancestor `msgroup`s.
     * @param {number} [rowShift=0] - Per-`msgroup` `shift`.
     * @returns {TableRow[]}
     */
    processChildren(node, rows, position, rowShift) {
        if (!node.children) {
            return rows;
        }
        rowShift = rowShift || 0;

        for (let i= (node.tagName.toLowerCase() === 'mlongdiv' ? 2 : 0); i<node.children.length; i++) {
            rows = this.processChild(node.children[i], rows, position);
            position += rowShift;
        }
        return rows;
    }

    /**
     * @param {Element} child
     * @param {TableRow[]} rows
     * @param {number} position
     * @returns {TableRow[]}
     */
    processChild(child, rows, position) {
        let shift = position + parseInt(this.getAttr(child, 'position', '0'));
        switch (child.tagName.toLowerCase()) {
            case 'mn': {
                const chars = child.textContent.trim().split('');
                const iDecimalPt = child.textContent.trim().indexOf(this.getAttr(child, 'decimalpoint', '.'));
                const nDigitsRightOfDecimalPt = (this.stackAlign !== 'decimalpoint' || iDecimalPt < 0) ? 0 : chars.length - iDecimalPt;
                const cells = chars.map( c => new TableCell(c));
                this.add(rows, new TableRow(cells, nDigitsRightOfDecimalPt, shift) );
                break;
            }

            case 'msgroup':
                rows = this.processChildren(child, rows, shift, parseInt(this.getAttr(child, 'shift', '0')));
                break;

            case 'msline': {
                const length = parseInt(this.getAttr(child, 'length', '0'));
                let thickness = this.getAttr(child, 'mslinethickness', 'medium');
                if (thickness === 'medium') {
                    thickness = MSLINETHICKNESS_MEDIUM;
                } else if (thickness === 'thin') {
                    thickness = MSLINETHICKNESS_THIN;
                } else if (thickness === 'thick') {
                    thickness = MSLINETHICKNESS_THICK;
                }

                if (rows.length === 0) {
                    this.add(rows, new TableRow([], 0, 0) );
                }
                const previousRow = rows[rows.length-1];
                const mathcolor = this.getAttr(child, 'mathcolor', 'black');
                if (length === 0) {
                    previousRow.addUnderline(thickness, mathcolor);
                } else {
                    previousRow.addUnderlineToCells(shift, length, thickness, mathcolor);
                }
                break;
            }

            case 'mscarries': {
                let location = this.getAttr(child, 'location', 'n');
                let crossout = this.getAttr(child, 'crossout', 'none');
                let scriptsizemultiplier = parseFloat(this.getAttr(child, 'scriptsizemultiplier', '0.6'));
                this.add(rows, new TableRow(this.process_mscarries(child, location, crossout, 100*scriptsizemultiplier), 0, shift) );
                break;
            }

            case 'mstyle': {
                const oldAttrs = this.attrs;
                this.attrs = new MathMLAttrs(child, oldAttrs);
                if (child.children.length === 1 && child.children[0].tagName.toLowerCase() === 'msline') {
                    // FIX: not legal according to spec, but should be able to wrap msline in mstyle to change mathcolor
                    // FIX:   spec should be fixed
                    this.processChild(child.children[0], rows, shift);
                } else {
                    let cells;
                    let nDigitsRightOfDecimalPt;
                    [cells, nDigitsRightOfDecimalPt] = this.process_msrow(child);
                    this.add(rows, new TableRow(cells, nDigitsRightOfDecimalPt, shift) );
                    this.attrs = oldAttrs;
                }
                break;
            }
                            
            default: {
                let cells;
                let nDigitsRightOfDecimalPt = 0;

                if (child.tagName.toLowerCase() == 'msrow') {
                    [cells, nDigitsRightOfDecimalPt] = this.process_msrow(child);                       
                } else {
                    // FIX: this isn't right for non-leaf cells
                    // We are out of a MathML context inside of the table we are building, so we can't just stuff the MathML in it
                    cells = [new TableCell(child.textContent.trim())];
                }
                this.add(rows, new TableRow(cells, nDigitsRightOfDecimalPt, shift) );  
                break;
            }
        }
        return rows;
    }

    /**
     * Pads every row to a common width per `stackalign`.
     * @param {TableRow[]} rows
     * @param {string} stackAlign
     * @returns {TableRow[]}
     */
    processShifts(rows, stackAlign) {
        let maxLeftOfDecimalPt = 0;
        let maxRightOfDecimalPt = 0;

        for (const row of rows) {
            if (stackAlign === 'decimalpoint') {
                maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length - row.nRight);
                maxRightOfDecimalPt = Math.max(maxRightOfDecimalPt, row.nRight);               
            } else {
                maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length);
            }
        }

        for (const row of rows) {
            switch (stackAlign) {
                case 'decimalpoint':
                    row.data = row.padOnLeft(row.data, maxLeftOfDecimalPt - (row.data.length - row.nRight));
                    row.data = row.padOnRight(row.data, maxRightOfDecimalPt - row.nRight);
                    row.nRight = maxRightOfDecimalPt;
                    break;                
                case 'left':
                    row.data = row.padOnRight(row.data, maxLeftOfDecimalPt - row.data.length);
                    break;
                case 'center': {
                    const padding = maxLeftOfDecimalPt - row.data.length;
                    row.data = row.padOnRight(row.data, padding/2);
                    row.data = row.padOnLeft(row.data, padding - padding/2);
                    break;
                }
                case 'right':
                    row.data = row.padOnLeft(row.data, maxLeftOfDecimalPt - row.data.length);
                    break;
                default:
                    console.log(`Unknown mstack stackalign attr value: "${stackAlign}"`);
                    break;
            }
        }
        return rows;
    }

    /**
     * Merges `mlongdiv` divisor/result rows and delimiters per `longdivstyle`.
     * @param {Element | null} divisor - First child of `mlongdiv` (may be null).
     * @param {Element | null} result - Second child.
     * @param {TableRow[]} stackRows - Main stack body (from child 2 onward).
     * @returns {TableRow[]}
     */
    addOnLongDivParts(divisor, result, stackRows) {
        /**
         * @param {TableRow} row
         * @returns {number} Count of trailing `NO_SPACE` cells from the right.
         */
        function countPaddingOnRight(row) {
            for (let i = row.data.length-1; i>=0; i--) {
                const cell = row.data[i];
                if (cell.data.textContent !== NO_SPACE) {
                    return row.data.length - 1 - i;
                }
            }
            return row.data.length;
        }
        /**
         * @param {TableRow} row
         * @param {number} nKeep - Trailing empty cells to retain.
         * @returns {TableRow}
         */
        function removePaddingOnRight(row, nKeep) {
            let nDeletedRight = 0;

            for (let i = row.data.length-1; i>=0; i--) {
                const cell = row.data[i];
                if (cell.data.textContent !== NO_SPACE) {
                    break;
                }
                if (nKeep > 0) {
                    nKeep--;
                } else {
                    row.data.pop();
                    nDeletedRight++;
                }
            }

            for (let i=0; i<nKeep; i++) {
                row.data.push( new TableCell(NO_SPACE) );
            }

            row.nRight -= nDeletedRight - nKeep;
            return row;
        }

        const mathcolor = this.getAttr(this.stack, 'mathcolor', 'black');

        if (stackRows.length == 0) {
            stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
        }

        // FIX: this is broken for anything that is more than one row tall.
        /** @type {TableRow[]} */
        let divisorRows = divisor ? this.processChild(divisor, [], 0) : [new TableRow( [new TableCell(NO_SPACE)], 0, 0 )];
        let divisorRow = divisorRows[0];        // FIX: currently can only handle one row
        let iLastDivisorDigit = divisorRow.data.length-1;

        let resultRows = result ? this.processChild(result, [], 0) : [new TableRow( [new TableCell(NO_SPACE)], 0, 0 )];
        let resultRow = resultRows[0];          // FIX: currently can only handle one row

        switch (this.longdivstyle) {
            case 'left/\\right':
            case 'left)(right': {
                // Easy case -- everything goes on first line
                const leftDelim = new TableCell( this.longdivstyle === 'left/\\right' ? '/' : ')' );
                const rightDelim = new TableCell( this.longdivstyle === 'left/\\right' ? '\\' : '(' );
                if (stackRows.length === 0) {
                    stackRows.push( new TableRow(
                        divisorRow.data.concat(
                            [leftDelim],
                            new TableCell(NO_SPACE),
                            [rightDelim],
                            resultRows[0].data)
                    ));
                } else {
                    stackRows[0].data = divisorRow.data.concat(
                        [leftDelim],
                        removePaddingOnRight(stackRows[0], 0).data,
                        [rightDelim],
                        resultRows[0].data);
                    stackRows[0].nRight += 1 + resultRows[0].data.length;
                }
                break;
            }

            case ':right=right': {
                // Easy case -- everything goes on first line
                if (stackRows.length === 0) {
                    stackRows.push( new TableRow(
                        [new TableCell(':')].concat(
                            divisorRow.data,
                            [new TableCell('=')],
                            resultRow.data)
                    ));
                } else {
                    stackRows[0].data = removePaddingOnRight(stackRows[0], 0).data.concat(
                        [new TableCell(':')],
                        divisorRow.data,
                        [new TableCell('=')],
                        resultRow.data);
                    stackRows[0].nRight += 2 + divisorRow.data.length + resultRow.data.length;
                }
                break;
            }

            case 'stackedrightright':
            case 'mediumstackedrightright':
            case 'shortstackedrightright': {
                // mstack on left, vertical line down right side of mstack; divisor to the right of that, horizontal line, then result underneath
                // FIX: this only works for *leaf* elements
                // need to assure there are at least two rows in the stack (already made sure there is one)
                if (stackRows.length == 1) {
                    stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
                    stackRows = this.processShifts(stackRows, this.stackAlign);

                }

                if (this.longdivstyle !== 'stackedrightright') {
                    const nLine1Padding = countPaddingOnRight(stackRows[0]);
                    const nLine2Padding = countPaddingOnRight(stackRows[1]);
                    const nRemove = Math.min(nLine1Padding, nLine2Padding);
                    stackRows[0] = removePaddingOnRight(stackRows[0], nLine1Padding - nRemove);
                    stackRows[1] = removePaddingOnRight(stackRows[1], nLine2Padding - nRemove);
                }
                const verticalLineLength = this.longdivstyle === 'shortstackedrightright' ? 1 :
                                           this.longdivstyle === 'mediumstackedrightright' ? 2 : stackRows.length;
                for (let i = 0; i < verticalLineLength; i++) {
                    let newCell = new TableCell(NO_SPACE);                   
                    if (i < verticalLineLength) {
                        newCell.style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;                    
                    }
                    stackRows[i].data.push(newCell);
                }       

                // Add some padding on the left to the divisor and result to separate them from the line
                // FIX: unfortunately, this also adds space in the columns below for the non 'stackedrightright' cases.
                // FIX: maybe there are some games to be played with columnspans...
                if (this.longdivstyle === 'stackedrightright') {
                    divisorRow.data[0].style += 'padding-left: 0.5em;';
                    resultRow.data[0].style += 'padding-left: 0.5em;';
                }

                const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                if (nCellsLargerResultThanDivisor > 0) {
                    divisorRow.data = divisorRow.padOnRight(divisorRow.data, nCellsLargerResultThanDivisor);
                }
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                divisorRow.addSpacingAfterRow = false;
                stackRows[0].data = stackRows[0].data.concat(divisorRow.data);
                stackRows[0].nRight += divisorRow.data.length;

                stackRows[1].data = stackRows[1].data.concat(resultRow.data);
                stackRows[1].nRight += resultRow.data.length;
                break;
            }

            case 'stackedleftleft': {
                // mstack on right, vertical line down left side of mstack; divisor to the left of that, horizontal line, then result underneath
                // we need at least two stack elements for this layout
                if (stackRows.length == 1) {
                    stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
                    stackRows = this.processShifts(stackRows, this.stackAlign);
                }

                // FIX: this only works for *leaf* elements
                // First, add a row of padding on left and put a line down the right side of them
                for (let i = 0; i < stackRows.length; i++) {
                    let newCell = new TableCell('');                   
                    newCell.style += `border-left: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;                    
                    stackRows[i].data.unshift(newCell);
                }       

                divisorRow.data[divisorRow.data.length-1].style += 'padding-right: 0.5em;';
                resultRow.data[resultRow.data.length-1].style += 'padding-right: 0.5em;';

                const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                if (nCellsLargerResultThanDivisor > 0) {
                    divisorRow.data = divisorRow.padOnLeft(divisorRow.data, nCellsLargerResultThanDivisor);
                }
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                divisorRow.addSpacingAfterRow = false;
                stackRows[0].data = divisorRow.data.concat(stackRows[0].data);

                stackRows[1].data = resultRow.data.concat(stackRows[1].data);
                break;
            }

            case 'righttop': {
                resultRow.addUnderline(MSLINETHICKNESS_MEDIUM, mathcolor);
                resultRow.addSpacingAfterRow = false;
                let mergedRows = resultRows.concat(stackRows);
                stackRows = this.processShifts(mergedRows, this.stackAlign);

                divisorRow.data[0].style += `border-left: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                stackRows[1].data = stackRows[1].data.concat(divisorRow.data);
                stackRows[1].nRight += divisorRow.data.length;
                break;
            }
                
            case 'lefttop':
            case 'stackedleftlinetop':
            default: {
                // left top -- divisor to left of stack, result new row on top (part of stack and underlined)
                // FIX: this only works for *leaf* elements

                // First, put the result on top with a line underneath
                resultRow.addUnderlineToCells(-resultRow.nRight, Math.max(resultRow.data.length, stackRows[0].data.length), MSLINETHICKNESS_MEDIUM, mathcolor);
                resultRow.addSpacingAfterRow = false;
                let mergedRows = resultRows.concat(stackRows);
                stackRows = this.processShifts(mergedRows, this.stackAlign);

                if (this.longdivstyle === 'stackedleftlinetop') {
                    divisorRow.data[divisorRow.data.length-1].style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                    divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                } else {
                    divisorRow.data = divisorRow.padOnRight(divisorRow.data, 1);
                    iLastDivisorDigit += 1;

                    divisorRow.data[iLastDivisorDigit].class = 'curved-line';
                    divisorRow.data[iLastDivisorDigit].style = '';
                }
                stackRows[1].data = divisorRow.data.concat(stackRows[1].data);
                break;
            }
        }
        let answer = this.processShifts(stackRows, this.stackAlign);
        if (this.longdivstyle === 'lefttop') {
            stackRows[0].data[iLastDivisorDigit].style += `border-bottom: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
        }
        return answer;
    }
	

    /**
     * Tags separator columns (`.`, `,`) and related cells so {@link ElemMath#expandMStackElement} can tighten padding.
     * @param {TableRow[]} stackRows
     * @returns {void}
     */
    shrinkSeparatorColumns(stackRows) {
        if (stackRows.length === 0) {
            return;
        }

        /**
         * @param {TableCell} cell
         * @param {string} extras - Space-separated class names to merge onto `cell.class`.
         */
        const mergeClasses = (cell, extras) => {
            const set = new Set((cell.class || '').trim().split(/\s+/).filter(Boolean));
            for (const c of extras.trim().split(/\s+/)) {
                if (c) {
                    set.add(c);
                }
            }
            cell.class = [...set].join(' ');
        };

        let separatorCols = new Set(Array(stackRows[0].data.length).keys());
        let allEmptyCells = new Set(Array(stackRows[0].data.length).keys());
        for (let row of stackRows) {
            /** @type {TableCell[]} */
            let cols = row.data;
            for (let i=0; i < cols.length; i++) {
                let text = cols[i].data.textContent;
                if (text==='.' || text===',') {
                    allEmptyCells.delete(i);
                } else if (text !== NO_SPACE) {
                    separatorCols.delete(i);
                    allEmptyCells.delete(i);
                }
            }
        }

        allEmptyCells.forEach( i => separatorCols.delete(i));
        
        for (let iCol of separatorCols) {
            stackRows.forEach( row => {
                mergeClasses(row.data[iCol], "separator");
                if (iCol > 0) {
                    mergeClasses(row.data[iCol - 1], "precedes-separator");
                }
            });
        }

        stackRows.forEach(row => {
            for (let i = 0; i < row.data.length; i++) {
                const text = row.data[i].data.textContent;
                if (text === ',') {
                    mergeClasses(row.data[i], 'separator separator-comma');
                    if (i > 0) {
                        mergeClasses(row.data[i - 1], 'precedes-separator');
                    }
                    if (i + 1 < row.data.length) {
                        mergeClasses(row.data[i + 1], 'follows-separator');
                    }
                } else if (text === '.') {
                    mergeClasses(row.data[i], 'separator separator-decimal');
                    if (i > 0) {
                        mergeClasses(row.data[i - 1], 'precedes-separator');
                    }
                    if (i + 1 < row.data.length) {
                        mergeClasses(row.data[i + 1], 'follows-separator');
                    }
                }
            }
        });

        /** Align column max-content when only some rows touch a comma (grid track sizing). */
        const followsSepCols = new Set();
        stackRows.forEach(row => {
            for (let i = 0; i < row.data.length; i++) {
                const cls = row.data[i].class;
                if (cls && cls.split(/\s+/).includes('follows-separator')) {
                    followsSepCols.add(i);
                }
            }
        });
        for (const iCol of followsSepCols) {
            stackRows.forEach(row => {
                if (iCol < row.data.length) {
                    mergeClasses(row.data[iCol], 'follows-separator');
                }
            });
        }

        const precedesSepCols = new Set();
        stackRows.forEach(row => {
            for (let i = 0; i < row.data.length; i++) {
                const cls = row.data[i].class;
                if (cls && cls.split(/\s+/).includes('precedes-separator')) {
                    precedesSepCols.add(i);
                }
            }
        });
        for (const iCol of precedesSepCols) {
            stackRows.forEach(row => {
                if (iCol < row.data.length) {
                    mergeClasses(row.data[iCol], 'precedes-separator');
                }
            });
        }
    }


    /**
     * Serializes the laid-out {@link TableRow} model into a grid container (HTML `div.elem-math`) and cell `div`s.
     * @param {Element} el - `mstack` or `mlongdiv`.
     * @returns {HTMLDivElement} Root element with class `elem-math`.
     */
    expandMStackElement(el) {
        let numberRegEx = /[-+]?\d*\.?\d*/g;
        const charSpacing = parseFloat(numberRegEx.exec(this.charSpacing)[0])/2.0 + this.charSpacing.slice(numberRegEx.lastIndex);
        this.charSpacing.slice(numberRegEx.lastIndex);

        /**
         * Horizontal padding for digit cells; commas/decimals tightened here (not via stylesheet) so shadow/cascade cannot drop it.
         * @param {TableCell} cellData
         * @returns {{ boxStyle: string }}
         */
        const cellBoxStyle = (cellData) => {
            const tokens = (cellData.class || '').trim().split(/\s+/).filter(Boolean);
            const has = (/** @type {string} */ c) => tokens.includes(c);
            if (has('curved-line')) {
                return { boxStyle: `padding-top: .1ex; padding-right: 0; padding-bottom: 0; padding-left: 0;` };
            }
            let pl = charSpacing;
            let pr = charSpacing;
            if (has('separator')) {
                pl = '0';
                pr = '0';
            }
            if (has('precedes-separator')) {
                pr = '0';
            }
            if (has('follows-separator')) {
                pl = '0';
            }
            const t = cellData.data.textContent;
            const textAlign = t === '.' ? 'center' : this.charAlign;
            return {
                boxStyle: `padding-top: .1ex; padding-right: ${pr}; padding-bottom: 0; padding-left: ${pl}; text-align: ${textAlign};`,
            };
        };

        /** @type {TableRow[]} */
        let stackRows = [];
        stackRows = this.processChildren(el, stackRows, 0, 0);
        stackRows = this.processShifts(stackRows, this.stackAlign);
        if (el.tagName.toLowerCase() === 'mlongdiv') {
            stackRows = this.addOnLongDivParts(el.children[0], el.children[1], stackRows);
        }

        if (stackRows.length > 0) {
            stackRows[stackRows.length-1].addSpacingAfterRow = false;
        }

        this.shrinkSeparatorColumns(stackRows);

        const gridRoot = document.createElement('div');
        gridRoot.setAttribute('class', 'elem-math');

        const maxColumns = stackRows.reduce((max, row) => Math.max(max, row.data.length), 0);
        if (maxColumns > 0) {
            gridRoot.style.gridTemplateColumns = `repeat(${maxColumns}, max-content)`;
        }

        let rowIndex = 1;
        for (const row of stackRows) {
            for (let colIndex = 0; colIndex < row.data.length; colIndex++) {
                const cellData = row.data[colIndex];
                let htmlCell = document.createElement('div');
                htmlCell.className = 'elem-math-cell';
                if (cellData.style && /(^|;)\s*border-(left|right):/.test(cellData.style)) {
                    htmlCell.classList.add('elem-math-vrule-cell');
                }
                if (cellData.alignAt) {
                    let span = document.createElement('span');
                    span.style.display = cellData.alignAt === 1 ? 'inline-table' : 'inline-block';
                    span.appendChild(cellData.data);
                    cellData.data = span;
                }

                const classTokens = (cellData.class || '').trim().split(/\s+/).filter(Boolean);
                const isCurvedLine = classTokens.includes('curved-line');

                if (isCurvedLine) {
                    const curve = document.createElement('div');
                    curve.className = 'curved-line';
                    curve.textContent = NON_BREAKING_SPACE;
                    htmlCell.appendChild(curve);
                    cellData.data.textContent = NON_BREAKING_SPACE;
                    htmlCell.appendChild(cellData.data);
                } else {
                    htmlCell.appendChild(cellData.data);
                }

                const { boxStyle } = cellBoxStyle(cellData);
                if (row.style || cellData.style || boxStyle) {
                    const style = `${row.style || ''}${boxStyle}${cellData.style || ''}`;
                    if (style) {
                        htmlCell.setAttribute('style', style);
                    }
                }
                if (cellData.class && !isCurvedLine) {
                    for (const cls of cellData.class.trim().split(/\s+/)) {
                        if (cls) {
                            htmlCell.classList.add(cls);
                        }
                    }
                }
                htmlCell.style.gridColumn = (colIndex + 1).toString();
                htmlCell.style.gridRow = rowIndex.toString();
                gridRoot.appendChild(htmlCell);
            }

            if (row.addSpacingAfterRow) {
                const spacerRow = rowIndex + 1;
                for (let colIndex = 0; colIndex < row.data.length; colIndex++) {
                    const cellData = row.data[colIndex];
                    let newCell = document.createElement('div');
                    newCell.className = 'elem-math-cell elem-math-spacer';
                    if (/(border-left|border-right)/.test(cellData.style)) {
                        newCell.classList.add('elem-math-vrule-cell');
                        const borders = cellData.style.match(/(border-left|border-right).*?;/g);
                        if (borders) {
                            newCell.setAttribute('style', borders.join(''));
                        }
                    }
                    newCell.style.gridColumn = (colIndex + 1).toString();
                    newCell.style.gridRow = spacerRow.toString();
                    gridRoot.appendChild(newCell);
                }
                rowIndex += 1;
            }

            rowIndex += 1;
        }

        return gridRoot;
    }
}

/**
 * Replaces `mstack` / `mlongdiv` in light DOM with a MathML wrapper whose shadow root holds the CSS grid.
 *
 * MathML does not allow a shadow root on `mstack` / `mlongdiv`, so the tree becomes
 * `mtext > span (shadow host) > math > el`, with `div.elem-math` (the grid) appended to the shadow root.
 * Skips work when `el` is already under `m-elem-math` (that element builds its own shadow tree).
 *
 * @param {HTMLElement} el - `mstack` or `mlongdiv` node still in the document.
 * @returns {null}
 */
let transformElemMath = (el) => {
    if (el.parentElement && (el.parentElement.tagName === M_ELEM_MATH_TAG ||
                            (el.parentElement.parentElement && el.parentElement.parentElement.tagName === M_ELEM_MATH_TAG))) {
        return null;
    }

    const spanShadowHost = document.createElement('span');
    const shadowRoot = spanShadowHost.attachShadow({ mode: 'open' });
    shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());

    const elParent = el.parentElement;
    const nextSibling = el.nextElementSibling;
    const gridRoot = new ElemMath(el).expandMStackElement(el);
    shadowRoot.appendChild(gridRoot);

    const mtext = document.createElementNS(MATHML_NS, 'mtext');
    mtext.appendChild(spanShadowHost);
    const math = document.createElementNS(MATHML_NS, 'math');
    spanShadowHost.appendChild(math);
    math.appendChild(el);
    elParent.insertBefore(mtext, nextSibling);

    return null;
};

_MathTransforms.add('mstack', transformElemMath, ELEM_MATH_CSS);
/** `mlongdiv` reuses the same transform; styles are registered once on `mstack`. */
_MathTransforms.add('mlongdiv', transformElemMath);

/**
 * Declarative hook: first child must be `mstack` or `mlongdiv`; layout is moved into this element's shadow root.
 */
customElements.define('m-elem-math', class extends HTMLElement {
    constructor() {
        super();
        const gridRoot = new ElemMath(this.children[0]).expandMStackElement(this.children[0]);
        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
        shadowRoot.appendChild(gridRoot);
    }
});

/***
 * Handles all the linebreaking and indenting attributes in MathML on "mo".
 * Does this by creating an mtable, with an mtr for each line that is created.
 * Note: this uses ShadowDOM which means there can be problems (such as with href).
***/
// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */

const MTABLE_HAS_LINEBREAKS = 'data-has-linebreaks';

// bit of a hack to pass the info to where it is needed without adding it as a param for several layers of calls
const MTABLE_LINEBREAKS_ATTR = 'data-max-linebreak-width';
const INDENT_ATTRS = 'data-saved-indent-attrs';
const INDENT_AMOUNT = 'data-x-indent';

const ELEMENT_DEPTH = 'data-nesting-depth';

/******* Values used for indenting  *******/

// Value used if it can't find a good alignment char on previous line
const FALLBACK_INDENT_AMOUNT = '3em';


/******* Values used for linebreaking  *******/

// Linebreaking computes a penalty for breaking at a certain point.
// Currently depth of the <mo> and emptiness of the line are used

// Weighting between depth and fill
const DEPTH_PENALTY_TO_FILL_PENALTY_RATIO = 3.0;

// Amount to scale down penalty if labelled as a good break point
const GOOD_PENALTY_SCALE_FACTOR = 3.0;

// Amount to scale up penalty if labelled as a bad break point
const BAD_PENALTY_SCALE_FACTOR = 3.0;

// Ideal amount to fill a line -- typically display equations don't fill a line to "balance" being indented
const LINE_FILL_TARGET = 0.9;

const EMBELLISHED_ELEMENT_NAMES = [
    'msub', 'msub', 'msubsup', 'mover', 'munder', 'munderover', 'mfrac', 'mmultiscripts'
];

// Hack to close over the shadowRoot so it can be accessed deep down
var shadowRoot = (function () {
    var root = null;
    var emInPixels = 0;
    var breakWidth = 0;

    return {
        set: function (shadow, em, width) {
            root = shadow;
            emInPixels = em;
            breakWidth = width;
        },

        get: function () {
            return root;
        },

        getEmInPixels: function () {
            return emInPixels;
        },

        getBreakWidth: function () {
            return breakWidth;
        }
    };
})();

/**
 * Look first in the shadowRoot for the 'id'; if not found, check the whole document
 * @param {string} id 
 * @returns {Element | null}
 */
function getElementByIdEverywhere(id) {
    const found = shadowRoot.get().getElementById(id);
    if (found) {
        return found;
    }
    return document.getElementById(id);
}

/**
 * Creates a new MathML element
 * @param {string} tagName 
 * @returns {Element}
 */
function newElement(tagName) {
    // Create an empty <mrow>.
    return document.createElementNS(MATHML_NS, tagName);
}

/**
 * Copies the attributes from 'source' to 'target'
 * 'target' is unchanged.
 * @param {Element} target
 * @param {Element} source 
 * @returns {Element}       // target
 */
function copyAttributes(target, source) {
    const attrs = source.attributes;
    for (let i = 0; i < attrs.length; i++) {
        target.setAttribute(attrs[i].name, attrs[i].value);
    }
    return target;
}
/**
 * Looks at 'element' and its ancestors to see if the value is set on an attr; if so, it is returned.
 * @param {Element} element 
 * @param {string} attrName 
 * @param {string} defaultVal
 * @returns {string} 
 */
function getMathMLAttrValueAsString(element, attrName, defaultVal) {
    let lookingForMathElement = true;
    do {
        if (element.hasAttribute(attrName)) {
            return element.getAttribute(attrName);
        }
        lookingForMathElement = (element.tagName !== 'math');
        element = element.parentElement;
    } while (lookingForMathElement);
    return defaultVal;
}

/**
 * @returns {Element}
 */
function createLineBreakMTable() {
    const mtable = newElement('mtable');
    mtable.setAttribute(MTABLE_HAS_LINEBREAKS, "true");
    mtable.setAttribute('displaystyle', "true");        // currently ok because only display math is linebroken
    return mtable;
}

/**
 * 
 * @param {Element} mtd 
 * @returns {boolean}
 */
function isInLineBreakTable(mtd) {
    return mtd.tagName === 'mtd' &&
        mtd.parentElement.tagName === 'mtr' &&
        mtd.parentElement.parentElement.tagName === 'mtable' &&
        mtd.parentElement.parentElement.hasAttribute(MTABLE_HAS_LINEBREAKS);
}

/**
 * 
 * @param {Element} child 
 * @returns {Element}
 */
function createNewTableRowWithChild(child) {
    const mtr = newElement('mtr');
    const mtd = newElement('mtd');
    mtd.appendChild(child);
    mtr.appendChild(mtd);
    return mtr;
}

/**
 * 
 * @param {Element} mo
 * @param {'first' | 'middle' | 'last'}  firstMiddleOrLast
 * @returns {Object}
 */
function computeIndentAttrObject(mo, firstMiddleOrLast) {
    const attrObject = {};

    let linebreakstyle = getMathMLAttrValueAsString(mo, 'linebreakstyle', 'before');
    if (linebreakstyle === 'infixLineBreakStyle') {
        linebreakstyle = getMathMLAttrValueAsString(mo, 'infixLineBreakStyle', 'before');
    }
    attrObject.linebreakstyle = linebreakstyle;

    attrObject.indentAlign = getMathMLAttrValueAsString(mo, 'indentalign', 'auto');
    attrObject.indentShift = getMathMLAttrValueAsString(mo, 'indentshift', '0px');
    if (firstMiddleOrLast == 'first') {
        attrObject.indentAlign = getMathMLAttrValueAsString(mo, 'indentalignfirst', attrObject.indentAlign);
        attrObject.indentShift = getMathMLAttrValueAsString(mo, 'indentshiftfirst', attrObject.indentShift);
    } else if (firstMiddleOrLast === 'last') {
        attrObject.indentAlign = getMathMLAttrValueAsString(mo, 'indentalignlast', attrObject.indentAlign);
        attrObject.indentShift = getMathMLAttrValueAsString(mo, 'indentshiftlast', attrObject.indentShift);
    }
    attrObject.indentShift = convertToPx(mo, attrObject.indentShift);   // do conversion at most once
    attrObject.target = getMathMLAttrValueAsString(mo, 'indenttarget', '');
    attrObject.firstMiddleOrLast = firstMiddleOrLast;
    return attrObject;
}
/**
 * Stores the attrs used for indenting on the 'mtd' so they can be found easily later
 * @param {Element} mtd
 * @param {Element} mo
 */
function storeLineBreakAttrsOnMtd(mtd, mo) {
    /** @type {'first' | 'middle' | 'last'} */
    let firstMiddleOrLast = 'middle';
    if (mtd.parentElement === mtd.parentElement.parentElement.firstElementChild) {
        firstMiddleOrLast = 'first';
    } else if (mtd.parentElement === mtd.parentElement.parentElement.lastElementChild) {
        firstMiddleOrLast = 'last';
    }
    mtd.setAttribute(INDENT_ATTRS, JSON.stringify(computeIndentAttrObject(mo, firstMiddleOrLast)));
}

/**
 * Either create a new (linebreak) mtable with the new table row or if it already exists, add the row
 * It exists if we stopped at a <mtd> and it is an mtable inserted for linebreaking purposes
 * @param {Element} parent              // 'mtd' if stopped in existing table, otherwise some non-mrow element
 * @param {Element} upToBreak           // the first part of the split line
 * @param {Element} afterBreak          // the remainder of the current line
 * @returns {Element}                   // the last row added to the table (one or two rows are created)
 */
function addNewLineBreakRow(parent, upToBreak, afterBreak) {
    const mtr = createNewTableRowWithChild(upToBreak);
    if (isInLineBreakTable(parent)) {
        // upToBreak/afterBreak were the same line, but uptToBreak was split off into a new mrow and is not part of parent
        // parent has the indenting info on it and it applies to the upToBreakLine, so we need to move it over
        copyAttributes(mtr.firstElementChild, parent);
        while (parent.attributes.length > 0) {
            parent.removeAttributeNode(parent.attributes[0]);
        }
        parent.parentElement.parentElement.insertBefore(mtr, parent.parentElement);
        return parent.parentElement;          // parent === afterBreak.parentElement
    } else {
        const mtable = createLineBreakMTable();
        mtable.setAttribute("style", "width: 100%");        // make sure there is room for alignment
        mtable.appendChild(mtr);
        afterBreak.replaceWith(mtable);
        mtable.appendChild(createNewTableRowWithChild(afterBreak));
        return mtable.lastElementChild;
    }
}

/**
 * Splits the line at the 'mo' -- at beginning/end of line depending on 'linebreakstyle'
 * @param {Element} mo      // operator to split
 * @returns {Element}       // the last row added to the table 
 */
function splitLine(mo) {
    // break before the <mo> or after it...
    let linebreakstyle = getMathMLAttrValueAsString(mo, 'linebreakstyle', 'before');
    if (linebreakstyle === 'infixLineBreakStyle') {
        linebreakstyle = getMathMLAttrValueAsString(mo, 'infixLineBreakStyle', 'before');
    }

    // walk up tree from <mo> splitting <mrow>s (mrow structure is preserved)
    let upToBreak = null;           // the first part of the line (the later part stays in the 'mrow's) 
    let breakElement = mo;          // the element we break on as we move to the root

    // FIX: should check operator dictionary to see if 'mo' is infix or if 'form' is set here or on an ancestor
    //      in leu of that, this test to see if there is something on left/right is not a correct infix test (e.g, 2nd '-' in "--a") if not well structured
    if (mo.previousElementSibling !== null && mo.nextElementSibling !== null) {
        mo.setAttribute('form', 'infix');
    }
    let parent = breakElement.parentElement;
    for (; parent.tagName === 'mrow'; parent = parent.parentElement) {
        let newMRow = newElement('mrow');

        // walk across the <mrow> pulling out children and putting them into a new <mrow>
        while (parent.firstElementChild) {
            const child = parent.firstElementChild;
            if (child === breakElement) {                       // found the split point
                if (linebreakstyle === 'after') {
                    newMRow.appendChild(child);                 // put on current row
                    linebreakstyle = 'before';                  // everything else is in subsequent row
                    break;
                } else if (linebreakstyle === 'duplicate') {
                    linebreakstyle = 'before';                  // everything else is in subsequent row 
                    newMRow.appendChild(child.cloneNode(true)); // leave 'child' in tree so it starts new line
                }
                // if 'before'/'duplicate', 'child' is at the start of the next row
                break;
            }
            newMRow.appendChild(child);
        }

        breakElement = parent;
        if (upToBreak) {
            newMRow.appendChild(upToBreak);
        }
        upToBreak = (newMRow.children.length === 1) ? newMRow.firstElementChild : newMRow; // avoid needlessly nesting <mrow>s
    }
    if (breakElement.tagName === 'mrow' && breakElement.children.length === 1) {
        const newBreakElement = breakElement.firstElementChild;
        breakElement.replaceWith(newBreakElement);       // remove extra mrow (hides <mo>)
        breakElement = newBreakElement;
    }
    return addNewLineBreakRow(parent, upToBreak, breakElement);
}

/**
 * 
 * @param {Element} mo 
 * @returns {Element}
 */
function computeLineBreakRoot(mo) {
    let mrow = mo;
    let parent = mo.parentElement;
    while (parent.tagName === 'mrow' || parent.tagName === 'mstyle' || parent.tagName === 'mpadded') {
        mrow = parent;
        parent = parent.parentElement;
    }
    return mrow;
}

/**
 * Finds all the forced linebreaks, splits the lines, and stores the indent info on the 'mtd'
 * @param {Element} math 
 */
function splitIntoLinesAtForcedBreaks(math, maxLineWidth) {
    const forcedBreakElements = math.querySelectorAll('mo[linebreak="newline"]');
    if (forcedBreakElements.length === 0) {
        // pre-compute depth info since it will be used many times in linebreaking and (auto) indentation
        // do before splitting line because that ruins depth computation for indentation
        return;
    }

    /** @type {Element} */
    let lastRow = null;
    // for each forced linebreak, add a new row to the table
    forcedBreakElements.forEach(mo => {
        lastRow = splitLine(mo);
    });

    // store linebreak info on the <mtd> so we can get it later
    // because the info goes on the line after the <mo>, it is easier to do this in a second pass once all the <mtd>s exist
    const tableChildren = lastRow.parentElement.children;
    storeLineBreakAttrsOnMtd(tableChildren[0].firstElementChild, tableChildren[0].firstElementChild);
    for (let i = 0; i < forcedBreakElements.length; i++) {
        storeLineBreakAttrsOnMtd(tableChildren[i + 1].firstElementChild, forcedBreakElements[i]);
    }
}

/**
 * Returns true if first line of math
 * @param {Element} mtr
 * returns {boolean}
 */
function isFirstRow(mtr) {
    return mtr === mtr.parentElement.firstElementChild;
}

/**
 * Find the leftMostChild not counting an mspace
 * @param {Element} element 
 */
function leftMostChild(element) {
    while (element.children.length > 0) {
        element = element.firstElementChild;
    }
    return (element.tagName == 'mspace') ? element.nextElementSibling : element;
}

function isMatchLessThanHalfWay(xStart, indent, maxWidth) {
    return (indent - xStart) <= 0.5 * maxWidth;
}

/**
 * Return the operators that match 'char'. For the match, "+"/"-" match each other 
 * @param {Element[]} operators 
 * @param {string} char 
 * @returns {Element[]}
 */
function filterOnCharMatch(operators, char) {
    if (char === '-') {
        char = '+';
    }
    return operators.filter(function (operator) {
        let opChar = operator.textContent.trim();
        if (opChar === '-') {
            opChar = '+';
        }
        return char === opChar;
    })
}
/**
 * Look through all the previous lines and find a good indent 
 * Potential breakpoints are those 'mo's at the same depth as the 'mo' that starts the current line
 * Preference is given to an 'mo' with the same char (i.e, if we have a '+', find another '+' at the same depth).
 * Of those 'mo' that match, the one with the minimum amount of indent is chosen so that more fits on that line.
 * @param {Element} mtd
 * @returns {number}
 */
function computeAutoShiftAmount(mtd) {
    if (isFirstRow(mtd.parentElement)) {
        return 0;
    }

    const mo = leftMostChild(mtd);
    if (!mo.hasAttribute(ELEMENT_DEPTH)) {
        console.log(`Linebreaking error: depth not set on ${mo.tagName} with content '${mo.textContent.trim()}'`);
    }
    const moDepth = mo.getAttribute(ELEMENT_DEPTH);
    const moChar = mo.textContent.trim();

    let minIndentAmount = 10e20;
    let operatorMatched = false;
    const xStart = mtd.getBoundingClientRect().left;
    const maxWidth = parseFloat(mtd.parentElement.parentElement.getAttribute(MTABLE_LINEBREAKS_ATTR));     // stored on mtable
    let previousLine = mtd.parentElement.previousElementSibling;
    while (previousLine) {
        const previousLineOperators = getAllBreakPoints(previousLine.firstElementChild).filter(
            operator => moDepth === operator.getAttribute(ELEMENT_DEPTH)
        );
        previousLineOperators.length === 0 ? 'none' : previousLineOperators[0].textContent.trim();
        const previousLineMatches = filterOnCharMatch(previousLineOperators, moChar);
        let indent = previousLineMatches.length === 0 ? minIndentAmount : previousLineMatches[0].getBoundingClientRect().left;
        if (isMatchLessThanHalfWay(xStart, indent, maxWidth)) {
            // characters match
            if (indent < minIndentAmount || !operatorMatched) {
                operatorMatched = true;
                minIndentAmount = indent;
            }
        }
        indent = previousLineOperators.length === 0 ? minIndentAmount : previousLineOperators[0].getBoundingClientRect().left;
        if (!operatorMatched && isMatchLessThanHalfWay(xStart, indent, maxWidth)) {
            minIndentAmount = Math.min(indent, minIndentAmount);
        }

        previousLine = previousLine.previousElementSibling;
    }

    // if there were no matches, do a fixed amount of indents
    if (minIndentAmount == 10e20) {
        return convertToPx(mo, FALLBACK_INDENT_AMOUNT);
    }
    return minIndentAmount - xStart;
}

/**
 * Adds shift amounts to the mtd
 * The amount is finalized in a pass after linebreaking.
 * It is not done now because center/right alignment positioning would mess up linebreaking
 * @param {Element} mtd
 * @param {string} alignment    // should be one of 'left'|'center'|'right'
 * @param {number} shiftAmount 
 */
function setupLineShifts(mtd, alignment, shiftAmount) {
    mtd.setAttribute('style', `text-align: ${alignment};`);

    // Igalia chrome's core implementation seems to require an mrow around the contents of the mtd (6/2020), so stick mspace in mrow
    const mspace = newElement('mspace');
    mspace.setAttribute('width', shiftAmount.toString() + 'px');
    mtd.setAttribute(INDENT_AMOUNT, shiftAmount.toString());        // save so linebreaking knows where the line starts
    if (mtd.children.length !== 1 || mtd.firstElementChild.tagName !== 'mrow') {
        console.log(`unexpected element '${mtd.firstElementChild.tagName}' encountered while trying to indent line`);
        return;
    }
    const mrow = mtd.firstElementChild;

    if (alignment === 'right') {
        mrow.appendChild(mrow);
    } else {
        // works for both 'left' and 'center'
        mrow.insertBefore(mspace, mrow.firstElementChild);
    }
    return;
}

/**
 * Return the amount of indent that should happen if we break on 'mo'
 * @param {Element} mo          // mo or mtd
 * @param {number} xLineStart 
 * @param {Object} indentAttrs 
 * @returns {number}
 */
function computeIndentAmount(mo, xLineStart, indentAttrs) {
    let indentShiftAsPx = parseFloat(indentAttrs.indentShift);
    let indentAlign = indentAttrs.indentAlign;
    if (indentAlign === 'id') {
        const elementWithID = getElementByIdEverywhere(indentAttrs.target);
        if (elementWithID) {
            return elementWithID.getBoundingClientRect().left - xLineStart + indentShiftAsPx;
        }
        indentAlign = 'auto';
    }

    if (indentAlign == 'auto') {
        if (indentAttrs.firstMiddleOrLast !== 'first') {
            // since it isn't the first line, 'mtd' (in a linebreaking mtable) must be a parent 
            while (mo.tagName !== 'mtd' && !mo.parentElement.parentElement.hasAttribute(MTABLE_HAS_LINEBREAKS)) {
                mo = mo.parentElement;
            }
            indentShiftAsPx += computeAutoShiftAmount(mo);
        }
    }
    return indentShiftAsPx;
}

/**
 * Indent the line
 * @param {Element} mtd 
 */
function indentLine(mtd) {
    if (mtd.hasAttribute(INDENT_AMOUNT)) {
        return;         // already processed
    }
    const indentAttrs = JSON.parse(mtd.getAttribute(INDENT_ATTRS));

    const xLineStart = mtd.getBoundingClientRect().left;
    let indentShiftAsPx = computeIndentAmount(mtd, xLineStart, indentAttrs);
    let indentAlign = indentAttrs.indentAlign;
    if (indentAlign === 'id') {
        const elementWithID = getElementByIdEverywhere(indentAttrs.target);
        if (elementWithID && !mtd.querySelector('#' + indentAttrs.target)) {    // don't try to align with 'id' in same line
            setupLineShifts(mtd, 'left', indentShiftAsPx);
            return;
        }
        indentAlign = 'auto';
    }

    if (indentAlign == 'auto') {
        indentAlign = 'left';
    }
    setupLineShifts(mtd, indentAlign, indentShiftAsPx);
    return;
}

/**
 * Returns the outermost embellishment of an 'mo'
 * @param {Element} mo 
 * @returns {Element}
 */
function expandToEmbellishedElement(mo) {
    let el = mo;
    let parent = mo.parentElement;
    do {
        if (parent.firstElementChild !== mo || !EMBELLISHED_ELEMENT_NAMES.includes(parent.tagName)) {
            if (el !== mo) {
                if (!mo.hasAttribute(ELEMENT_DEPTH)) {
                    console.log(`Linebreaking error: depth not set on ${mo.tagName} with content '${mo.textContent.trim()}'`);
                }
                el.setAttribute(ELEMENT_DEPTH, mo.getAttribute(ELEMENT_DEPTH));  // lift depth setting
            }
            return el;
        }
        el = parent;
        parent = parent.parentElement;
    } while (parent);
    console.log(`In linebreaking in expandToEmbellishedElement: unexpected loop termination. mo = '${mo.tagName}'`);
    return mo;      // shouldn't get here
}

/**
 * Return all the potential break points inside 'element' (math or mtd)
 * @param {Element} element 
 * @returns {Element[]}
 */
function getAllBreakPoints(element) {
    // FIX: only want <mo> not in 2-d elements -- grabbing all and trying to cleanup seems wasteful
    const allMos = Array.from(element.querySelectorAll('mo:not([linebreak="nobreak"])'));
    const linebreakMos = allMos.filter(mo => {
        do {
            mo = mo.parentElement;
        } while (mo.tagName === 'mrow' || mo.tagName === 'mstyle' || mo.tagName === 'mpadded'); // assumes mfenced has been polyfilled already
        return mo.tagName === 'math' || isInLineBreakTable(mo);
    });
    return linebreakMos.map(mo => expandToEmbellishedElement(mo));
}
const InvisibleFunctionApply = '\u2061';
const PrecedenceTable = {
    '(': 0,
    ')': 0,
    '=': 10,
    '+': 30,
    '±': 30,
    '-': 30,
    '*': 40,
    '×': 40,
    InvisibleTimes: 40,
    InvisibleFunctionApply: 50
};

//FIX: the list of open chars needs to come from the spec
const OpenList = [
    '(', '[', '{'
];

//FIX: the list of close chars needs to come from the spec
const CloseList = [
    ')', ']', '}'
];

/**
 * 
 * @param {string} ch 
 * @returns number
 */
function operatorPrecedence(ch) {
    // FIX: replace with real lookup
    const precedence = PrecedenceTable[ch];
    if (precedence === undefined) {
        return 40;      // FIX: not sure what value should be used
    }
    return precedence;
}

/**
 * 
 * @param {Element} el 
 * @returns {Element}
 */
function getEmbellishedOperator(el) {
    if (el.tagName === 'mo') {
        return el;
    }

    let firstChild = el;
    while (EMBELLISHED_ELEMENT_NAMES.includes(firstChild.tagName)) {
        firstChild = firstChild.firstElementChild;
        if (!firstChild) {
            return el;
        }
    }
    return firstChild.tagName === 'mo' ? firstChild : el;
}

/**
 * 
 * @param {[any]} stack
 * @returns {any}
 */
function top(stack) {
    return stack[stack.length - 1];
}

/**
 * 
 * @param {[] | Element} elementStackEntry 
 * @returns {boolean}
 */
function isOperand(elementStackEntry) {
    return Array.isArray(elementStackEntry);
}

/**
 * 
 * @param {string} mo
 * @returns {boolean}
 */
function isPrefix(mo) {
    // FIX: include prefix ops in this; might need to pass in whether char before is operand
    return OpenList.includes(mo);
}

/**
 * The "reduce" step of parsing.
 * @param {[number]} opStack
 * @param {[Element | [Element]]} elementStack
 * @param {number} childPrecedence
 * @returns {[[number], [Element | [Element]]}

 */
function parseReduce(opStack, elementStack, childPrecedence) {
    // FIX: really need to include prefix/postfix info
    let stackPrecedence = top(opStack);
    let previousStackPrecedence = stackPrecedence + 1;          // needs to start with different value
    while (childPrecedence < stackPrecedence) {                // stack never reaches length zero due to initial value
        let iPopTo = elementStack.length - 1;                  // we need to pop at least one element
        while (Array.isArray(elementStack[iPopTo])) {          // pop any "operands" (items already reduced to an "mrow") 
            iPopTo--;
        }
        // iPopTo now points to operator corresponding to top of opStack. Pop that from elementStack and any more operands
        iPopTo--;
        opStack.pop();
        while (Array.isArray(elementStack[iPopTo])) {          // pop any "operands" (items already reduced to an "mrow") 
            iPopTo--;
        }
        // iPopTo now points to the operator that should be on top of the elementStack
        const elementsPopped = elementStack.splice(iPopTo + 1);
        if (stackPrecedence === previousStackPrecedence &&                      // n-ary
            Array.isArray(top(elementsPopped))) {         // not first reduction
            const lastElement = elementsPopped.pop();
            elementStack.push(elementsPopped.concat(lastElement));
        } else {
            elementStack.push(elementsPopped);
        }
        previousStackPrecedence = stackPrecedence;
        stackPrecedence = top(opStack);
    }
    return [opStack, elementStack];
}

const InvisibleFunctionApplyMo = ( function() {
    const mo = document.createElementNS(MATHML_NS, 'mo');
    mo.textContent = InvisibleFunctionApply;
    return mo;
});

function addInvisibleFunctionApply(opStack, elementStack) {
    // reduce if need be, then push
    const childPrecedence = operatorPrecedence(InvisibleFunctionApply);
    [opStack, elementStack] = parseReduce(opStack, elementStack, childPrecedence);
    opStack.push(childPrecedence);
    elementStack.push(InvisibleFunctionApplyMo);
}

/**
 * @param {Element} treeRoot 
 * @param {[number]} opStack
 * @param {[Element | [Element]]} elementStack
 * @returns {[[number], [Element | [Element]]}
 */
function buildParseTree(treeRoot, opStack, elementStack) {
    // Act like a operator precedence parser, where operator precedences are shifted on or "reduced" based on their precedence
    // Arrays are treated as operands/something already reduced.
    for (let i = 0; i < treeRoot.children.length; i++) {
        // FIX: might be adorned mrow, so just checking for <mo> is not enough
        const child = getEmbellishedOperator(treeRoot.children[i]);
        if (child.tagName === 'mo') {
            const childCh = child.textContent.trim();
            if (isOperand(top(elementStack)) && isPrefix(childCh)) {
                // operand/operand -- need to add either invisible times or function apply, using function apply
                addInvisibleFunctionApply(opStack, elementStack);
            }

            if (isPrefix(childCh)) {
                opStack.push(0);
                elementStack.push(child);        // push onto the last element (not the stack)
            } else if (CloseList.includes(childCh)) {
                [opStack, elementStack] = parseReduce(opStack, elementStack, 0);
                elementStack.push(child);
                if (top(opStack) !== 0) {
                    console.log(`In linebreaking, parsing error with close char -- top of op stack is ${top(opStack)}`);
                }
                opStack.pop();

                // FIX: need to figure out implicit mult/function call (function call pops more)
                const elementsPopped = elementStack.splice(elementStack.length - 3);
                elementStack.push(elementsPopped);
            } else {
                // reduce if need be, then push
                const childPrecedence = operatorPrecedence(childCh);
                [opStack, elementStack] = parseReduce(opStack, elementStack, childPrecedence);
                opStack.push(childPrecedence);
                elementStack.push(child);
            }
        } else if (child.tagName === 'mrow' || child.tagName === 'mpadded' || child.tagName === 'mstyle') {
            [opStack, elementStack] = buildParseTree(child, opStack, elementStack);
        } else {
            if (isOperand(top(elementStack))) {
                // operand/operand -- need to add either invisible times or function apply, using function apply
                addInvisibleFunctionApply(opStack, elementStack);
            }
            elementStack.push([child]);       // treat as operand/reduced (hence push array)
        }
    }
    return [opStack, elementStack];
}

/**
 * Store nesting depth info for each 'mo' as an attr. Depth is based on depth in tree of arrays
 * @param {[Element | [Element]]} elementStack
 * @param {number} depth
 */
function setDepthAttr(elementStack, depth) {
    elementStack.forEach(child => {
        if (Array.isArray(child)) {
            setDepthAttr(child, depth + 1);
        } else if (child.tagName === 'mo') {
            child.setAttribute(ELEMENT_DEPTH, depth.toString());
        }
    });
}

/**
 * Tries to determine if there is good mrow structure. If so returns true.
 * @param {Element} mrow
 * @returns {boolean}
 */
function isMRowWellStructured(mrow) {
    if (mrow.childElementCount <= 3) {
        return true;
    }
    // only n-ary with same operator precedence and alternating operand/operator/operand are valid
    if (mrow.childElementCount % 2 === 0) {
        return false;
    }

    const precedence = operatorPrecedence(mrow.children[1].textContent.trim());
    for (let i = 0; i < mrow.childElementCount - 1; i += 2) {
        if (mrow.children[i].tagName === 'mo' ||
            mrow.children[i + 1].tagName !== 'mo' ||
            operatorPrecedence(mrow.children[i + 1].textContent.trim()) !== precedence) {
            return false;
        }
    }
    return true;
}

/**
 * Tries to determine if there is good mrow structure. If so returns true.
 * @param {Element} treeRoot
 * @returns {boolean}
 */
function isWellStructured(treeRoot) {
    // True if there are 3 children or less because this is infix prefix or postfix, and also covers fences but should have just one child.
    // N-ary functions should alternate between operand/operator/operand and the operators all have the same precedence.
    //   this allows for +/-, multiple forms of times, or multiple relations to exist.
    // Especially for n-ary functions, we can't easily tell if this good structure or "luck".
    // We check up to three mrows and if all seem well structured, we say this is well structured.
    const mrows = Array.from(treeRoot.querySelectorAll('mrow'));
    if (treeRoot.tagName === 'mrow' || treeRoot.tagName === 'math') { // could be 'math' with no mrows
        mrows.push(treeRoot);
    }
    switch (mrows.length) {
        case 0:
            return true;
        case 1:
            return isMRowWellStructured(mrows[0]);
        case 2:
            return isMRowWellStructured(mrows[0]) && isMRowWellStructured(mrows[1]);
        default:
            return isMRowWellStructured(mrows[0]) &&
                isMRowWellStructured(mrows[Math.floor(mrows.length / 2)]) &&
                isMRowWellStructured(mrows[mrows.length - 1]);
    }
}


/**
 * Store nesting depth info for each 'mo' as an attr. Depth is based on depth in tree
 * @param {Element} el
 * @param {number} depth
 */
function setDepthAttrBasedOnOriginalTree(el, depth) {
    const embellishedOp = getEmbellishedOperator(el);
    if (embellishedOp.tagName === 'mo') {
        embellishedOp.setAttribute(ELEMENT_DEPTH, depth.toString());
        return;
    }
    if (el.tagName === 'mrow' || el.tagName === 'mstyle' || el.tagName === 'mpadded' || el.tagName === 'math') {
        for (let i = 0; i < el.childElementCount; i++) {
            setDepthAttrBasedOnOriginalTree(el.children[i], depth + (el.tagName === 'mrow' ? 1 : 0));
        }
    }
}

/**
 * Store nesting depth info for each 'mo' as an attr
 * @param {Element} linebreakRoot 
 */
function addDepthInfo(linebreakRoot) {
    // This works in two passes:
    // 1. For each potential linebreak (include treeRoot), parse tree (array whose children are )
    // 2. Set the depth of the operators in the parse tree

    /** @type {Element[]} */
    let linebreakRoots = [];        // keep track of the things we have already linebroken
    const linebreakElements = Array.from(linebreakRoot.querySelectorAll('mo[linebreak="newline"]'));
    linebreakElements.push(linebreakRoot);                                // add non forced 
    // for each forced linebreak, add a new row to the table
    linebreakElements.forEach(mo => {
        const linebreakRoot = computeLineBreakRoot(mo);
        if (!linebreakRoots.includes(linebreakRoot)) {
            linebreakRoots.push(linebreakRoot);
            // if it looks to be well structured, don't second guess the structure (and save time)
            if (isWellStructured(linebreakRoot)) {
                setDepthAttrBasedOnOriginalTree(linebreakRoot, 0);
            } else {
                let [opStack, elementStack] = buildParseTree(linebreakRoot, [-1], [null]);         // '-1' guarantees stack never gets empty
                if (elementStack.length != 2) {
                    [opStack, elementStack] = parseReduce(opStack, elementStack, -1);
                }
                setDepthAttr(elementStack[1], 0);
            }
        }
    });
}

/********* linebreaking penalty computation *******/
/**
 * Used in penalty computation; 0 <= x <= max
 * @param {number} x 
 * @param {number} xMax
 * @returns {number}
 */
function computeLineFillPenalty(x, xMax) {
    // ideal amount is not necessarily a full line.
    // squaring the distance away steepens the curve/penalty if you move too far away
    const penalty = (LINE_FILL_TARGET * xMax - x) / xMax;
    return penalty * penalty;		// always positive but less than one -- far away is much worse
}

/**
 * Used in penalty computation
 * @param {Element} mo
 * @returns {number}
 */
function computeDepthPenalty(mo) {
    // Use an exponential decay for the penalty function: 1 - 1.1^-depth
    // That gives higher importance to depth changes closer to the root
    // Set up some initial values to avoid expensive computation
    const depthTable = [
        0.050000, 0.090909, 0.173554, 0.248685,
        0.316987, 0.379079, 0.435526, 0.486842,
        0.533493, 0.575902, 0.614457, 0.649506,
        0.681369, 0.710336, 0.736669, 0.760608
    ];

    if (!mo.hasAttribute(ELEMENT_DEPTH)) {
        console.log(`Linebreaking error: depth not set on ${mo.tagName} with content '${mo.textContent.trim()}'`);
    }
    let depth = parseInt(mo.getAttribute(ELEMENT_DEPTH));
    return depth >= depthTable.length ? 1 - 3.482066 / depth : depthTable[depth]; // always less than one
}

/**
 * Computes a penalty based on % line filled, depth in the syntax tree, and whether the user indicated a break here is good/bad
 * @param {Element} mo 
 * @param {number } x 
 * @param {number} xMax 
 * @returns {number}
 */
function computePenalty(mo, x, xMax) {
    const penalty = DEPTH_PENALTY_TO_FILL_PENALTY_RATIO * computeDepthPenalty(mo) + computeLineFillPenalty(x, xMax);
    const linebreakAttrVal = getMathMLAttrValueAsString(mo, 'linebreak', 'auto');
    if (linebreakAttrVal === 'goodbreak') {
        return penalty / GOOD_PENALTY_SCALE_FACTOR;
    } else if (linebreakAttrVal === 'badbreak') {
        return BAD_PENALTY_SCALE_FACTOR * penalty;
    } else {            // 'nobreak' has already been filtered out
        return penalty;
    }
}

/**
 * Handles substitution of char if InvisibleTimes ('linebreakmultchar' mo attr)
 * The array is modified and the node replaced in the DOM
 * @param {Element[]} potentialBreaks
 * @param {number} index                           // index of char in  
 * @returns {Element}                              // the mo @index or it's replacement
 */
function substituteCharIfNeeded(potentialBreaks, index) {
    const mo = potentialBreaks[index];
    if (mo.textContent.trim() === '\u2062' /* invisible times */) {
        const replaceChar = getMathMLAttrValueAsString(mo, 'linebreakmultchar', '\u2062');
        if (replaceChar !== '\u2062') {
            const replacementMO = newElement('mo');
            replacementMO.textContent = replaceChar;
            copyAttributes(replacementMO, mo);
            mo.replaceWith(replacementMO);
            potentialBreaks[index] = replacementMO;
            return replacementMO;
        }
    }
    return mo;
}
/**
 * The entry point to linebreaking
 * @param {Element} element             // <math> or <mtd> (if previously split due to manual linebreak)
 * @param {number} maxLineWidth
 */
function linebreakLine(element, maxLineWidth) {
    // do we need to linebreak this element?
    //console.log(`    linebreakLine: full ${element.getAttribute(FULL_WIDTH)}, max ${maxLineWidth}`)
    if (parseFloat(element.getAttribute(FULL_WIDTH)) <= maxLineWidth) {
        return;
    }

    // collect up all the places (mo's) where the line can break
    const potentialBreaks = getAllBreakPoints(element);

    // Loop through all the potential break points looking for a good spot to break
    // This works by checking each potential break point until the current line is too wide
    // For each potential breakpoint, we compute a "penalty" for breaking there.
    // We keep track of the minimum penalty found for all the elements on the line.
    // After splitting the line, we start again with the next potential breakpoint and repeat the above.
    // The process stops when get to the last potential breakpoint

    // the leftSide can change as linebreaks cause reflow of ancestors
    //    'element' might center/right align mrow inside, so use child's position

    let lineBreakMO;                // the 'mo' used for linebreaking (might be changed if invisible times)
    /** @type {Element} */
    // @ts-ignore
    let lastRow = (element.tagName === 'mtd') ?
        element.parentElement :
        element.parentNode;
    // when a line is split, there are now two of them (actually rows in mtable); this is the last one
    let nLines = 0;                 // really only care if first line, but useful for debugging to know # of lines
    let iOperator = 1;              // start of each line (want at least one element on the first line)
    while (iOperator < potentialBreaks.length) {
        let iLine = iOperator;      // index into current line of breakpoints
        // the amount of room we have is reduced by the indentation if we break here.
        const firstMTD = element.tagName === 'mtd' ? lastRow.firstElementChild : lastRow.lastElementChild;
        const indentAttrs = JSON.parse(firstMTD.getAttribute(INDENT_ATTRS));
        const leftSide = indentAttrs.linebreakstyle === 'before' ?
            potentialBreaks[iOperator - 1].getBoundingClientRect().left :
            firstMTD.firstElementChild.getBoundingClientRect().left;
        const indentAmount = computeIndentAmount(
            potentialBreaks[iOperator - 1],   // where we broke
            firstMTD.getBoundingClientRect().left,
            indentAttrs);
        const lineBreakWidth = maxLineWidth - indentAmount;
        let minPenalty = 100000.0;  // in practice, the numbers don't get over 2
        let iMinPenalty = -1;

        // walk across the current line until it is full
        // keep track of the spot that gives the minimum penalty
        while (iLine < potentialBreaks.length) {
            // FIX: should check breakpoint === invisible times (\u2062) and if linebreakmultchar is not \u2062, include the width of the substitution
            const xRelativePosition = potentialBreaks[iLine].getBoundingClientRect().right - leftSide;
            if (xRelativePosition > lineBreakWidth) {
                break;
            }
            const penalty = computePenalty(potentialBreaks[iLine], xRelativePosition, lineBreakWidth);
            if (penalty <= minPenalty) {
                minPenalty = penalty;
                iMinPenalty = iLine;
            }
            iLine++;
        }

        if (iMinPenalty === -1) {
            console.log(`Linebreaking error: no breakpoint found on line ${nLines + 1}`);
            iMinPenalty = iOperator;    // for count to advance
        }
        nLines++;
        iOperator = iMinPenalty + 1;                    // move on to next line

        if (iOperator < potentialBreaks.length) {
            // now that we have a break point, we need to split at that point
            // the creates two rows -- the first one is the line we just processed so we figure out the indentation
            // (there is a little bookkeeping also needed)
            lineBreakMO = substituteCharIfNeeded(potentialBreaks, iMinPenalty);
            lastRow = splitLine(potentialBreaks[iMinPenalty]);
            // only needs to be set once, but the value is needed to compute the indent amount as soon as we aren't on the first line
            lastRow.parentElement.setAttribute(MTABLE_LINEBREAKS_ATTR, maxLineWidth.toString());
            storeLineBreakAttrsOnMtd(lastRow.firstElementChild, lineBreakMO);

            const previousRow = lastRow.previousElementSibling;
            if (!previousRow.firstElementChild.hasAttribute(INDENT_ATTRS)) {
                // created a new mtable -- the indent attrs were on the math element.
                previousRow.firstElementChild.setAttribute(INDENT_ATTRS, element.getAttribute(INDENT_ATTRS));
            }
            indentLine(previousRow.firstElementChild);
        } else if (nLines === 1) {
            // shouldn't get here, but happens if entire expr fits on one line
            return;
        }

        // set value for start of next line
    }
    // all done with linebreaking -- indent the last row
    if (nLines > 0) {
        indentLine(lastRow.firstElementChild);
    }
    return;
}


/**
 * Linebreak/indent display math
 * There is no good target in core, so the following hack is used if linebreaking is needed:
 * 1. The custom element 'math-with-linebreaks' is created as the parent of 'math' if it isn't already there.
 * 2. A clone is made and added into the shadow DOM (avoids duplicate 'id' problems)
 * 3. A marked <mtable> is created at the appropriate point (typically a child of <math>) and each line of the math is a row in the table
 * 
 * On resize, we throw out the old shadow and start from fresh with a clone of the <math> element. 
 * 
 * Since most math doesn't need to be linebroken, we start with a quick check to see if there are forced linebreaks or if it is wide.
 * @param {HTMLElement} math 
 */

/*
 * Note: this is not efficient code due to making changes to the live DOM -- tons of reflow potentially happens,
 *   although most reflow is probably limited in scope except for when a new line is added.
 * It would be useful to measure whether reflow is a majority of the time used for linebreaking.
 * An alternative would be to copy the left/right position of the potential break points to attrs on the corresponding clone's break points.
 * That covers the majority of what needs to be measured. The other cases are:
 *    - the left most child at the start of a line. That is either an operator (hence already marked) for linebreakstyle != 'right'
 *      or the child after an 'mo' for the other linebreak styles (after indenting, it can also be an mspace, but those should be ignored)
 *    - the left/right position of the created line -- that can be computed from the children at the edges when it is created
 *      this means siblings to both the left/right of a potential linebreak should get their left/right position stored
 * Using stored attrs offers a minor code simplification because the code doesn't need to query left/right as often because they don't change.
 * 
 * Another efficiency idea:
 * If we add parsing to get the correct depth of the <mo>s, that might be a little slow, especially for resizing.
 * The mrow structure is important for knowing the depth for indentation alignment and linebreak penalties, but if we add parsing,
 * the structure is not important. That means that we can avoid throwing out the shadow DOM 'math' and instead zip the lines back together.
 * The structure is ruined, but depth computations wouldn't need to be done again.
 */
const SHADOW_ELEMENT_NAME = "math-with-linebreaks";

/**
 * The main starting point
 * @param {Element} customElement        // <math> (likely inside a shadow DOM)
 * @param {number} maxLineWidth
 */
function lineBreakDisplayMath(customElement, maxLineWidth) {
    maxLineWidth = Math.min(maxLineWidth, parseFloat(customElement.getAttribute(FULL_WIDTH)));
    const math = customElement.shadowRoot.lastElementChild;
    if (math.childElementCount > 1) {
        // add an mrow underneath 'math' -- having an mrow makes the rest of the code work more cleanly
        const mrow = newElement('mrow');
        while (math.firstElementChild) {
            mrow.appendChild(math.firstElementChild);
        }
        math.appendChild(mrow);
    }
    //console.log(`  lineBreakDisplayMath: full ${customElement.getAttribute(FULL_WIDTH)}, max ${maxLineWidth}`);

    shadowRoot.set(customElement.shadowRoot);

    splitIntoLinesAtForcedBreaks(math);

    // gather up all the parts with forced linebreaks (turned into an array because don't want them live (linebreaking augments them later)
    let linebreakGroups = Array.from(math.querySelectorAll(`mtable[${MTABLE_HAS_LINEBREAKS}]`));
    if (linebreakGroups.length > 0) {
        //console.log(`    ${linebreakGroups.length} forced linebreaks`);
        linebreakGroups.forEach(table => {
            table.setAttribute(MTABLE_LINEBREAKS_ATTR, maxLineWidth.toString());
            const lines = Array.from(table.children);     // don't want a live collection -- messes up with linebreaks adding rows
            lines.forEach(line => {
                const mtd = line.firstElementChild;
                indentLine(mtd);
                if (mtd.firstElementChild.getBoundingClientRect().right - mtd.getBoundingClientRect().left > maxLineWidth) {
                    // the line may still be too long and need to be broken
                    linebreakLine(mtd, maxLineWidth);
                }
            });
        });
    } else if (parseInt(customElement.getAttribute(FULL_WIDTH)) >= maxLineWidth) {
        // no forced breaks, but still need to check for auto breaks
        // they may create some breaks (mtable), and those breaks need indenting
        math.setAttribute(INDENT_ATTRS, JSON.stringify(computeIndentAttrObject(math, 'first')));
        linebreakLine(math, maxLineWidth);
    }
}
// the width before linebreaking *not* taking into account forced linebreaks (set on original math element)
const FULL_WIDTH = 'data-full-width';

// the width to use for linebreaking (set on shadow host)
const LINE_BREAK_WIDTH = 'data-linebreak-width';

/**
 * 
 * @param {Element} customElement 
 * @param {Element} math 
 */
function setShadowRootContents(customElement, math) {
    /** @type {HTMLElement} */
    // @ts-ignore
    const mathClone = cloneElementWithShadowRoot(math);
    customElement.shadowRoot.appendChild(mathClone);
    // keep track of the width before linebreaking
    let fullWidth = mathClone.lastElementChild.getBoundingClientRect().right - mathClone.firstElementChild.getBoundingClientRect().left;
    if (mathClone.hasAttribute('maxwidth')) {
        fullWidth = Math.min(fullWidth, convertToPx(mathClone, mathClone.getAttribute('maxwidth')));
    }
    customElement.setAttribute(FULL_WIDTH, fullWidth.toString());
    lineBreakDisplayMath(customElement, fullWidth);
    customElement.setAttribute(LINE_BREAK_WIDTH, (2 * fullWidth).toString());

    //console.log(`Set... y: ${customElement.getBoundingClientRect().y}; FULL_WIDTH: ${customElement.getAttribute(FULL_WIDTH)}`)
}

function addCustomElement(math) {
    // only handle display math -- inline math requires being able to have a reflow observer, and that doesn't exist
    // even if the display math fit on the current line, if the width shrinks, it might not fit.
    //   we add the custom element with the resize observer so we can tell when that happens.
    const computedStyle = getComputedStyle(math).getPropertyValue('display');
    const displayValue = math.hasAttribute('display') ? math.getAttribute('display') : 'inline';
    if (computedStyle === 'inline' || displayValue === 'inline') {
        return null;
    }

    if (math.tagName.toLowerCase() === SHADOW_ELEMENT_NAME) {
        return math;        // already is a custom element
    } else if (math.parentElement.tagName.toLowerCase() === SHADOW_ELEMENT_NAME) {
        return math;        // already inside a custom element
    } else {
        //console.log(`addCustomElement... math width ${math.getBoundingClientRect().width}`);
        const mathParent = math.parentElement;
        const nextSibling = math.nextElementSibling;
        const shadowHost = document.createElement(SHADOW_ELEMENT_NAME);
        shadowHost.appendChild(math);
        mathParent.insertBefore(shadowHost, nextSibling);
        addDepthInfo(math);
        setShadowRootContents(shadowHost, math);
        return null;
    }
}

_MathTransforms.add('math', addCustomElement);

// @ts-ignore
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        if (entry.target.tagName.toLowerCase() === SHADOW_ELEMENT_NAME) {
            const customElement = entry.target;
            //console.log(`In resize...entry width: ${entry.contentRect.width}; prev width: ${customElement.getAttribute(LINE_BREAK_WIDTH)}; \
            //            FULL ${customElement.getAttribute(FULL_WIDTH)}; $y: ${customElement.getBoundingClientRect().y}`);
            if (entry.contentRect.width < parseInt(customElement.getAttribute(FULL_WIDTH))) {  // room to break is less than full width
                const mathClone = cloneElementWithShadowRoot(customElement.firstElementChild);
                const oldDisplayedMath = customElement.shadowRoot.lastElementChild;
                oldDisplayedMath.replaceWith(mathClone);
                customElement.setAttribute(LINE_BREAK_WIDTH, entry.contentRect.width.toString());
                //console.log("   linebreaking...")
                lineBreakDisplayMath(customElement, entry.contentRect.width.toString());
            } else if (!customElement.hasAttribute(LINE_BREAK_WIDTH) ||
                parseInt(customElement.getAttribute(LINE_BREAK_WIDTH)) <= parseInt(customElement.getAttribute(FULL_WIDTH))) {
                // enough room for line but previous one was linebroken -- don't linebreak
                const mathClone = cloneElementWithShadowRoot(customElement.firstElementChild);
                const oldDisplayedMath = customElement.shadowRoot.lastElementChild;
                oldDisplayedMath.replaceWith(mathClone);
                customElement.setAttribute(LINE_BREAK_WIDTH, (2 * entry.contentRect.width).toString()); // 2*width to make sure no linebreaking
                lineBreakDisplayMath(customElement, 2 * entry.contentRect.width.toString());
            }
            // else enough room and wasn't linebroken
        }
    }
});

// define the custom element in case someone wants to use it directly -- it should have only 'math' as its child
customElements.define(SHADOW_ELEMENT_NAME, class extends HTMLElement {
    constructor() {
        super();

        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
        const math = this.firstElementChild;
        //console.log(`in constructor...math width ${math ? math.getBoundingClientRect().width : 'set elsewhere'}`);
        if (math) {
            // SHADOW_ELEMENT_NAME is in doc as opposed to being wrapped around 'math' programmatically 
            addDepthInfo(math);
            setShadowRootContents(this, math);
        }
        resizeObserver.observe(this);
    }
});

{
    let UAStyle = document.createElement('style');
    UAStyle.innerHTML = `
           math-with-linebreaks {
                display: block;
            }
    `;
    document.head.insertBefore(UAStyle, document.head.firstElementChild);
}

/***
 * Make href work on all MathML elements by adding click, mouseover,
 * and mouseout events
***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/* See the file ../LICENSE.txt for the LICENSE of this file. */



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
};


 _MathTransforms.add('math *[href]', transformHref);

/* See the file ../LICENSE.txt for the LICENSE of this file. */

const mathmlPolyfillsLoad = function() {
  const runTransformsOnPageLoad =
    typeof (window.doNotRunTransformsOnPageLoad) === "undefined" ? true : window.doNotRunTransformsOnPageLoad;
  if (runTransformsOnPageLoad) {
    console.log("Running MathML polyfills.");
    for (let m of document.querySelectorAll("math")) {
      _MathTransforms.transform(m);
    }
  }
};
if (document.readyState === "loading") {
  window.addEventListener('DOMContentLoaded', mathmlPolyfillsLoad);
} else {
  mathmlPolyfillsLoad();
}

export { _MathTransforms as default };
