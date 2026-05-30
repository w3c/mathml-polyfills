import {_MathTransforms} from "mathml-polyfills";
window.addEventListener("DOMContentLoaded", () => {
  const h1 = document.createElement("h1"); h1.innerHTML = "Test mathml-polyfills With Webpack";
  document.body.append(h1)
  if(_MathTransforms) {
    const ul = document.createElement("ul");
    document.body.append(ul);
    for(let name of Object.keys(_MathTransforms)) {
      const li = document.createElement("li");
      li.innerText = name + " : " + typeof(_MathTransforms[name]);
      ul.appendChild(li)
    }
  } else {
    const p = document.createElement("p");
    p.innerText = "Not _MathTransforms found";
    document.body.append(p);
  }
})
