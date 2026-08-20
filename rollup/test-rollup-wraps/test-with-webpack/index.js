/* See the file ../../../LICENSE.txt for the LICENSE of this file. */
import _MathTransforms from "mathml-polyfills";
window.addEventListener("DOMContentLoaded", () => {
  const h1 = document.createElement("h1"); h1.innerHTML = "Test mathml-polyfills With Webpack";
  document.body.append(h1)
  if(_MathTransforms) {
    const p = document.createElement("p");
    p.innerText = "Here comes _MathTransforms:";
    document.body.appendChild(p)
    const ul = document.createElement("ul");
    document.body.append(ul);
    for(let name of Object.keys(_MathTransforms)) {
      const li = document.createElement("li");
      li.innerText = name + " : " + typeof(_MathTransforms[name]);
      ul.appendChild(li)
    }
  } else {
    const p = document.createElement("p");
    p.innerText = "If _MathTransforms is defined it should appear here.";
    document.body.append(p);
  }
})
