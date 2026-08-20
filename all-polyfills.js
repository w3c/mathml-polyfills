/* See the file ../LICENSE.txt for the LICENSE of this file. */
import {_MathTransforms} from './common/math-transforms.js'
import './mglyph/mglyph.js'
import './mfenced/mfenced.js'
import './semantics/semantics.js'
import './bevelled/bevelled.js'
import './accent/accent.js'
import './horiz-align/horiz-align.js'
import './scriptshift/scriptshift.js'
import './mathsize/mathsize.js'
import './namedspace/namedspace.js'
import './menclose/menclose.js'
import './linethickness/linethickness.js'
import './ms/ms.js'
import './mathvariant/mathvariant.js'
import './mpadded/mpadded.js'
import './malign/malign.js'
import './mtable/mtable.js'
import './elem-math/elemMath.js'
import './linebreaking/linebreaking.js'
import './href/href.js'

const mathmlPolyfillsLoad = function() {
  const runTransformsOnPageLoad =
    typeof (window.doNotRunTransformsOnPageLoad) === "undefined" ? true : window.doNotRunTransformsOnPageLoad;
  if (runTransformsOnPageLoad) {
    console.log("Running MathML polyfills.")
    for (let m of document.querySelectorAll("math")) {
      _MathTransforms.transform(m);
    }
  }
}
if (document.readyState === "loading") {
  window.addEventListener('DOMContentLoaded', mathmlPolyfillsLoad)
} else {
  mathmlPolyfillsLoad()
}

export default _MathTransforms;