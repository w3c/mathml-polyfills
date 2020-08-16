// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */

/*
    A really basic implementation, this will be a module.
 */
  export const _MathTransforms = {
    _plugins: new Map(),
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

    add: (selector, cb) => {
      _MathTransforms._plugins.set(selector, cb);
    }
  };


/**
 * Same as cloneNode(true) except that shadow roots are copied
 * If you are using the transforms and you need to clone a node that potentially has a shadowRoot, use this so the shadowRoot is copied
 * As of July, 2020, Elementary Math and Linebreaking transforms both have shadowRoots. 
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
      clone.attachShadow({ mode: "open" });
      for (let i = 0; i < el.shadowRoot.childElementCount; i++) {
        clone.shadowRoot.appendChild( cloneElementWithShadowRoot(el.shadowRoot.children[i]) )
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
export function convertToPx(element, length) {
  // quick check to see if we have common case of 'px'
  if (/px/.test(length)) {
      return parseFloat(length);
  }

  // add a temp element with desired length; set it as the width; record the width, then delete the temp element.
  // In Safari (Aug 2020), unknown elements in MathML are thrown out, so adding a 'div' results in 0 width. For some reason, 'img' is ok.
  let temp = document.createElement("img");  // create temporary element
  temp.style.overflow = "hidden";
  temp.style.visibility = "hidden";
  temp.style.width = length;
  element.appendChild(temp);
  const result = temp.getBoundingClientRect().width;
  temp.remove();

  return result;
}

