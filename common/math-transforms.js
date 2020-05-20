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
           the gnarliest of potentialnesting
           issues, I think
        */
          matches.reverse().forEach(el => {
            el.setAttribute("data-math-transformed", "");
            let copy = el.cloneNode(true);
            let transformed = transformer(copy);
  
            recurse = true;
            el.replaceWith(transformed || copy);
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

