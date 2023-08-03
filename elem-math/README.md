# elementary math polyfill (mstack, mlongdiv)

This repository contains a polyfill for the MathML [elementary math elements: mstack, msgroup, msrow, msline, mscarries, mscarry, and mlongdiv](https://w3c.github.io/mathml/#elementary-math).

In order to use it, just load the elem-math.js script and related CSS file:

    <html>
      <head>
        ...
        <link rel="stylesheet" type="text/css" href="elemMath.css">
        <script src="elem-math.js"></script>
        ...
      </head>
      ...
    </html>

Note: this file makes use '../common/math-polys-core.js'.

On page load, all of the above elements will be converted into their equivalent
expanded form.

The current code is experimenting with different ways to integrate math into the page. The MathML elements can not be shadowed (as per HTML5). The current iteration of the code provides two options that minimally change the DOM:
1. include the elementary math inside of a custom element `elementary-math`
2. use MathML -- in this case, the code adds a `span` above the `math` element and attach a shadow root to that. This is a paradigm that if all the other polyfills adopted, would mean that a single (shared) `span` is the only modification to the DOM that the polyfills would make.

Note: this implementation is currently at the V0.5 stage and likely needs more debugging. 'index.html' is a large (manual inspection) test suite. You can [view the test suite on github.io](https://w3c.github.io/mathml-polyfills/elem-math/)
