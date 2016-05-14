# mfenced polyfill

This repository contains a small polyfill for the MathML
[mfenced element](https://www.w3.org/TR/MathML/chapter3.html#presm.fenced).
In order to use it, just load the mfenced-min.js script:

    <html>
      <head>
        ...
        <script src="mfenced-min.js"></script>
        ...
      </head>
      ...
    </html>

At page load, all the mfenced elements will be converted into their equivalent
expanded form. A function window.expandMathMLFencedElements is also defined and
can be used to execute this conversion again later.
