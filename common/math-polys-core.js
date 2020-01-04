let config = { childList: true, subtree: true };
let ops = {}

// Create an observer instance linked to the callback function
let mathObserver = new MutationObserver((mutationsList, observer) => {
  let selectors = Object.keys(ops)
    for(let mutation of mutationsList) {
      selectors.forEach((selector) => {
        if (mutation.target.matches(selector)) {
          ops[selector](mutation.target)
        }
      })
    }
});

// Start observing the target node for configured mutations
mathObserver.observe(document.body, config);

export const poly = {
  define: (selector, cb) => {
    ops[selector] = cb
    
    // upgrade pre-existing
    document
      .body
      .querySelectorAll(selector)
      .forEach(cb)
  
  }
}