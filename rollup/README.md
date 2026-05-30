# MathML Polyfills Packages

The numerous MathML polyfills can be used as one standard tool that processes all MathML elements 
so that they become MathML-core compatible. This is done by the functions referenced from
`_MathMLTransforms` at load time and any time the scripts ask.

## Building the bundles

Go to the `rollup` folder and invoke: `npm install` then invoke `npm run build`.

Or, if you have installed rollup globally, you can invoke `./rollup-polyfills`.

This will create the files `allpolyfillsbundle-module.js` and `allpolyfillsbundle-script.js` 
in this directory.

## Tests

The packaging in all forms is tested in the folder `test-rollupwraps`.

## Use as a script element

You can copy the file `allpolyfillsbundle-script.js` to your `js` directory and 
use the MathML polyfills in HTML with an element such as `<script src="js/allpolyfillsbundle-script.js"></script>`.

## Use a ES6 module

In a script of type module (supported in all current browsers) you can use MathML polyfills with
`import {_MathTransforms} from "./allpolyfillsbundle-module.js"`.

## Use an NPM package

The following method is temporary until we deploy an NPM package.
In this directory (`rollup`) run `npm run link` which will store temporarily the folder as an npm package 
to be integrated in other places.

Then from the directory you want to integrate it, assuming it has a `package.json`, run `npm run link mathml-polyfills`.
You can now refer to the MathML polyfills with the following import
`import {_MathTransforms} from "mathml-polyfills"`
