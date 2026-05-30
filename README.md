# MathML polyfills

[This repository](https://github.com/w3c/mathml-polyfills/) contains polyfills for features from the
[MathML specification](https://w3c.github.io/mathml/), relying only
on [MathML Core](https://w3c.github.io/mathml-core/) and other
web technologies natively implemented in browsers.
See discussion on [wiki](https://github.com/w3c/mathml-polyfills/wiki/MathML-Polyfill-Task-Force-Guidelines)

## Packages to use in your project

The set of polyfills, as referenced by [all-polyfills.js](all-polyfills.js) can be used as a simple script element in HTML pages, as module for ES6 or as an NPM package.
See [README in rollup](rollup/).

## Test pages

* [acid-test.html](https://w3c.github.io/mathml-polyfills/acid-test.html) — combined examples at the repository root for many polyfills (button to apply transforms); includes an [`mtable`](https://w3c.github.io/mathml-polyfills/acid-test.html#mtable) section
* [bevelled/index.html](https://w3c.github.io/mathml-polyfills/bevelled/index.html) — `bevelled` attribute on `mfrac`
* [elem-math/index.html](https://w3c.github.io/mathml-polyfills/elem-math/index.html) — elementary math (`mstack`, `mlongdiv`, etc.)
* [href/index.html](https://w3c.github.io/mathml-polyfills/href/index.html) — `href` on MathML elements
* [mathvariant/index.html](https://w3c.github.io/mathml-polyfills/mathvariant/index.html) — `mathvariant` → Unicode math alphanumerics
* [menclose/index.html](https://w3c.github.io/mathml-polyfills/menclose/index.html) — `menclose` notations
* [mfenced/index.html](https://w3c.github.io/mathml-polyfills/mfenced/index.html) — `mfenced`
* [mtable/index.html](https://w3c.github.io/mathml-polyfills/mtable/index.html) — `mtable` presentation attributes and [`mlabeledtr`](https://w3c.github.io/mathml-polyfills/mtable/index.html#mlabeledtr)
* [ms/index.html](https://w3c.github.io/mathml-polyfills/ms/index.html) — `ms` quotes
* [namedspace/index.html](https://w3c.github.io/mathml-polyfills/namedspace/index.html) — named MathML spaces
* [scriptshift/index.html](https://w3c.github.io/mathml-polyfills/scriptshift/index.html) — `subscriptshift` / `superscriptshift` on `msub`, `msup`, `msubsup`
* [semantics/index.html](https://w3c.github.io/mathml-polyfills/semantics/index.html) — `semantics` presentation order
* [table/index.html](https://w3c.github.io/mathml-polyfills/table/index.html) — `mtable` presentation attributes inside HTML `<table>` cells (before / after transform)
-----



[Source Repository](https://github.com/w3c/mathml-polyfills)
