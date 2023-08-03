# mfenced polyfill

This repository contains a small polyfill for the MathML
[ms element](https://w3c.github.io/mathml/#presm_ms). [In MathML Core](https://w3c.github.io/mathml-core/#string-literal-ms), the `lquote` and `rquote` attributes are not supported. Neither is escaping of the quotes. This small polyfill supports them by making them part of the string. The directionality is used to determine where they are placed (they should be more appropriately named 'open'/'close' quotes).
In order to use it, just load the ms.js script:

    <html>
      <head>
        ...
        <script src="ms.js"></script>
        ...
      </head>
      ...
    </html>

At page load, all the ms elements will be converted into their equivalent
expanded form.
