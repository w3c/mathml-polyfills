# MathML Polyfills Packages

The numerous MathML polyfills can be used as one standard tool that processes all MathML elements 
so that they become MathML-core compatible. This is done by the functions referenced from
`_MathMLTransforms` at load time and any time the scripts ask.

By default, the script or module processes all `math` elements in the web-page after the load. 
Should you want to disable this, define before the inclusion or imports,
`window.doNotRunTransformsOnPageLoad = true`.

## Building the bundles

The repository carries the latest results of the build since we last ran it. So you can just use that first.

Building again:

- Go to the `rollup` folder and invoke: `npm install` then invoke `npm run build`.
- Or, if you have installed rollup globally, you can invoke `./rollup-polyfills`.

This will create the files `allpolyfillsbundle-module.js` and `allpolyfillsbundle-script.js` 
in this directory.

## Tests

The packaging in all forms is tested in the folder [`test-rollup-wraps`](test-rollup-wraps).

You can test `test-es-import.html` and `test-script-embed.html` by serving from
this directory (`rollup`).
You can test a webpack-based import by running `npm run build` then serving the `dist` directory.

## Use as a script element

You can copy the file `allpolyfillsbundle-script.js` to your `js` directory and 
use the MathML polyfills in HTML with an element such as: 

`<script src="js/allpolyfillsbundle-script.js"></script>`

For those who want to avoid copying, you can use the github-pages version

`<script src="https://w3c.github.io/mathml-polyfills/rollup/allpolyfillsbundle-script.js"></script>`

But note that the gains in performance or security may not be as you expect (see [this page](https://httptoolkit.com/blog/public-cdn-risks/) for more).

## Use an ES6 module

In a script of type module (supported in all current browsers) you can use MathML polyfills with
`import _MathTransforms from "./allpolyfillsbundle-module.js"`.

## Use an NPM package

Add the `mathml-polyfills` package to your dependencies: From your project,  run: 

`npm install --save mathml-polyfills`

You can now refer to the MathML polyfills with the following import:

`import _MathTransforms from "mathml-polyfills";`

Once one of the import methods has been used you can use the `_MathTransforms` object:

- to invoke `_MathTransform.transform` on freshly appeared `math` elements
- to invoke `_MathTransform._createStylesheet` to create the stylesheet to be included
- ... to use the `_MathTransform.plugins` to operate single transformations
