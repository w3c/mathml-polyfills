# mfenced polyfill

This repository contains a polyfill for the MathML [elementary math elements: mstack, msgroup, msrow, msline, mscarries, mscarry, and mlongdiv](https://mathml-refresh.github.io/mathml/#elementary-math).

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

At page load, all of the above elements will be converted into their equivalent
expanded form. A function window.expandMathMLElemMath is also defined and
can be used to execute this conversion again later.

Note: this implementation is currently at the V0.5 stage and likely needs to be debugged. 'index.html' is a large (manual inspection) test suite.
