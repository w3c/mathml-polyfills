/* See the file ../LICENSE.txt for the LICENSE of this file. */
export {_MathTransforms} from './common/math-transforms.js'
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
import './mtable/mtable.js'
import './elem-math/elemMath.js'
import './linebreaking/linebreaking.js'
import './href/href.js'

window.addEventListener('DOMContentLoaded', function() {
  const runTransformsOnPageLoad =
    typeof (window.doNotRunTransformsOnPageLoad) === "undefined" ? true : window.doNotRunTransformsOnPageLoad;
  if (runTransformsOnPageLoad) {
    for (let m of document.querySelectorAll("math")) {
      _MathTransforms.transform(m);
    }
  }
})
