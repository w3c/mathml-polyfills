# mfenced polyfill

This repository contains a small polyfill for the MathML
[mfenced element](https://w3c.github.io/mathml/chapter3.html#presm.mfenced).
In order to use it, just load the mfenced.js script:

    <html>
      <head>
        ...
        <script src="mfenced.js"></script>
        ...
      </head>
      ...
    </html>

At page load, all the mfenced elements will be converted into their equivalent
expanded form. A function window.expandMathMLFencedElements is also defined and
can be used to execute this conversion again later.
