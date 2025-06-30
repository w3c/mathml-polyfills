/***
 * Converts an element with a mathvariant attribute other than 'normal' into
 * the same kind of element with the corresponding math-style character(s)
 * and no mathvariant attribute
 ***/
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */

/*
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

import { _MathTransforms } from '../common/math-transforms.js'

const mathvariants = {
    // MathML mathvariant values to TeX unicode-math names in unimath-symbols.pdf
    'normal': 'mup',
    'bold': 'mbf',
    'italic': 'mit',
    'bold-italic': 'mbfit',
    'double-struck': 'Bbb',
    'bold-fraktur': 'mbffrak',
    'script': 'mscr',
    'bold-script': 'mbfscr',
    'fraktur': 'mfrak',
    'sans-serif': 'msans',
    'bold-sans-serif': 'mbfsans',
    'sans-serif-italic': 'mitsans',
    'sans-serif-bold-italic': 'mbfitsans',
    'monospace': 'mtt',
    'isolated': 'misol',
    'initial': 'minit',
    'tailed': 'mtail',
    'looped': 'mloop',
    'stretched': 'mstrc',
    'chancery': 'mchan',
    'roundhand': 'mrhnd'
};

const mathAlphas = {
    "bold":{"0":"𝟎","1":"𝟏","2":"𝟐","3":"𝟑","4":"𝟒","5":"𝟓","6":"𝟔","7":"𝟕","8":"𝟖","9":"𝟗","A":"𝐀","B":"𝐁","C":"𝐂","D":"𝐃","E":"𝐄","F":"𝐅","G":"𝐆","H":"𝐇","I":"𝐈","J":"𝐉","K":"𝐊","L":"𝐋","M":"𝐌","N":"𝐍","O":"𝐎","P":"𝐏","Q":"𝐐","R":"𝐑","S":"𝐒","T":"𝐓","U":"𝐔","V":"𝐕","W":"𝐖","X":"𝐗","Y":"𝐘","Z":"𝐙","a":"𝐚","b":"𝐛","c":"𝐜","d":"𝐝","e":"𝐞","f":"𝐟","g":"𝐠","h":"𝐡","i":"𝐢","j":"𝐣","k":"𝐤","l":"𝐥","m":"𝐦","n":"𝐧","o":"𝐨","p":"𝐩","q":"𝐪","r":"𝐫","s":"𝐬","t":"𝐭","u":"𝐮","v":"𝐯","w":"𝐰","x":"𝐱","y":"𝐲","z":"𝐳","Α":"𝚨","Β":"𝚩","Γ":"𝚪","Δ":"𝚫","Ε":"𝚬","Ζ":"𝚭","Η":"𝚮","Θ":"𝚯","Ι":"𝚰","Κ":"𝚱","Λ":"𝚲","Μ":"𝚳","Ν":"𝚴","Ξ":"𝚵","Ο":"𝚶","Π":"𝚷","Ρ":"𝚸","Σ":"𝚺","Τ":"𝚻","Υ":"𝚼","Φ":"𝚽","Χ":"𝚾","Ψ":"𝚿","Ω":"𝛀","α":"𝛂","β":"𝛃","γ":"𝛄","δ":"𝛅","ε":"𝛆","ζ":"𝛇","η":"𝛈","θ":"𝛉","ι":"𝛊","κ":"𝛋","λ":"𝛌","μ":"𝛍","ν":"𝛎","ξ":"𝛏","ο":"𝛐","π":"𝛑","ρ":"𝛒","ς":"𝛓","σ":"𝛔","τ":"𝛕","υ":"𝛖","φ":"𝛗","χ":"𝛘","ψ":"𝛙","ω":"𝛚","ϑ":"𝛝","ϕ":"𝛟","ϖ":"𝛡","Ϝ":"𝟊","ϝ":"𝟋","ϰ":"𝛞","ϱ":"𝛠","ϴ":"𝚹","ϵ":"𝛜","∂":"𝛛","∇":"𝛁"},
    "bold-fraktur":{"A":"𝕬","B":"𝕭","C":"𝕮","D":"𝕯","E":"𝕰","F":"𝕱","G":"𝕲","H":"𝕳","I":"𝕴","J":"𝕵","K":"𝕶","L":"𝕷","M":"𝕸","N":"𝕹","O":"𝕺","P":"𝕻","Q":"𝕼","R":"𝕽","S":"𝕾","T":"𝕿","U":"𝖀","V":"𝖁","W":"𝖂","X":"𝖃","Y":"𝖄","Z":"𝖅","a":"𝖆","b":"𝖇","c":"𝖈","d":"𝖉","e":"𝖊","f":"𝖋","g":"𝖌","h":"𝖍","i":"𝖎","j":"𝖏","k":"𝖐","l":"𝖑","m":"𝖒","n":"𝖓","o":"𝖔","p":"𝖕","q":"𝖖","r":"𝖗","s":"𝖘","t":"𝖙","u":"𝖚","v":"𝖛","w":"𝖜","x":"𝖝","y":"𝖞","z":"𝖟"},
    "bold-italic":{"A":"𝑨","B":"𝑩","C":"𝑪","D":"𝑫","E":"𝑬","F":"𝑭","G":"𝑮","H":"𝑯","I":"𝑰","J":"𝑱","K":"𝑲","L":"𝑳","M":"𝑴","N":"𝑵","O":"𝑶","P":"𝑷","Q":"𝑸","R":"𝑹","S":"𝑺","T":"𝑻","U":"𝑼","V":"𝑽","W":"𝑾","X":"𝑿","Y":"𝒀","Z":"𝒁","a":"𝒂","b":"𝒃","c":"𝒄","d":"𝒅","e":"𝒆","f":"𝒇","g":"𝒈","h":"𝒉","i":"𝒊","j":"𝒋","k":"𝒌","l":"𝒍","m":"𝒎","n":"𝒏","o":"𝒐","p":"𝒑","q":"𝒒","r":"𝒓","s":"𝒔","t":"𝒕","u":"𝒖","v":"𝒗","w":"𝒘","x":"𝒙","y":"𝒚","z":"𝒛","Α":"𝜜","Β":"𝜝","Γ":"𝜞","Δ":"𝜟","Ε":"𝜠","Ζ":"𝜡","Η":"𝜢","Θ":"𝜣","Ι":"𝜤","Κ":"𝜥","Λ":"𝜦","Μ":"𝜧","Ν":"𝜨","Ξ":"𝜩","Ο":"𝜪","Π":"𝜫","Ρ":"𝜬","Σ":"𝜮","Τ":"𝜯","Υ":"𝜰","Φ":"𝜱","Χ":"𝜲","Ψ":"𝜳","Ω":"𝜴","α":"𝜶","β":"𝜷","γ":"𝜸","δ":"𝜹","ε":"𝜺","ζ":"𝜻","η":"𝜼","θ":"𝜽","ι":"𝜾","κ":"𝜿","λ":"𝝀","μ":"𝝁","ν":"𝝂","ξ":"𝝃","ο":"𝝄","π":"𝝅","ρ":"𝝆","ς":"𝝇","σ":"𝝈","τ":"𝝉","υ":"𝝊","φ":"𝝋","χ":"𝝌","ψ":"𝝍","ω":"𝝎","ϑ":"𝝑","ϕ":"𝝓","ϖ":"𝝕","ϰ":"𝝒","ϱ":"𝝔","ϴ":"𝜭","ϵ":"𝝐","∂":"𝝏","∇":"𝜵"},
    "bold-sans-serif":{"0":"𝟬","1":"𝟭","2":"𝟮","3":"𝟯","4":"𝟰","5":"𝟱","6":"𝟲","7":"𝟳","8":"𝟴","9":"𝟵","A":"𝗔","B":"𝗕","C":"𝗖","D":"𝗗","E":"𝗘","F":"𝗙","G":"𝗚","H":"𝗛","I":"𝗜","J":"𝗝","K":"𝗞","L":"𝗟","M":"𝗠","N":"𝗡","O":"𝗢","P":"𝗣","Q":"𝗤","R":"𝗥","S":"𝗦","T":"𝗧","U":"𝗨","V":"𝗩","W":"𝗪","X":"𝗫","Y":"𝗬","Z":"𝗭","a":"𝗮","b":"𝗯","c":"𝗰","d":"𝗱","e":"𝗲","f":"𝗳","g":"𝗴","h":"𝗵","i":"𝗶","j":"𝗷","k":"𝗸","l":"𝗹","m":"𝗺","n":"𝗻","o":"𝗼","p":"𝗽","q":"𝗾","r":"𝗿","s":"𝘀","t":"𝘁","u":"𝘂","v":"𝘃","w":"𝘄","x":"𝘅","y":"𝘆","z":"𝘇","Α":"𝝖","Β":"𝝗","Γ":"𝝘","Δ":"𝝙","Ε":"𝝚","Ζ":"𝝛","Η":"𝝜","Θ":"𝝝","Ι":"𝝞","Κ":"𝝟","Λ":"𝝠","Μ":"𝝡","Ν":"𝝢","Ξ":"𝝣","Ο":"𝝤","Π":"𝝥","Ρ":"𝝦","Σ":"𝝨","Τ":"𝝩","Υ":"𝝪","Φ":"𝝫","Χ":"𝝬","Ψ":"𝝭","Ω":"𝝮","α":"𝝰","β":"𝝱","γ":"𝝲","δ":"𝝳","ε":"𝝴","ζ":"𝝵","η":"𝝶","θ":"𝝷","ι":"𝝸","κ":"𝝹","λ":"𝝺","μ":"𝝻","ν":"𝝼","ξ":"𝝽","ο":"𝝾","π":"𝝿","ρ":"𝞀","ς":"𝞁","σ":"𝞂","τ":"𝞃","υ":"𝞄","φ":"𝞅","χ":"𝞆","ψ":"𝞇","ω":"𝞈","ϑ":"𝞋","ϕ":"𝞍","ϖ":"𝞏","ϰ":"𝞌","ϱ":"𝞎","ϴ":"𝝧","ϵ":"𝞊","∂":"𝞉","∇":"𝝯"},
    "bold-script":{"A":"𝓐","B":"𝓑","C":"𝓒","D":"𝓓","E":"𝓔","F":"𝓕","G":"𝓖","H":"𝓗","I":"𝓘","J":"𝓙","K":"𝓚","L":"𝓛","M":"𝓜","N":"𝓝","O":"𝓞","P":"𝓟","Q":"𝓠","R":"𝓡","S":"𝓢","T":"𝓣","U":"𝓤","V":"𝓥","W":"𝓦","X":"𝓧","Y":"𝓨","Z":"𝓩","a":"𝓪","b":"𝓫","c":"𝓬","d":"𝓭","e":"𝓮","f":"𝓯","g":"𝓰","h":"𝓱","i":"𝓲","j":"𝓳","k":"𝓴","l":"𝓵","m":"𝓶","n":"𝓷","o":"𝓸","p":"𝓹","q":"𝓺","r":"𝓻","s":"𝓼","t":"𝓽","u":"𝓾","v":"𝓿","w":"𝔀","x":"𝔁","y":"𝔂","z":"𝔃"},"double-struck":{"0":"𝟘","1":"𝟙","2":"𝟚","3":"𝟛","4":"𝟜","5":"𝟝","6":"𝟞","7":"𝟟","8":"𝟠","9":"𝟡","A":"𝔸","B":"𝔹","C":"ℂ","D":"𝔻","E":"𝔼","F":"𝔽","G":"𝔾","H":"ℍ","I":"𝕀","J":"𝕁","K":"𝕂","L":"𝕃","M":"𝕄","N":"ℕ","O":"𝕆","P":"ℙ","Q":"ℚ","R":"ℝ","S":"𝕊","T":"𝕋","U":"𝕌","V":"𝕍","W":"𝕎","X":"𝕏","Y":"𝕐","Z":"ℤ","a":"𝕒","b":"𝕓","c":"𝕔","d":"𝕕","e":"𝕖","f":"𝕗","g":"𝕘","h":"𝕙","i":"𝕚","j":"𝕛","k":"𝕜","l":"𝕝","m":"𝕞","n":"𝕟","o":"𝕠","p":"𝕡","q":"𝕢","r":"𝕣","s":"𝕤","t":"𝕥","u":"𝕦","v":"𝕧","w":"𝕨","x":"𝕩","y":"𝕪","z":"𝕫","ب":"𞺡","ت":"𞺵","ث":"𞺶","ج":"𞺢","ح":"𞺧","خ":"𞺷","د":"𞺣","ذ":"𞺸","ر":"𞺳","ز":"𞺦","س":"𞺮","ش":"𞺴","ص":"𞺱","ض":"𞺹","ط":"𞺨","ظ":"𞺺","ع":"𞺯","غ":"𞺻","ف":"𞺰","ق":"𞺲","ل":"𞺫","م":"𞺬","ن":"𞺭","و":"𞺥","ي":"𞺩"},
    "fraktur":{"A":"𝔄","B":"𝔅","C":"ℭ","D":"𝔇","E":"𝔈","F":"𝔉","G":"𝔊","H":"ℌ","I":"ℑ","J":"𝔍","K":"𝔎","L":"𝔏","M":"𝔐","N":"𝔑","O":"𝔒","P":"𝔓","Q":"𝔔","R":"ℜ","S":"𝔖","T":"𝔗","U":"𝔘","V":"𝔙","W":"𝔚","X":"𝔛","Y":"𝔜","Z":"ℨ","a":"𝔞","b":"𝔟","c":"𝔠","d":"𝔡","e":"𝔢","f":"𝔣","g":"𝔤","h":"𝔥","i":"𝔦","j":"𝔧","k":"𝔨","l":"𝔩","m":"𝔪","n":"𝔫","o":"𝔬","p":"𝔭","q":"𝔮","r":"𝔯","s":"𝔰","t":"𝔱","u":"𝔲","v":"𝔳","w":"𝔴","x":"𝔵","y":"𝔶","z":"𝔷"},
    "initial":{"ب":"𞸡","ت":"𞸵","ث":"𞸶","ج":"𞸢","ح":"𞸧","خ":"𞸷","س":"𞸮","ش":"𞸴","ص":"𞸱","ض":"𞸹","ع":"𞸯","غ":"𞸻","ف":"𞸰","ق":"𞸲","ك":"𞸪","ل":"𞸫","م":"𞸬","ن":"𞸭","ه":"𞸤","ي":"𞸩"},
    "isolated":{"ا":"𞸀","ب":"𞸁","ت":"𞸕","ث":"𞸖","ج":"𞸂","ح":"𞸇","خ":"𞸗","د":"𞸃","ذ":"𞸘","ر":"𞸓","ز":"𞸆","س":"𞸎","ش":"𞸔","ص":"𞸑","ض":"𞸙","ط":"𞸈","ظ":"𞸚","ع":"𞸏","غ":"𞸛","ف":"𞸐","ق":"𞸒","ك":"𞸊","ل":"𞸋","م":"𞸌","ن":"𞸍","و":"𞸅","ي":"𞸉","ٮ":"𞸜","ٯ":"𞸟","ڡ":"𞸞","ں":"𞸝"},
    "italic":{"A":"𝐴","B":"𝐵","C":"𝐶","D":"𝐷","E":"𝐸","F":"𝐹","G":"𝐺","H":"𝐻","I":"𝐼","J":"𝐽","K":"𝐾","L":"𝐿","M":"𝑀","N":"𝑁","O":"𝑂","P":"𝑃","Q":"𝑄","R":"𝑅","S":"𝑆","T":"𝑇","U":"𝑈","V":"𝑉","W":"𝑊","X":"𝑋","Y":"𝑌","Z":"𝑍","a":"𝑎","b":"𝑏","c":"𝑐","d":"𝑑","e":"𝑒","f":"𝑓","g":"𝑔","h":"ℎ","i":"𝑖","j":"𝑗","k":"𝑘","l":"𝑙","m":"𝑚","n":"𝑛","o":"𝑜","p":"𝑝","q":"𝑞","r":"𝑟","s":"𝑠","t":"𝑡","u":"𝑢","v":"𝑣","w":"𝑤","x":"𝑥","y":"𝑦","z":"𝑧","ı":"𝚤","ȷ":"𝚥","Α":"𝛢","Β":"𝛣","Γ":"𝛤","Δ":"𝛥","Ε":"𝛦","Ζ":"𝛧","Η":"𝛨","Θ":"𝛩","Ι":"𝛪","Κ":"𝛫","Λ":"𝛬","Μ":"𝛭","Ν":"𝛮","Ξ":"𝛯","Ο":"𝛰","Π":"𝛱","Ρ":"𝛲","Σ":"𝛴","Τ":"𝛵","Υ":"𝛶","Φ":"𝛷","Χ":"𝛸","Ψ":"𝛹","Ω":"𝛺","α":"𝛼","β":"𝛽","γ":"𝛾","δ":"𝛿","ε":"𝜀","ζ":"𝜁","η":"𝜂","θ":"𝜃","ι":"𝜄","κ":"𝜅","λ":"𝜆","μ":"𝜇","ν":"𝜈","ξ":"𝜉","ο":"𝜊","π":"𝜋","ρ":"𝜌","ς":"𝜍","σ":"𝜎","τ":"𝜏","υ":"𝜐","φ":"𝜑","χ":"𝜒","ψ":"𝜓","ω":"𝜔","ϑ":"𝜗","ϕ":"𝜙","ϖ":"𝜛","ϰ":"𝜘","ϱ":"𝜚","ϴ":"𝛳","ϵ":"𝜖","∂":"𝜕","∇":"𝛻"},
    "looped":{"ا":"𞺀","ب":"𞺁","ت":"𞺕","ث":"𞺖","ج":"𞺂","ح":"𞺇","خ":"𞺗","د":"𞺃","ذ":"𞺘","ر":"𞺓","ز":"𞺆","س":"𞺎","ش":"𞺔","ص":"𞺑","ض":"𞺙","ط":"𞺈","ظ":"𞺚","ع":"𞺏","غ":"𞺛","ف":"𞺐","ق":"𞺒","ل":"𞺋","م":"𞺌","ن":"𞺍","ه":"𞺄","و":"𞺅","ي":"𞺉"},
    "monospace":{"0":"𝟶","1":"𝟷","2":"𝟸","3":"𝟹","4":"𝟺","5":"𝟻","6":"𝟼","7":"𝟽","8":"𝟾","9":"𝟿","A":"𝙰","B":"𝙱","C":"𝙲","D":"𝙳","E":"𝙴","F":"𝙵","G":"𝙶","H":"𝙷","I":"𝙸","J":"𝙹","K":"𝙺","L":"𝙻","M":"𝙼","N":"𝙽","O":"𝙾","P":"𝙿","Q":"𝚀","R":"𝚁","S":"𝚂","T":"𝚃","U":"𝚄","V":"𝚅","W":"𝚆","X":"𝚇","Y":"𝚈","Z":"𝚉","a":"𝚊","b":"𝚋","c":"𝚌","d":"𝚍","e":"𝚎","f":"𝚏","g":"𝚐","h":"𝚑","i":"𝚒","j":"𝚓","k":"𝚔","l":"𝚕","m":"𝚖","n":"𝚗","o":"𝚘","p":"𝚙","q":"𝚚","r":"𝚛","s":"𝚜","t":"𝚝","u":"𝚞","v":"𝚟","w":"𝚠","x":"𝚡","y":"𝚢","z":"𝚣"},
    "sans-serif":{"0":"𝟢","1":"𝟣","2":"𝟤","3":"𝟥","4":"𝟦","5":"𝟧","6":"𝟨","7":"𝟩","8":"𝟪","9":"𝟫","A":"𝖠","B":"𝖡","C":"𝖢","D":"𝖣","E":"𝖤","F":"𝖥","G":"𝖦","H":"𝖧","I":"𝖨","J":"𝖩","K":"𝖪","L":"𝖫","M":"𝖬","N":"𝖭","O":"𝖮","P":"𝖯","Q":"𝖰","R":"𝖱","S":"𝖲","T":"𝖳","U":"𝖴","V":"𝖵","W":"𝖶","X":"𝖷","Y":"𝖸","Z":"𝖹","a":"𝖺","b":"𝖻","c":"𝖼","d":"𝖽","e":"𝖾","f":"𝖿","g":"𝗀","h":"𝗁","i":"𝗂","j":"𝗃","k":"𝗄","l":"𝗅","m":"𝗆","n":"𝗇","o":"𝗈","p":"𝗉","q":"𝗊","r":"𝗋","s":"𝗌","t":"𝗍","u":"𝗎","v":"𝗏","w":"𝗐","x":"𝗑","y":"𝗒","z":"𝗓"},
    "sans-serif-bold-italic":{"A":"𝘼","B":"𝘽","C":"𝘾","D":"𝘿","E":"𝙀","F":"𝙁","G":"𝙂","H":"𝙃","I":"𝙄","J":"𝙅","K":"𝙆","L":"𝙇","M":"𝙈","N":"𝙉","O":"𝙊","P":"𝙋","Q":"𝙌","R":"𝙍","S":"𝙎","T":"𝙏","U":"𝙐","V":"𝙑","W":"𝙒","X":"𝙓","Y":"𝙔","Z":"𝙕","a":"𝙖","b":"𝙗","c":"𝙘","d":"𝙙","e":"𝙚","f":"𝙛","g":"𝙜","h":"𝙝","i":"𝙞","j":"𝙟","k":"𝙠","l":"𝙡","m":"𝙢","n":"𝙣","o":"𝙤","p":"𝙥","q":"𝙦","r":"𝙧","s":"𝙨","t":"𝙩","u":"𝙪","v":"𝙫","w":"𝙬","x":"𝙭","y":"𝙮","z":"𝙯","Α":"𝞐","Β":"𝞑","Γ":"𝞒","Δ":"𝞓","Ε":"𝞔","Ζ":"𝞕","Η":"𝞖","Θ":"𝞗","Ι":"𝞘","Κ":"𝞙","Λ":"𝞚","Μ":"𝞛","Ν":"𝞜","Ξ":"𝞝","Ο":"𝞞","Π":"𝞟","Ρ":"𝞠","Σ":"𝞢","Τ":"𝞣","Υ":"𝞤","Φ":"𝞥","Χ":"𝞦","Ψ":"𝞧","Ω":"𝞨","α":"𝞪","β":"𝞫","γ":"𝞬","δ":"𝞭","ε":"𝞮","ζ":"𝞯","η":"𝞰","θ":"𝞱","ι":"𝞲","κ":"𝞳","λ":"𝞴","μ":"𝞵","ν":"𝞶","ξ":"𝞷","ο":"𝞸","π":"𝞹","ρ":"𝞺","ς":"𝞻","σ":"𝞼","τ":"𝞽","υ":"𝞾","φ":"𝞿","χ":"𝟀","ψ":"𝟁","ω":"𝟂","ϑ":"𝟅","ϕ":"𝟇","ϖ":"𝟉","ϰ":"𝟆","ϱ":"𝟈","ϴ":"𝞡","ϵ":"𝟄","∂":"𝟃","∇":"𝞩"},
    "sans-serif-italic":{"A":"𝘈","B":"𝘉","C":"𝘊","D":"𝘋","E":"𝘌","F":"𝘍","G":"𝘎","H":"𝘏","I":"𝘐","J":"𝘑","K":"𝘒","L":"𝘓","M":"𝘔","N":"𝘕","O":"𝘖","P":"𝘗","Q":"𝘘","R":"𝘙","S":"𝘚","T":"𝘛","U":"𝘜","V":"𝘝","W":"𝘞","X":"𝘟","Y":"𝘠","Z":"𝘡","a":"𝘢","b":"𝘣","c":"𝘤","d":"𝘥","e":"𝘦","f":"𝘧","g":"𝘨","h":"𝘩","i":"𝘪","j":"𝘫","k":"𝘬","l":"𝘭","m":"𝘮","n":"𝘯","o":"𝘰","p":"𝘱","q":"𝘲","r":"𝘳","s":"𝘴","t":"𝘵","u":"𝘶","v":"𝘷","w":"𝘸","x":"𝘹","y":"𝘺","z":"𝘻"},
    "script":{"A":"𝒜","B":"ℬ","C":"𝒞","D":"𝒟","E":"ℰ","F":"ℱ","G":"𝒢","H":"ℋ","I":"ℐ","J":"𝒥","K":"𝒦","L":"ℒ","M":"ℳ","N":"𝒩","O":"𝒪","P":"𝒫","Q":"𝒬","R":"ℛ","S":"𝒮","T":"𝒯","U":"𝒰","V":"𝒱","W":"𝒲","X":"𝒳","Y":"𝒴","Z":"𝒵","a":"𝒶","b":"𝒷","c":"𝒸","d":"𝒹","e":"ℯ","f":"𝒻","g":"ℊ","h":"𝒽","i":"𝒾","j":"𝒿","k":"𝓀","l":"𝓁","m":"𝓂","n":"𝓃","o":"ℴ","p":"𝓅","q":"𝓆","r":"𝓇","s":"𝓈","t":"𝓉","u":"𝓊","v":"𝓋","w":"𝓌","x":"𝓍","y":"𝓎","z":"𝓏"},
    "stretched":{"ب":"𞹡","ت":"𞹵","ث":"𞹶","ج":"𞹢","ح":"𞹧","خ":"𞹷","س":"𞹮","ش":"𞹴","ص":"𞹱","ض":"𞹹","ط":"𞹨","ظ":"𞹺","ع":"𞹯","غ":"𞹻","ف":"𞹰","ق":"𞹲","ك":"𞹪","م":"𞹬","ن":"𞹭","ه":"𞹤","ي":"𞹩","ٮ":"𞹼","ڡ":"𞹾"},
    "tailed":{"ج":"𞹂","ح":"𞹇","خ":"𞹗","س":"𞹎","ش":"𞹔","ص":"𞹑","ض":"𞹙","ع":"𞹏","غ":"𞹛","ق":"𞹒","ل":"𞹋","ن":"𞹍","ي":"𞹉","ٯ":"𞹟","ں":"𞹝"}
}

let init = false

const convertMathvariant = (el) => {
    // If the element el has a mathvariant attribute other than 'normal',
    // replace the character(s) in el.textContent by the corresponding
    // math-style characters and remove the attribute.
    let mathVariant = el.getAttribute('mathvariant')
    if (!mathVariant || mathVariant == 'normal')
        return

    let mathStyle = mathvariants[mathVariant]
    if (!mathStyle)
        return

    if (!init) {
        init = true
        test()
    }

    let text = el.textContent
    let val = ''
    let removeAttr = true

    for (let i = 0; i < text.length; i++) {
        let ch = text[i]
        let chT = mathAlphas[mathVariant] ? mathAlphas[mathVariant][ch] : ''

        if (!chT) {
            chT = getMathAlphanumeric(ch, mathStyle)
            if (chT == ch)                  // Math styled char not in Unicode
                removeAttr = false
        }
        val += chT
    }
    el.textContent = val
    if (removeAttr)
        el.removeAttribute('mathVariant')
}

function test() {
// Compare table and code implementations
    let failed = 0
    let success = 0

    Object.entries(mathAlphas).forEach(([mathvariant, val]) => {
        Object.keys(val).forEach((ch) => {
            let chA = getMathAlphanumeric(ch, mathvariants[mathvariant])
            let chT = mathAlphas[mathvariant][ch]

            if (chA != chT) {
                console.log('ch: ' + ch + ', chT: ' + chT + ', chA: ' + chA)
                failed++
            } else {
                success++
            }
        })
    })
    // Should be 1161 successes (as of Unicode 16.0) and 0 failures
    console.log("success = " + success + ": failed = " + failed)

    // Add tests for mathvariant = 'roundhand', 'chancery'. This test and
    // getMathAlphanumeric() produce script variants for lower-case script
    // characters, variants which haven't been allocated.
    function compare(mathvariant, vs) {
        let failed = 0
        let success = 0
        let val = mathAlphas['script']

        Object.keys(val).forEach((ch) => {
            let chA = getMathAlphanumeric(ch, mathvariants[mathvariant])
            let chT = val[ch] + vs

            if (chA != chT) {
                console.log('ch: ' + ch + ', chT: ' + chT + ', chA: ' + chA)
                failed++
            } else {
                success++
            }
        })
        return [success, failed]
    }
    [success, failed] = compare('roundhand', '\uFE01')
    let [success1, failed1] = compare('chancery', '\uFE00')
    success += success1
    failed += failed1
    console.log("success = " + success + ": failed = " + failed)
}

const abjad = [0, 1, -1, 21, 22, 2, 7, 23, 3, 24, 19, 6, 14, 20, 17, 25, 8,
    26, 15, 27, -1, -1, -1, -1, -1, -1, 16, 18, 10, 11, 12, 13, 4, 5, -1, 9]
const dottedChars = '\u066E\u06BA\u06A1\u066F'
const letterlikeDoubleStruck = {'C':'ℂ','H':'ℍ','N':'ℕ','P':'ℙ','Q':'ℚ','R':'ℝ','Z':'ℤ'}
const letterlikeFraktur = {'C':'ℭ','H':'ℌ','I':'ℑ','R':'ℜ','Z':'ℨ'}
const letterlikeScript = {'B':'ℬ','E':'ℰ','F':'ℱ','H':'ℋ','I':'ℐ','L':'ℒ','M':'ℳ','R':'ℛ','e':'ℯ','g':'ℊ','o':'ℴ'}
//                          minit       mtail       mstrc       mloop        Bbb
const missingCharMask = [0xF5080169, 0x5569157B, 0xA1080869, 0xF0000000, 0xF0000000]
const offsetsGr = {'∂':51,'∇':25,'ϴ':17,'ϵ':52,'ϑ':53,'ϰ':54,'ϕ':55,'ϱ':56,'ϖ':57}
const setsAr = ['misol', 'minit','mtail', 'mstrc', 'mloop', 'Bbb']
const setsDigit = ['mbf', 'Bbb', 'msans', 'mbfsans', 'mtt']
const setsEn = ['mbf', 'mit', 'mbfit', 'mscr', 'mbfscr', 'mfrak', 'Bbb', 'mbffrak', 'msans', 'mbfsans', 'mitsans', 'mbfitsans', 'mtt']
const setsGr = ['mbf', 'mit', 'mbfit', 'mbfsans', 'mbfitsans']

function getMathAlphanumeric(ch, mathStyle) {
    // Return the Unicode math alphanumeric character corresponding to the
    // unstyled character ch and the mathStyle. If no such math alphanumeric
    // exists, return ch. The Unicode math alphanumerics are divided into
    // four categories (English, Greek, digits, and Arabic) each of which
    // contains math-style character sets with specific character counts,
    // e.g., 10 for the digit sets. This leads to a simple encoding scheme
    // (see the digits category) that's somewhat complicated by exceptions
    // in the letter categories.
    if (!mathStyle || mathStyle == 'mup')
        return ch                           // No change for upright

    let code = ch.charCodeAt(0)
    let n                                   // Set index

    if (ch >= '0' && ch <= '9') {           // ASCII digits
        code += 0x1D7CE - 0x30              // Get math-digit codepoint
        n = setsDigit.indexOf(mathStyle)
        return n != -1 ? String.fromCodePoint(code + n * 10) : ch
    }

    if (/[A-Za-z]/.test(ch)) {              // ASCII letters
        // Set up roundhand and chancery script styles
        let varsel = ''
        if (mathStyle == 'mchan' || mathStyle == 'mrhnd') {
            varsel = mathStyle == 'mchan' ? '\uFE00' : '\uFE01'
            mathStyle = 'mscr'
        }
		// Handle legacy Unicode Letterlike characters
		let chT = ''
		switch (mathStyle) {
			case 'mit':                     // Math italic
				if (ch == 'h')
					return 'ℎ'			    // Letterlike italic h
				break
			case 'mfrak':                   // Math fraktur
				chT = letterlikeFraktur[ch]
				break
			case 'mscr':                    // Math script
				chT = letterlikeScript[ch]
				break
			case 'Bbb':                     // Math blackboard bold (double-struck)
				chT = letterlikeDoubleStruck[ch]
				break
		}
        if (chT)
            return chT + varsel

        n = setsEn.indexOf(mathStyle)       // Get set index
		if (n == -1)                        // mathStyle isn't in setsEn
			return ch

		code -= 0x41                        // Compute char offset in set
		if (code > 26)
			code -= 6						// No punct between lower & uppercase

        return String.fromCodePoint(code + 52 * n + 0x1D400) + varsel
    }

    if (ch >= '\u0391' && ch <= '\u03F5' || ch == '∂' || ch == '∇') {
        // Greek letters
        if (mathStyle == 'mbf') {           // Math bold Greek special cases
            if (ch == 'Ϝ')
                return '𝟊'                  // Digamma
            if (ch == 'ϝ')
                return '𝟋'                  // digamma
        }
        n = setsGr.indexOf(mathStyle)
        if (n == -1)
            return ch
        let code0 = offsetsGr[ch]           // Offset if noncontiguous char
        if (code0) {
            code = code0
        } else {
            code -= 0x391                   // Map \Alpha to 0
            if (code > 25)
                code -= 6                   // Map 𝛼 down to end of UC Greek
        }
        return String.fromCodePoint(code + 58 * n + 0x1D6A8)
    }
    if (code < 0x627)                       // Unhandled codes preceding Arabic
        return ch == 'ı'                    // Dotless i and j
            ? '𝚤' : ch == 'ȷ'
            ? '𝚥' : ch

    if (code > 0x6BA)                       // No unhandled chars above U+06BA
        return ch

    // Arabic letters
    n = setsAr.indexOf(mathStyle)
    if (n == -1)
        return ch

    if (code <= 0x64A) {
        // Translate code from the dictionary order followed approximately
        // in the Unicode Arabic block to the abjad order used by Arabic math
        // alphabetics. Both orders start with alef, e.g., U+0627
        code = abjad[code - 0x0627]
        if (code == -1)
            return ch
    } else {
        code = dottedChars.indexOf(ch)     // Get dotted-char offset
        if (code == -1)
            return ch
        code += 28
    }
    // Handle missing Arabic math characters
    if (mathStyle == 'misol') {
        if (code == 4)
            n = 1                           // Use initial style's heh
    } else if ((1 << code) & missingCharMask[n - 1])
        return ch                           // Math-styled char not defined

    return String.fromCodePoint(32 * n + code + 0x1EE00)
}

_MathTransforms.add('*[mathvariant]', convertMathvariant);
