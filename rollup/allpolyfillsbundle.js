var allpolyfillsbundle = (function (exports) {
  'use strict';

  // @ts-check
  /* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
  /* vim: set ts=4 et sw=4 tw=80: */


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
  /*
    Copyright (c) 2016-2019 Igalia S.L.

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


  const namespaceURI$1 = "http://www.w3.org/1998/Math/MathML";

  function collapseWhiteSpace$1(text) {
      // Collapse the whitespace as specified by the MathML specification.
      // https://w3c.github.io/mathml/chapter2.html#fund.collapse
      return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
  }

  function newOperator(text, separator) {
      // Create <mo fence="true">text</mo> or <mo separator="true">text</mo>.
      let operator = document.createElementNS(namespaceURI$1, "mo");
      operator.appendChild(document.createTextNode(text));
      operator.setAttribute("fence", "true");
      return operator;
  }

  function newMrow() {
      // Create an empty <mrow>.
      return document.createElementNS(namespaceURI$1, "mrow");
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
   * Handles the "beveled" attribute on mfrac
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


  /**
   * 
   * @param {HTMLElement} mfrac 
   */
  const transformBevelled = (mfrac) => {
      // Return an <mrow> element representing the bevelled fraction.
      // The numerator is shifted up 0.5em

      // we can't know the height of the "/" without inserting it first, but the num/denom are known
      // get an approximation of the height -- do before remove child from mfrac
      let numeratorHeight = mfrac.firstElementChild.getBoundingClientRect().height;
      let shiftAmount = convertToPx(mfrac.firstElementChild, "0.5em");
      let height = Math.max(numeratorHeight, mfrac.lastElementChild.getBoundingClientRect().height) + shiftAmount;

      let mrow = document.createElementNS(MATHML_NS, "mrow");

      // create the numerator
      let mpadded = document.createElementNS(MATHML_NS, "mpadded");
      mpadded.setAttribute("height", `${numeratorHeight + shiftAmount}px`); // relative shift not in core
      mpadded.setAttribute("voffset", `${shiftAmount}px`);
      mpadded.appendChild(mfrac.firstElementChild);
      mrow.appendChild(mpadded);

      // add the "/"
      let slash = document.createElementNS(MATHML_NS, "mo");
      slash.setAttribute("stretchy", "true");
      slash.setAttribute("symmetric", "false");
      slash.setAttribute("lspace", "0px");
      slash.setAttribute("rspace", "0px");
      // slash.setAttribute("maxsize", `${Math.round(0.95 * height)}px`);

      // tuck the num and demon in a little -- base the amount on height
      let inset = Math.round(-0.2 * height);
      slash.setAttribute("style", `margin-left: ${inset}px; margin-right: ${inset}px`); 
      slash.appendChild(document.createTextNode('/'));
      mrow.appendChild(slash);

      // add the denominator
      mrow.appendChild(mfrac.lastElementChild);
      return mrow;
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
   * Handles mathsize values "small", "normal", and "big"
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
        lookingForMathElement = (element.tagName !== 'math');
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
        const rectWidth = convertToPx(el, '.7em');
        const rectHeight = rect.height;
        wordMRow.style.width = `${Math.sqrt(rectWidth * rectWidth + rectHeight * rectHeight)}px`;    // hypotenuse
        wordMRow.style.transform = `rotate(${word === 'phasoranglertl' ? '' : '-'}${Math.atan(rectHeight / rectWidth)}rad) translateY(0.067em)`;
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

    mencloseMRow.setAttribute('style', mencloseStyle);
    return mencloseMRow;
  };

  _MathTransforms.add('menclose', transformMEnclose, MENCLOSE_CSS);

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
   * Handles lqoute and rquote attrs on ms
   ***/
  // @ts-check
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



  /**
   * 
   * @param {string} text 
   */
  function collapseWhiteSpace(text) {
      // Collapse the whitespace as specified by the MathML specification.
      // https://w3c.github.io/mathml/chapter2.html#fund.collapse
      return text.replace(/^[\s]+|[\s]+$/g, '').replace(/[\s]+/g, ' ');
  }

  /**
   * @param {HTMLElement} ms
   */
  const transformMs = (ms) => {
      // Ideally, we would attach a shadow root to <ms> and put the result in there, but that's not legal (now)
      // Instead, we just move the lquote/rquote attrs into the ms and change the DOM.
      // If lquote or rquote appear in the string contents, they should be escaped.
      const lquote = ms.getAttribute('lquote') || '"';
      const rquote = ms.getAttribute('rquote') || '"';
      let content = collapseWhiteSpace(ms.textContent);
      content = content.replace(lquote,'\\'+lquote);
      if (rquote !== lquote) {
          content = content.replace(rquote,'\\'+rquote);
      }
      ms.textContent = lquote + content + rquote;
      return 
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


  /**
   * @param {HTMLElement} mpadded
   * @returns {{width:number, height: number: depth: number}}
   */
  function getDimensions(mpadded) {
      // Create an mrow around the children of 'mpadded' and add a zero height/depth mspace to them.
      // the y/top/bottom of the mspace is the baseline, so we can find height/depth of el
      // undo the changes to the DOM and return the values
      // Note: the mspace should not cause reflow, so the change/undo hopefully is somewhat efficient
      const mrow = document.createElementNS(MATHML_NS, 'mrow');
      mrow.appendChild( document.createElementNS(MATHML_NS, 'mspace') );
      const cloneMpadded = cloneElementWithShadowRoot(mpadded);
      for (let i = 0; i < cloneMpadded.children.length; i++) {
          mrow.appendChild(cloneMpadded.children[i]);    // removed from clone and added to mrow
      }
      cloneMpadded.appendChild(mrow);
      mpadded.parentElement.replaceChild(cloneMpadded, mpadded);      // should not be reflow

      const mspaceRect = mrow.firstElementChild.getBoundingClientRect();
      const mpaddedRect = mrow.getBoundingClientRect();

      cloneMpadded.parentElement.replaceChild(mpadded, cloneMpadded);      // restore original structure; should not reflow
      return {
          width: mpaddedRect.width,
          height: mspaceRect.y - mpaddedRect.top,
          depth: mpaddedRect.bottom - mspaceRect.y
      };
  }
  /**
   * @param {HTMLElement} el
   * @param {string} attr
   * @param {'width'|'height'|'depth'} dimension
   * @param {{width:number, height: number: depth: number}} dimensions
   * @returns {boolean}
   */
  function replacePseudoAttr(el, attr, dimension, dimensions) {
      const attrValue = el.getAttribute(attr).toLowerCase();
      if (attrValue.includes(dimension)) {
          const floatVal = parseFloat(attrValue) * dimensions[dimension] / (attrValue.includes('%') ? 100.0 : 1.0);
          el.setAttribute(attr, floatVal.toFixed(1) + 'px');
          return true;
      }
      return false;
  }

  /**
   * @param {HTMLElement} el
   * @param {attr} align
   * @param {{width:number, height: number: depth: number}} dimensions
   * @returns {boolean}       // true if handled
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
      const dimensions = getDimensions(el);       // do this before changing the attr values

      handleAttr(el, 'width', dimensions);
      handleAttr(el, 'height', dimensions);
      handleAttr(el, 'depth', dimensions);
      handleAttr(el, 'lspace', dimensions);
      handleAttr(el, 'voffset', dimensions);
      return el;
  };

  _MathTransforms.add('mpadded', transformMpadded);

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


  const namespaceURI = "http://www.w3.org/1998/Math/MathML";

  /**
   * 
   * @param {HTMLElement} mtable 
   */
  function makeTableSquare(mtable) {
    // FIX: implement -- need to handle spanning cols
    return mtable;
  }

  /**
   * 
   * @param {HTMLElement} mtable 
   */
  function handleLabeledRows(mtable) {
    // assumes table is square

    // first check to see if there is a 'mlabeledtr'
    if (mtable.getElementsByTagName('mlabeledtr').length === 0) {
      return mtable;
    }

    const side = mtable.getAttribute('side') || 'right';
    let emptyColumnEntry = document.createElementNS(namespaceURI, "mtd");
    emptyColumnEntry.setAttribute('intent', ':no-equation-label');

    for (let i=0; i < mtable.children.length; i++) {
      let row = mtable.children[i];

      if (row.tagName === 'mlabeledtr') {
        // move the label to the left or right side of a new "mtr" (instead of "mlabeledtr")
        let label = row.firstElementChild;
        addIntent(label);
        let newRow = document.createElementNS(namespaceURI, "mtr");
        for (const attr of row.attributes) {
          newRow.setAttribute(attr.name, attr.value);
        }
        // leave the label as the first element or move it to the right (last element)
        let mtd = row.children[side=='left' ? 0 : 1];
        newRow.appendChild(mtd);
        while (row.children.length > 0) {
          newRow.appendChild(row.firstChild); // note: this removes the first child from 'row'
        }
        if (side === 'right') {
          newRow.appendChild(label);
        }
        row.replaceWith(newRow);
      } else {
        // add an empty "mtd" to the left or right side of the row
        const newColEntry = emptyColumnEntry.cloneNode();
        if (side === 'right') {
          row.appendChild(newColEntry);
        } else {
          row.insertBefore(newColEntry, row.firstElementChild);
        }
      }
    }

    return mtable;
  }

  /**
   * 
   * @param {HTMLElement} mtd 
   */
  function addIntent(mtd){
    // Add an intent the intent property ':equation-label' to the to the mtd element.
    // We need to be careful because there already might be an intent set on it.
    // The intent might look like "foo", ":xxx", "foo:bar($arg)", "foo($arg:equation-label)", etc.
    if (!mtd.hasAttribute('intent')) {
      mtd.setAttribute('intent', ':equation-label');
      return;
    }
    let intentValue = mtd.getAttribute('intent');
    let iOpenParen = intentValue.indexOf('(');
    let head = iOpenParen == -1 ? intentValue : intentValue.substring(0, iOpenParen);
    if (head.includes(':equation-label')) {
      // already has the equation-label intent, so do nothing
      return;
    }
    intentValue = head + ':equation-label' + intentValue.substring(head.length);
    mtd.setAttribute('intent', intentValue);
  }

  /**
   * 
   * @param {HTMLElement} mtable 
   */
  const transformMtable = (mtable) => {
    // Change the table by adding a column to it, with 'el' placed in it.
    // el is replaced with a 'mtr', which is what is returned.

    let newTable = makeTableSquare(cloneElementWithShadowRoot(mtable));
    handleLabeledRows(newTable);

    // FIX: handle attrs
    return newTable;
  };

  _MathTransforms.add('mtable', transformMtable);

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


  const ELEM_MATH_CSS = `
table.elem-math {
    border-collapse: collapse;
    border-spacing: 0px;
}
table.elem-math tr {
    vertical-align: baseline;
}

td.curved-line {
    position: absolute;
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

mtd.precedes-separator {
    padding-right: 0 !important;    /* override an inline style */
}

mtd.separator {
    padding-left: 0  !important;    /* override an inline style */
    padding-right: 0 !important;    /* override an inline style */
}

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

  // msline defined values
  const MSLINETHICKNESS_THIN = '.1ex';
  const MSLINETHICKNESS_MEDIUM = '.35ex';
  const MSLINETHICKNESS_THICK = '.65ex';

  // mstack defined charspacing values
  const MSTACK_TIGHT = '0em';
  const MSTACK_MEDIUM = '.2em';
  const MSTACK_LOOSE = '.4em';

  const NON_BREAKING_SPACE = '\u00A0';
  const NO_SPACE = '\u200A';  // hair space (need something that is a char for use in carries)

  class MathMLAttrs {
      /**
       * Call the constructor when an mstyle is found
       * @param {Element} el
       * @param {Object} [previousAttrs=null] 
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
                  // Override any attr that is already present
                  for (let attr of el.attributes) {
                      this.attrs[attr.name] = attr.value;
                  }
              }
          }
      }

      /**
       * Add an attr of 'el' if it isn't already present in 'this.attrs' (helper fn for the constructor)
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
       * 
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

  class Carry {
      /**
       * 
       * @param {string} location 
       * @param {string} crossout 
       * @param {number} scriptsizemultiplier
       */
      constructor(location, crossout, scriptsizemultiplier) {
          this.location = location;
          this.crossout = crossout;
          this.scriptsizemultiplier = scriptsizemultiplier;
      }
  }

  class TableCell {
       // Holds data to construct the actual <td>
  	/**
  	 * @param {string | Element} [value]             // contents (digit) of the cell
       * @param {string} [style='']                   // style info for the cell
  	 * @param {Carry} [carry=null]                  // a single carry
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
              this.data = document.createTextNode(value);
          }
          this.carry = carry;                        // for multiple carries, 'data' is already built up -- value is last carry seen
          this.style = style || '';
      }
  }

  class TableRow {
        // Holds data to construct the actual <tr>
  	/**
  	 * @param {TableCell[]} data                 // all cells in the row
  	 * @param {number} [digitsOnRight]           // # of digits to the right of '.' (includes '.') (can be negative due to shift)
  	 * @param {number} [shift]                   // # amount of shift (position) -- need to track because of underlines
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
          this.addSpacingAfterRow = false;    // want to add a little spacing later on
          this.alignAt = 0;                 // no alignment needed (-1 is last line; 1 is first line)
      }

      /**
       * @param {string} lineUnderThickness
       * @param {string} color
       */
      addUnderline(lineUnderThickness, color) {
          this.style += `border-bottom: ${lineUnderThickness} solid ${color};`;
          this.addSpacingAfterRow = true;
      }

      /**
       * 
       * @param {number} shift 
       * @param {number} length 
       * @param {string} thickness 
       * @param {string} color
       */
      addUnderlineToCells(shift, length, thickness, color) {
          // the underlines should act independently of the previous line
          // however, to do the underline, we need to attach them as borders to the above the cells

          // pad previous row on left/right if needed
          // note: order of padding is important so that 'right' is correct)
          // note: we create new TableCells because we will modify it by adding an underline
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

          // now add the underlines
          for (let i = right - length; i < right; i++) {
              this.data[i].style += `border-bottom: ${thickness} solid ${color};`;
          }
          this.addSpacingAfterRow = true;
      }

      // two helper functions that adds padding to the left or right side of an array
      /**
       * 
       * @param {TableCell[]} arr 
       * @param {number} amount
       * @returns TableCell[]
       */
      padOnLeft(arr, amount) {
          let newCells = Array(amount);
          for (let i = 0; i < amount; i++) {
              newCells[i] = new TableCell(NO_SPACE);
          }
          return newCells.concat(arr);
      }
      
      /**
       * 
       * @param {TableCell[]} arr 
       * @param {number} amount 
       * @returns TableCell[]
       */
      padOnRight(arr, amount) {
          let newCells = Array(amount);
          for (let i = 0; i < amount; i++) {
              newCells[i] = new TableCell(NO_SPACE);
          }
          return arr.concat(newCells);
       }
  }


  class ElemMath {
  	/** 
       * mstack and mlondiv
       * Note: we do *not* store the rows of the stack in here because (potentially) mlongdiv has its own stack for divisor/result
       *   Instead, we pass the rows as arguments to the various methods
       * 
  	 * @param {Element} mstackOrLongDiv
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
          this.align = this.getAttr(mstackOrLongDiv,'algin', 'baseline');
      }

      /**
       * 
       * @param {Element} el 
       * @param {string} name 
       * @param {string} defaultVal 
       * @returns {string}
       */
      getAttr(el, name, defaultVal) {
          return this.attrs.getAttr(el, name, defaultVal);
      }
      
      /**
       * Add another row to the stack.
       * If the last row is a row of carries, then this row is merged with them so there is no new row
       * If this row is a row of carries also, then the merging is done differently 
       * @param {TableRow[]} rows
       * @param {TableRow} newRow 
       */
      add(rows, newRow) {
          /**
           * 
           * @param {TableCell} cell 
           * @param {string} crossoutStyle 
           * @returns {TableCell}  (updated cell)
           */
          function addCrossoutToData(cell, crossoutStyle) {
              // some crossouts are handled with :before or :after
              // since there can only be one of these, we create a nested span for each crossout 
              const crossouts = crossoutStyle.split(' ');
              let result = cell.data;
              crossouts.forEach( function(crossout) {
                  if (crossout === 'none' || crossout==='') { // '' -- happens when there are two or more spaces in a row
                      return;    // nothing to do
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
                          span.className = 'crossout-up';         // do something  
                          console.log(`Unknown crossout type '${crossoutStyle}`);
                          break;               
                  }
                  result = span;
              } );
              cell.data = result;
              return cell;
          }
          /**
           * 
           * @param {TableCell} cell 
           * @param {TableCell} previousCell 
           * @returns {TableCell}  (updated data)
           */
          function mergeCarryAndData(cell, previousCell) {
              let data = cell.data;
              if (data.textContent === NO_SPACE) {
                  let span = document.createElement('span');
                  span.appendChild(data);
                  data.textContent = '0';      // need digit width to get decent spacing/placement of the carry
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

          // if the previous row is a carry row, then the non "fill" spots will have a carry -- just need to find one
          if (rows.length === 0 ||
              !previousRow.data.find( cell => cell.carry )) {
              rows.push(newRow);    // "normal" row -- just add it
              return;
          }

          // have to merge the rows
          // first make them the same size, padding on left/right if needed
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
              } else {
                  previousRow.data = previousRow.padOnRight(previousRow.data, extraToAddOnRight);
              }
          }

          // merge the data now that the rows have the same number of elements
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
          rows[rows.length - 1] = newRow;      // replace the carry row with the current row
      }

      /**
       * 
       * @param {Element} msrow 
       * @returns {[TableCell[], number]}  
       */
      process_msrow(msrow) {
          // The spec doesn't say how to determine decimal alignment in an msrow
          // Here, we take the first 'mn' we find to be the determination of a '.'.
          // Anything after the 'mn' is considered to be to the right of the '.'
          let foundNumber = false;
          let nDigitsRightOfDecimalPt = 0;
          //** @type {TableCell[]}  */
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
       * 
       * @param {Element} row 
       * @param {string} location 
       * @param {string} crossout 
       * @param {number} scriptsizemultiplier
       * @returns {TableCell[]}
       */
      process_mscarries(row, location, crossout, scriptsizemultiplier) {
          let cells = [];
          let child = row.children[0];
          // children are pulled out of the row and put in the TableCell, so we can't use a standard 'for' loop
          while (child) {
              let nextChild = child.nextElementSibling;       // do this before child is modified
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
  	 * @param {Element} node
       * @param {TableRow[]} rows
  	 * @param {number} position
  	 * @param {number} [rowShift=0]
       * @returns {TableRow[]}
  	 */
      processChildren(node, rows, position, rowShift) {
          if (!node.children) {
              return rows;
          }
          rowShift = rowShift || 0;
          
          // Note: we only want to compute a decimal position (which is an align point) when stackAlign==='decimalpoint'; otherwise alignment will be off
          for (let i= (node.tagName.toLowerCase() === 'mlongdiv' ? 2 : 0); i<node.children.length; i++) {
              rows = this.processChild(node.children[i], rows, position);
              position += rowShift;           // non-zero when specified by msgroup; applies to 2nd and subsequent rows
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
       * 
       * @param {TableRow[]} rows
       * @param {string} stackAlign
       * @returns {TableRow[]}
       */
      processShifts(rows, stackAlign) {
          let maxLeftOfDecimalPt = 0;
          let maxRightOfDecimalPt = 0;      // only used when doing decimal alignment

          // we want to fill out all the entries in each row
          // when doing decimal alignment, we need to keep track of int and fractional part
          // first, compute the max digits across all the rows
          for (const row of rows) {
              if (stackAlign === 'decimalpoint') {
                  maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length - row.nRight);
                  maxRightOfDecimalPt = Math.max(maxRightOfDecimalPt, row.nRight);               
              } else {
                  maxLeftOfDecimalPt = Math.max(maxLeftOfDecimalPt, row.data.length);
              }
          }

          // now pad each row
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
                      row.data = row.padOnLeft(row.data, padding - padding/2);  // remainder after half fill above
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
       * 
       * @param {Element} divisor 
       * @param {Element} result 
       * @param {TableRow[]} stackRows
       * @returns {TableRow[]}
       */
      addOnLongDivParts(divisor, result, stackRows) {
          /**
           * @param {TableRow} row 
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
           * @param {number} nKeep    // number of padded cells to keep (if not enough cells, appropriate # is added)
           * @returns {TableRow}
           */
          function removePaddingOnRight(row, nKeep) {
              let nDeletedRight = 0;

              // delete empty cells from end
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

              // add on any needed cells
              for (let i=0; i<nKeep; i++) {
                  row.data.push( new TableCell(NO_SPACE) );
              }

              row.nRight -= nDeletedRight - nKeep;
              return row;
          }

          const mathcolor = this.getAttr(this.stack, 'mathcolor', 'black');

          // Note: we assure there are divisors, results and at least one row in the stack for layout by creating dummy entries if needed.
          //   For a few styles, a second row is needed -- those are handled in those cases.

          if (stackRows.length == 0) {
              stackRows.push( new TableRow( [new TableCell(NO_SPACE)], 0, 0 ) );
          }

          // FIX: this is broken for anything that is more than one row tall.
          /** @type{TableRow[]} */
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

                  // First, add a row of padding on right and put a line down the right side of them
                  if (this.longdivstyle !== 'stackedrightright') {
                      // want to suck these lines in -- find out how much padding there is on each line and remove some
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

                  // Attach the divisor to the first line (note: the divisor and result are *not* decimal aligned)
                  const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                  if (nCellsLargerResultThanDivisor > 0) {
                      divisorRow.data = divisorRow.padOnRight(divisorRow.data, nCellsLargerResultThanDivisor);
                  }
                  divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                  divisorRow.addSpacingAfterRow = false;
                  stackRows[0].data = stackRows[0].data.concat(divisorRow.data);
                  stackRows[0].nRight += divisorRow.data.length;

                  // Attach the result to the second line
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

                  // Add some padding on the right to the divisor and result to separate them from the line
                  divisorRow.data[divisorRow.data.length-1].style += 'padding-right: 0.5em;';
                  resultRow.data[resultRow.data.length-1].style += 'padding-right: 0.5em;';

                  // Attach the divisor to the first line (note: the divisor and result are *not* decimal aligned)
                  const nCellsLargerResultThanDivisor = resultRow.data.length - divisorRow.data.length;
                  if (nCellsLargerResultThanDivisor > 0) {
                      divisorRow.data = divisorRow.padOnLeft(divisorRow.data, nCellsLargerResultThanDivisor);
                  }
                  divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                  divisorRow.addSpacingAfterRow = false;
                      stackRows[0].data = divisorRow.data.concat(stackRows[0].data);

                  // Attach the result to the second line
                  stackRows[1].data = resultRow.data.concat(stackRows[1].data);
                  break;
              }

              case 'righttop': {
                  // First, put the result on top with a line underneath
                  resultRow.addUnderline(MSLINETHICKNESS_MEDIUM, mathcolor);
                  resultRow.addSpacingAfterRow = false;        // don't want to add extra spacing
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
                  resultRow.addSpacingAfterRow = false;        // don't want to add extra spacing
                  let mergedRows = resultRows.concat(stackRows);
                  stackRows = this.processShifts(mergedRows, this.stackAlign);

                  if (this.longdivstyle === 'stackedleftlinetop') {
                      divisorRow.data[divisorRow.data.length-1].style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
                      divisorRow.data[divisorRow.data.length-1].style += `border-right: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;divisorRow.data[divisorRow.data.length-1].data.style += 'position:relative';
                      divisorRow.addUnderlineToCells(-divisorRow.nRight, divisorRow.data.length, MSLINETHICKNESS_MEDIUM, mathcolor);
                  } else {
                      // add the ")" to the element (handled like a curved border with css)
                      divisorRow.data = divisorRow.padOnRight(divisorRow.data, 1);
                      iLastDivisorDigit += 1;
                      
                      divisorRow.data[iLastDivisorDigit].class = 'curved-line';
                      divisorRow.data[iLastDivisorDigit].style = '';       // let CSS deal with it
                  }
                  stackRows[1].data = divisorRow.data.concat(stackRows[1].data);
                  break;
              }
          }
          let answer = this.processShifts(stackRows, this.stackAlign);
          if (this.longdivstyle === 'lefttop') {
              // extend the line to the left one cell to be above the added ')'
              stackRows[0].data[iLastDivisorDigit].style += `border-bottom: ${MSLINETHICKNESS_MEDIUM} solid ${mathcolor};`;
          }
          return answer;
      }
  	

      /**
       * Sets classes that shrink the padding on columns containing separators because it looks better
       * @param {TableRow[]} stackRows 
       * @returns nothing
       */
      shrinkSeparatorColumns(stackRows) {
          if (stackRows.length === 0) {
              return;
          }

          // scan each row for a separator (could be '' in some rows)
          // remove an the index from the set of separators if it is not a separator or an empty cell (if all empty cells, also delete)
          // if all the indices that are empty, don't count them -- could be a vertical line
          let separatorCols = new Set(Array(stackRows[0].data.length).keys());      // indices of the columns
          let allEmptyCells = new Set(Array(stackRows[0].data.length).keys());      // indices of columns that are completely empty
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

          // remove any remaining columns that are all empty cells
          allEmptyCells.forEach( i => separatorCols.delete(i));
          
          for (let iCol of separatorCols) {
              stackRows.forEach( row => {
                  row.data[iCol].class = "separator";
                  if (iCol > 0) {
                      row.data[iCol-1].class = "precedes-separator";
                  }
              });
          }
      }


      /**
       * @param {Element} el -- either mstack or mlongdiv (if later, first two children are divisor and result which can be <none/>)
       * @returns {Element} -- table equivalent to be inserted into DOM
       */
      expandMStackElement(el) {
          // Return a <table> element representing the expanded <mstack>.

          // Compute spacing and split it between the left and right side
          // Note: this pattern works for scientific notation (e.g., '-3.4e-2') because we only care about numeric part in front of 'e'
          let numberRegEx = /[-+]?\d*\.?\d*/g;
          const charSpacing = parseFloat(numberRegEx.exec(this.charSpacing)[0])/2.0 + this.charSpacing.slice(numberRegEx.lastIndex);
          this.charSpacing.slice(numberRegEx.lastIndex);
          const cellStyle = `padding: .1ex ${charSpacing} 0 ${charSpacing}; text-align: ${this.charAlign};`;

          /** @type {TableRow[]} */
          let stackRows = [];
          stackRows = this.processChildren(el, stackRows, 0, 0);
          stackRows = this.processShifts(stackRows, this.stackAlign);
          if (el.tagName.toLowerCase() === 'mlongdiv') {
              stackRows = this.addOnLongDivParts(el.children[0], el.children[1], stackRows);
          }

          // avoid adding an extra space after the last line
          if (stackRows.length > 0) {
              stackRows[stackRows.length-1].addSpacingAfterRow = false;
          }

          // set a class for columns of separators so that they are narrower (looks better)
          this.shrinkSeparatorColumns(stackRows);

          let table = document.createElement('table');
          table.setAttribute('class', 'elem-math');
          for (const row of stackRows) {
              let htmlRow = document.createElement('tr');
              if (row.style) {
                  htmlRow.setAttribute('style', row.style);
              }
              for (const cellData of row.data) {
                  let htmlTD = document.createElement('td');
                  if (cellData.alignAt) {
                      let span = document.createElement('span');
                      span.style.display = cellData.alignAt === 1 ? 'inline-table' : 'inline-block';
                      span.appendChild(cellData.data);
                      cellData.data = span;
                  }
                  if (cellData.class === 'curved-line') {
                      cellData.data.textContent = NON_BREAKING_SPACE;
                  }

                  htmlTD.appendChild(cellData.data);
                  if (cellData.class !== 'curved-line') {
                      htmlTD.setAttribute('style', cellStyle + cellData.style);    // cellData.style so it overrides
                  }
                  if (cellData.class) {
                      htmlTD.setAttribute('class', cellData.class);                           // could be undefined
                  }
                  htmlRow.appendChild(htmlTD);
              }
              table.appendChild(htmlRow);
              if (row.addSpacingAfterRow) {
                  // can't put a margin on a table row or push it into the table cells above, so we add a dummy row here
                  // we need to continue any left/right border from the previous line
                  let newRow = document.createElement('tr');
                  newRow.style.height = '.5ex';

                  for (const cellData of row.data) {
                      let newCell = document.createElement('td');
                      if (/(border-left|border-right)/.test(cellData.style)) {
                          // extract borders -- this assumes the code never uses 'border: 1 2 3 4;'
                          const borders = cellData.style.match(/(border-left|border-right).*?;/g);
                          newCell.setAttribute('style', borders);
                      }
                     newRow.appendChild(newCell); 
                  }                table.appendChild(newRow);
              }
          }

          return table;
      }
  }

  /**
   * @param {HTMLElement} el
   */
  let transformElemMath = (el) => {
      // Ideally, we would attach a shadow root to the <mstack> or <mlongdiv>, but that's not legal (now)
      // Instead, we wrap 'el' (the root of the elementary) with "<mtext><span><math> el <math></span></mtext>".
      // The span can serve as the shadow root.
      // [current transformer makes a clone, so can't do this] As an optimization (likely very common), if the parent of 'el' is 'math', we more directly add a <span> around the 'math'.
      // Very ugly, but at least the DOM doesn't have the ugly table in it.
      // This seems like the least disruptive change to the original structure.

      // hack to allow definition of custom element "m-elem-math" to also work with 'transformElemMath()'
      if (el.parentElement && (el.parentElement.tagName === 'M-ELEM-MATH' ||
                              (el.parentElement.parentElement && el.parentElement.parentElement.tagName === 'M-ELEM-MATH'))) {
          return;
      }

      // put the math with table into a shadow DOM
      const spanShadowHost =  document.createElement("span");
      let shadowRoot = spanShadowHost.attachShadow({mode: "open"});
      shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());

      // create the table equivalent and put it into the shadow DOM
      const elParent = el.parentElement;
      const nextSibling = el.nextElementSibling;
      const table = new ElemMath(el).expandMStackElement(el);
      spanShadowHost.shadowRoot.appendChild(table);

      // need to create <mtext> <span> <math> elem math </math> </span> </mtext>
      let mtext = document.createElementNS(MATHML_NS, "mtext");
      mtext.appendChild(spanShadowHost);                      // now have <mtext> <span> ...
      let math = document.createElementNS(MATHML_NS, "math");
      spanShadowHost.appendChild(math);                       // now have <mtext> <span> <math> ...
      math.appendChild(el);                   // make el a child of math -- clone because can't detach el from DOM
      elParent.insertBefore(mtext, nextSibling);

      return null;
  };

  _MathTransforms.add('mstack', transformElemMath, ELEM_MATH_CSS);
  _MathTransforms.add('mlongdiv', transformElemMath); // don't need two copies of the styles, ELEM_MATH_CSS not included

  // import {poly} from '../common/math-polys-core.js'
  // poly.define('mstack', transformElemMath)
  // poly.define('mlongdiv', transformElemMath)


  customElements.define('m-elem-math', class extends HTMLElement {
      constructor() {
          super();
          
          // create the table equivalent
          const  table = new ElemMath(this.children[0]).expandMStackElement(this.children[0]);
          
          // put the table into a shadow DOM
          const shadowRoot =  this.attachShadow({mode: 'open'});
          shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
          shadowRoot.appendChild(table);
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
  /*
    Copyright (c) 2025 David Carlisle

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



  /**
   * @param {MathMLElement} el 
   */
  const transformHref = (el) => {
      if (el.namespaceURI == MATHML_NS) {
      el.style.cursor="pointer";
      el.tabIndex=0;
      el.addEventListener("click", (event) => {
              document.location=event.currentTarget.getAttribute("href");
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

  exports._MathTransforms = _MathTransforms;

  return exports;

})({});
