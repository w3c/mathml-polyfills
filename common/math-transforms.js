/*
    A really basic implementation, this'll be a module..
    Just skip this code block, picks back up at the next
    on line 87
    */
  export const _MathTransforms = {
    _plugins: new Map(),
    _depth: 0,
    transform: root => {
      let recurse = false;
      for (const selector of _MathTransforms._plugins.keys()) {
        let transformer = _MathTransforms._plugins.get(selector);

        // find the matching elements..
        // this is problematic since you could add some

        let matches = Array.from(root.querySelectorAll(selector)).filter(
          el => !el.hasAttribute("data-math-transformed")
        );

          /*
           Since these are in tree-order,
           if we process them
           in reverse order we should side-step
           the gnarliest of potential nesting
           issues, I think
        */
          matches.reverse().forEach(el => {
            const nextChild = el.nextSibling;
            const parent = el.parentElement;
            let transformed = transformer(el);
            if (transformed && transformed !== el) {
              transformed.setAttribute("data-math-transformed", "");
              if (el.parentElement === parent) {
                parent.removeChild(el);
              }
              parent.insertBefore(transformed, nextChild);
            }
          });
      }

      // recurse, in case transforms add things that need
      // transforming?
      if (recurse && _MathTransforms._depth < 100) {
        _MathTransforms._depth++;
        _MathTransforms.transform(root);
      }
    },

    add: (selector, cb) => {
      _MathTransforms._plugins.set(selector, cb);
    }
  };

