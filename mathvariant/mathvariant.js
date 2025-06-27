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
    'stretched': 'mstrc'
};

// Math-alphanumeric-style conversions
const mathFonts = {
    // Courtesy of https://en.wikipedia.org/wiki/Mathematical_Alphanumeric_Symbols
    // and sublime text's multiple cursors. The math style names are the unicode-math
    // style names in https://texdoc.org/serve/unimath-symbols.pdf/0

    'A': { 'mbf': '𝐀', 'mit': '𝐴', 'mbfit': '𝑨', 'msans': '𝖠', 'mbfsans': '𝗔', 'mitsans': '𝘈', 'mbfitsans': '𝘼', 'mscr': '𝒜', 'mbfscr': '𝓐', 'mfrak': '𝔄', 'mbffrak': '𝕬', 'mtt': '𝙰', 'Bbb': '𝔸' },
    'B': { 'mbf': '𝐁', 'mit': '𝐵', 'mbfit': '𝑩', 'msans': '𝖡', 'mbfsans': '𝗕', 'mitsans': '𝘉', 'mbfitsans': '𝘽', 'mscr': 'ℬ', 'mbfscr': '𝓑', 'mfrak': '𝔅', 'mbffrak': '𝕭', 'mtt': '𝙱', 'Bbb': '𝔹' },
    'C': { 'mbf': '𝐂', 'mit': '𝐶', 'mbfit': '𝑪', 'msans': '𝖢', 'mbfsans': '𝗖', 'mitsans': '𝘊', 'mbfitsans': '𝘾', 'mscr': '𝒞', 'mbfscr': '𝓒', 'mfrak': 'ℭ', 'mbffrak': '𝕮', 'mtt': '𝙲', 'Bbb': 'ℂ' },
    'D': { 'mbf': '𝐃', 'mit': '𝐷', 'mbfit': '𝑫', 'msans': '𝖣', 'mbfsans': '𝗗', 'mitsans': '𝘋', 'mbfitsans': '𝘿', 'mscr': '𝒟', 'mbfscr': '𝓓', 'mfrak': '𝔇', 'mbffrak': '𝕯', 'mtt': '𝙳', 'Bbb': '𝔻' },
    'E': { 'mbf': '𝐄', 'mit': '𝐸', 'mbfit': '𝑬', 'msans': '𝖤', 'mbfsans': '𝗘', 'mitsans': '𝘌', 'mbfitsans': '𝙀', 'mscr': 'ℰ', 'mbfscr': '𝓔', 'mfrak': '𝔈', 'mbffrak': '𝕰', 'mtt': '𝙴', 'Bbb': '𝔼' },
    'F': { 'mbf': '𝐅', 'mit': '𝐹', 'mbfit': '𝑭', 'msans': '𝖥', 'mbfsans': '𝗙', 'mitsans': '𝘍', 'mbfitsans': '𝙁', 'mscr': 'ℱ', 'mbfscr': '𝓕', 'mfrak': '𝔉', 'mbffrak': '𝕱', 'mtt': '𝙵', 'Bbb': '𝔽' },
    'G': { 'mbf': '𝐆', 'mit': '𝐺', 'mbfit': '𝑮', 'msans': '𝖦', 'mbfsans': '𝗚', 'mitsans': '𝘎', 'mbfitsans': '𝙂', 'mscr': '𝒢', 'mbfscr': '𝓖', 'mfrak': '𝔊', 'mbffrak': '𝕲', 'mtt': '𝙶', 'Bbb': '𝔾' },
    'H': { 'mbf': '𝐇', 'mit': '𝐻', 'mbfit': '𝑯', 'msans': '𝖧', 'mbfsans': '𝗛', 'mitsans': '𝘏', 'mbfitsans': '𝙃', 'mscr': 'ℋ', 'mbfscr': '𝓗', 'mfrak': 'ℌ', 'mbffrak': '𝕳', 'mtt': '𝙷', 'Bbb': 'ℍ' },
    'I': { 'mbf': '𝐈', 'mit': '𝐼', 'mbfit': '𝑰', 'msans': '𝖨', 'mbfsans': '𝗜', 'mitsans': '𝘐', 'mbfitsans': '𝙄', 'mscr': 'ℐ', 'mbfscr': '𝓘', 'mfrak': 'ℑ', 'mbffrak': '𝕴', 'mtt': '𝙸', 'Bbb': '𝕀' },
    'J': { 'mbf': '𝐉', 'mit': '𝐽', 'mbfit': '𝑱', 'msans': '𝖩', 'mbfsans': '𝗝', 'mitsans': '𝘑', 'mbfitsans': '𝙅', 'mscr': '𝒥', 'mbfscr': '𝓙', 'mfrak': '𝔍', 'mbffrak': '𝕵', 'mtt': '𝙹', 'Bbb': '𝕁' },
    'K': { 'mbf': '𝐊', 'mit': '𝐾', 'mbfit': '𝑲', 'msans': '𝖪', 'mbfsans': '𝗞', 'mitsans': '𝘒', 'mbfitsans': '𝙆', 'mscr': '𝒦', 'mbfscr': '𝓚', 'mfrak': '𝔎', 'mbffrak': '𝕶', 'mtt': '𝙺', 'Bbb': '𝕂' },
    'L': { 'mbf': '𝐋', 'mit': '𝐿', 'mbfit': '𝑳', 'msans': '𝖫', 'mbfsans': '𝗟', 'mitsans': '𝘓', 'mbfitsans': '𝙇', 'mscr': 'ℒ', 'mbfscr': '𝓛', 'mfrak': '𝔏', 'mbffrak': '𝕷', 'mtt': '𝙻', 'Bbb': '𝕃' },
    'M': { 'mbf': '𝐌', 'mit': '𝑀', 'mbfit': '𝑴', 'msans': '𝖬', 'mbfsans': '𝗠', 'mitsans': '𝘔', 'mbfitsans': '𝙈', 'mscr': 'ℳ', 'mbfscr': '𝓜', 'mfrak': '𝔐', 'mbffrak': '𝕸', 'mtt': '𝙼', 'Bbb': '𝕄' },
    'N': { 'mbf': '𝐍', 'mit': '𝑁', 'mbfit': '𝑵', 'msans': '𝖭', 'mbfsans': '𝗡', 'mitsans': '𝘕', 'mbfitsans': '𝙉', 'mscr': '𝒩', 'mbfscr': '𝓝', 'mfrak': '𝔑', 'mbffrak': '𝕹', 'mtt': '𝙽', 'Bbb': 'ℕ' },
    'O': { 'mbf': '𝐎', 'mit': '𝑂', 'mbfit': '𝑶', 'msans': '𝖮', 'mbfsans': '𝗢', 'mitsans': '𝘖', 'mbfitsans': '𝙊', 'mscr': '𝒪', 'mbfscr': '𝓞', 'mfrak': '𝔒', 'mbffrak': '𝕺', 'mtt': '𝙾', 'Bbb': '𝕆' },
    'P': { 'mbf': '𝐏', 'mit': '𝑃', 'mbfit': '𝑷', 'msans': '𝖯', 'mbfsans': '𝗣', 'mitsans': '𝘗', 'mbfitsans': '𝙋', 'mscr': '𝒫', 'mbfscr': '𝓟', 'mfrak': '𝔓', 'mbffrak': '𝕻', 'mtt': '𝙿', 'Bbb': 'ℙ' },
    'Q': { 'mbf': '𝐐', 'mit': '𝑄', 'mbfit': '𝑸', 'msans': '𝖰', 'mbfsans': '𝗤', 'mitsans': '𝘘', 'mbfitsans': '𝙌', 'mscr': '𝒬', 'mbfscr': '𝓠', 'mfrak': '𝔔', 'mbffrak': '𝕼', 'mtt': '𝚀', 'Bbb': 'ℚ' },
    'R': { 'mbf': '𝐑', 'mit': '𝑅', 'mbfit': '𝑹', 'msans': '𝖱', 'mbfsans': '𝗥', 'mitsans': '𝘙', 'mbfitsans': '𝙍', 'mscr': 'ℛ', 'mbfscr': '𝓡', 'mfrak': 'ℜ', 'mbffrak': '𝕽', 'mtt': '𝚁', 'Bbb': 'ℝ' },
    'S': { 'mbf': '𝐒', 'mit': '𝑆', 'mbfit': '𝑺', 'msans': '𝖲', 'mbfsans': '𝗦', 'mitsans': '𝘚', 'mbfitsans': '𝙎', 'mscr': '𝒮', 'mbfscr': '𝓢', 'mfrak': '𝔖', 'mbffrak': '𝕾', 'mtt': '𝚂', 'Bbb': '𝕊' },
    'T': { 'mbf': '𝐓', 'mit': '𝑇', 'mbfit': '𝑻', 'msans': '𝖳', 'mbfsans': '𝗧', 'mitsans': '𝘛', 'mbfitsans': '𝙏', 'mscr': '𝒯', 'mbfscr': '𝓣', 'mfrak': '𝔗', 'mbffrak': '𝕿', 'mtt': '𝚃', 'Bbb': '𝕋' },
    'U': { 'mbf': '𝐔', 'mit': '𝑈', 'mbfit': '𝑼', 'msans': '𝖴', 'mbfsans': '𝗨', 'mitsans': '𝘜', 'mbfitsans': '𝙐', 'mscr': '𝒰', 'mbfscr': '𝓤', 'mfrak': '𝔘', 'mbffrak': '𝖀', 'mtt': '𝚄', 'Bbb': '𝕌' },
    'V': { 'mbf': '𝐕', 'mit': '𝑉', 'mbfit': '𝑽', 'msans': '𝖵', 'mbfsans': '𝗩', 'mitsans': '𝘝', 'mbfitsans': '𝙑', 'mscr': '𝒱', 'mbfscr': '𝓥', 'mfrak': '𝔙', 'mbffrak': '𝖁', 'mtt': '𝚅', 'Bbb': '𝕍' },
    'W': { 'mbf': '𝐖', 'mit': '𝑊', 'mbfit': '𝑾', 'msans': '𝖶', 'mbfsans': '𝗪', 'mitsans': '𝘞', 'mbfitsans': '𝙒', 'mscr': '𝒲', 'mbfscr': '𝓦', 'mfrak': '𝔚', 'mbffrak': '𝖂', 'mtt': '𝚆', 'Bbb': '𝕎' },
    'X': { 'mbf': '𝐗', 'mit': '𝑋', 'mbfit': '𝑿', 'msans': '𝖷', 'mbfsans': '𝗫', 'mitsans': '𝘟', 'mbfitsans': '𝙓', 'mscr': '𝒳', 'mbfscr': '𝓧', 'mfrak': '𝔛', 'mbffrak': '𝖃', 'mtt': '𝚇', 'Bbb': '𝕏' },
    'Y': { 'mbf': '𝐘', 'mit': '𝑌', 'mbfit': '𝒀', 'msans': '𝖸', 'mbfsans': '𝗬', 'mitsans': '𝘠', 'mbfitsans': '𝙔', 'mscr': '𝒴', 'mbfscr': '𝓨', 'mfrak': '𝔜', 'mbffrak': '𝖄', 'mtt': '𝚈', 'Bbb': '𝕐' },
    'Z': { 'mbf': '𝐙', 'mit': '𝑍', 'mbfit': '𝒁', 'msans': '𝖹', 'mbfsans': '𝗭', 'mitsans': '𝘡', 'mbfitsans': '𝙕', 'mscr': '𝒵', 'mbfscr': '𝓩', 'mfrak': 'ℨ', 'mbffrak': '𝖅', 'mtt': '𝚉', 'Bbb': 'ℤ' },
    'a': { 'mbf': '𝐚', 'mit': '𝑎', 'mbfit': '𝒂', 'msans': '𝖺', 'mbfsans': '𝗮', 'mitsans': '𝘢', 'mbfitsans': '𝙖', 'mscr': '𝒶', 'mbfscr': '𝓪', 'mfrak': '𝔞', 'mbffrak': '𝖆', 'mtt': '𝚊', 'Bbb': '𝕒' },
    'b': { 'mbf': '𝐛', 'mit': '𝑏', 'mbfit': '𝒃', 'msans': '𝖻', 'mbfsans': '𝗯', 'mitsans': '𝘣', 'mbfitsans': '𝙗', 'mscr': '𝒷', 'mbfscr': '𝓫', 'mfrak': '𝔟', 'mbffrak': '𝖇', 'mtt': '𝚋', 'Bbb': '𝕓' },
    'c': { 'mbf': '𝐜', 'mit': '𝑐', 'mbfit': '𝒄', 'msans': '𝖼', 'mbfsans': '𝗰', 'mitsans': '𝘤', 'mbfitsans': '𝙘', 'mscr': '𝒸', 'mbfscr': '𝓬', 'mfrak': '𝔠', 'mbffrak': '𝖈', 'mtt': '𝚌', 'Bbb': '𝕔' },
    'd': { 'mbf': '𝐝', 'mit': '𝑑', 'mbfit': '𝒅', 'msans': '𝖽', 'mbfsans': '𝗱', 'mitsans': '𝘥', 'mbfitsans': '𝙙', 'mscr': '𝒹', 'mbfscr': '𝓭', 'mfrak': '𝔡', 'mbffrak': '𝖉', 'mtt': '𝚍', 'Bbb': '𝕕' },
    'e': { 'mbf': '𝐞', 'mit': '𝑒', 'mbfit': '𝒆', 'msans': '𝖾', 'mbfsans': '𝗲', 'mitsans': '𝘦', 'mbfitsans': '𝙚', 'mscr': 'ℯ', 'mbfscr': '𝓮', 'mfrak': '𝔢', 'mbffrak': '𝖊', 'mtt': '𝚎', 'Bbb': '𝕖' },
    'f': { 'mbf': '𝐟', 'mit': '𝑓', 'mbfit': '𝒇', 'msans': '𝖿', 'mbfsans': '𝗳', 'mitsans': '𝘧', 'mbfitsans': '𝙛', 'mscr': '𝒻', 'mbfscr': '𝓯', 'mfrak': '𝔣', 'mbffrak': '𝖋', 'mtt': '𝚏', 'Bbb': '𝕗' },
    'g': { 'mbf': '𝐠', 'mit': '𝑔', 'mbfit': '𝒈', 'msans': '𝗀', 'mbfsans': '𝗴', 'mitsans': '𝘨', 'mbfitsans': '𝙜', 'mscr': 'ℊ', 'mbfscr': '𝓰', 'mfrak': '𝔤', 'mbffrak': '𝖌', 'mtt': '𝚐', 'Bbb': '𝕘' },
    'h': { 'mbf': '𝐡', 'mit': 'ℎ', 'mbfit': '𝒉', 'msans': '𝗁', 'mbfsans': '𝗵', 'mitsans': '𝘩', 'mbfitsans': '𝙝', 'mscr': '𝒽', 'mbfscr': '𝓱', 'mfrak': '𝔥', 'mbffrak': '𝖍', 'mtt': '𝚑', 'Bbb': '𝕙' },
    'i': { 'mbf': '𝐢', 'mit': '𝑖', 'mbfit': '𝒊', 'msans': '𝗂', 'mbfsans': '𝗶', 'mitsans': '𝘪', 'mbfitsans': '𝙞', 'mscr': '𝒾', 'mbfscr': '𝓲', 'mfrak': '𝔦', 'mbffrak': '𝖎', 'mtt': '𝚒', 'Bbb': '𝕚' },
    'j': { 'mbf': '𝐣', 'mit': '𝑗', 'mbfit': '𝒋', 'msans': '𝗃', 'mbfsans': '𝗷', 'mitsans': '𝘫', 'mbfitsans': '𝙟', 'mscr': '𝒿', 'mbfscr': '𝓳', 'mfrak': '𝔧', 'mbffrak': '𝖏', 'mtt': '𝚓', 'Bbb': '𝕛' },
    'k': { 'mbf': '𝐤', 'mit': '𝑘', 'mbfit': '𝒌', 'msans': '𝗄', 'mbfsans': '𝗸', 'mitsans': '𝘬', 'mbfitsans': '𝙠', 'mscr': '𝓀', 'mbfscr': '𝓴', 'mfrak': '𝔨', 'mbffrak': '𝖐', 'mtt': '𝚔', 'Bbb': '𝕜' },
    'l': { 'mbf': '𝐥', 'mit': '𝑙', 'mbfit': '𝒍', 'msans': '𝗅', 'mbfsans': '𝗹', 'mitsans': '𝘭', 'mbfitsans': '𝙡', 'mscr': '𝓁', 'mbfscr': '𝓵', 'mfrak': '𝔩', 'mbffrak': '𝖑', 'mtt': '𝚕', 'Bbb': '𝕝' },
    'm': { 'mbf': '𝐦', 'mit': '𝑚', 'mbfit': '𝒎', 'msans': '𝗆', 'mbfsans': '𝗺', 'mitsans': '𝘮', 'mbfitsans': '𝙢', 'mscr': '𝓂', 'mbfscr': '𝓶', 'mfrak': '𝔪', 'mbffrak': '𝖒', 'mtt': '𝚖', 'Bbb': '𝕞' },
    'n': { 'mbf': '𝐧', 'mit': '𝑛', 'mbfit': '𝒏', 'msans': '𝗇', 'mbfsans': '𝗻', 'mitsans': '𝘯', 'mbfitsans': '𝙣', 'mscr': '𝓃', 'mbfscr': '𝓷', 'mfrak': '𝔫', 'mbffrak': '𝖓', 'mtt': '𝚗', 'Bbb': '𝕟' },
    'o': { 'mbf': '𝐨', 'mit': '𝑜', 'mbfit': '𝒐', 'msans': '𝗈', 'mbfsans': '𝗼', 'mitsans': '𝘰', 'mbfitsans': '𝙤', 'mscr': 'ℴ', 'mbfscr': '𝓸', 'mfrak': '𝔬', 'mbffrak': '𝖔', 'mtt': '𝚘', 'Bbb': '𝕠' },
    'p': { 'mbf': '𝐩', 'mit': '𝑝', 'mbfit': '𝒑', 'msans': '𝗉', 'mbfsans': '𝗽', 'mitsans': '𝘱', 'mbfitsans': '𝙥', 'mscr': '𝓅', 'mbfscr': '𝓹', 'mfrak': '𝔭', 'mbffrak': '𝖕', 'mtt': '𝚙', 'Bbb': '𝕡' },
    'q': { 'mbf': '𝐪', 'mit': '𝑞', 'mbfit': '𝒒', 'msans': '𝗊', 'mbfsans': '𝗾', 'mitsans': '𝘲', 'mbfitsans': '𝙦', 'mscr': '𝓆', 'mbfscr': '𝓺', 'mfrak': '𝔮', 'mbffrak': '𝖖', 'mtt': '𝚚', 'Bbb': '𝕢' },
    'r': { 'mbf': '𝐫', 'mit': '𝑟', 'mbfit': '𝒓', 'msans': '𝗋', 'mbfsans': '𝗿', 'mitsans': '𝘳', 'mbfitsans': '𝙧', 'mscr': '𝓇', 'mbfscr': '𝓻', 'mfrak': '𝔯', 'mbffrak': '𝖗', 'mtt': '𝚛', 'Bbb': '𝕣' },
    's': { 'mbf': '𝐬', 'mit': '𝑠', 'mbfit': '𝒔', 'msans': '𝗌', 'mbfsans': '𝘀', 'mitsans': '𝘴', 'mbfitsans': '𝙨', 'mscr': '𝓈', 'mbfscr': '𝓼', 'mfrak': '𝔰', 'mbffrak': '𝖘', 'mtt': '𝚜', 'Bbb': '𝕤' },
    't': { 'mbf': '𝐭', 'mit': '𝑡', 'mbfit': '𝒕', 'msans': '𝗍', 'mbfsans': '𝘁', 'mitsans': '𝘵', 'mbfitsans': '𝙩', 'mscr': '𝓉', 'mbfscr': '𝓽', 'mfrak': '𝔱', 'mbffrak': '𝖙', 'mtt': '𝚝', 'Bbb': '𝕥' },
    'u': { 'mbf': '𝐮', 'mit': '𝑢', 'mbfit': '𝒖', 'msans': '𝗎', 'mbfsans': '𝘂', 'mitsans': '𝘶', 'mbfitsans': '𝙪', 'mscr': '𝓊', 'mbfscr': '𝓾', 'mfrak': '𝔲', 'mbffrak': '𝖚', 'mtt': '𝚞', 'Bbb': '𝕦' },
    'v': { 'mbf': '𝐯', 'mit': '𝑣', 'mbfit': '𝒗', 'msans': '𝗏', 'mbfsans': '𝘃', 'mitsans': '𝘷', 'mbfitsans': '𝙫', 'mscr': '𝓋', 'mbfscr': '𝓿', 'mfrak': '𝔳', 'mbffrak': '𝖛', 'mtt': '𝚟', 'Bbb': '𝕧' },
    'w': { 'mbf': '𝐰', 'mit': '𝑤', 'mbfit': '𝒘', 'msans': '𝗐', 'mbfsans': '𝘄', 'mitsans': '𝘸', 'mbfitsans': '𝙬', 'mscr': '𝓌', 'mbfscr': '𝔀', 'mfrak': '𝔴', 'mbffrak': '𝖜', 'mtt': '𝚠', 'Bbb': '𝕨' },
    'x': { 'mbf': '𝐱', 'mit': '𝑥', 'mbfit': '𝒙', 'msans': '𝗑', 'mbfsans': '𝘅', 'mitsans': '𝘹', 'mbfitsans': '𝙭', 'mscr': '𝓍', 'mbfscr': '𝔁', 'mfrak': '𝔵', 'mbffrak': '𝖝', 'mtt': '𝚡', 'Bbb': '𝕩' },
    'y': { 'mbf': '𝐲', 'mit': '𝑦', 'mbfit': '𝒚', 'msans': '𝗒', 'mbfsans': '𝘆', 'mitsans': '𝘺', 'mbfitsans': '𝙮', 'mscr': '𝓎', 'mbfscr': '𝔂', 'mfrak': '𝔶', 'mbffrak': '𝖞', 'mtt': '𝚢', 'Bbb': '𝕪' },
    'z': { 'mbf': '𝐳', 'mit': '𝑧', 'mbfit': '𝒛', 'msans': '𝗓', 'mbfsans': '𝘇', 'mitsans': '𝘻', 'mbfitsans': '𝙯', 'mscr': '𝓏', 'mbfscr': '𝔃', 'mfrak': '𝔷', 'mbffrak': '𝖟', 'mtt': '𝚣', 'Bbb': '𝕫' },
    'ı': { 'mit': '𝚤' },
    'ȷ': { 'mit': '𝚥' },
    'Α': { 'mbf': '𝚨', 'mit': '𝛢', 'mbfit': '𝜜', 'mbfsans': '𝝖', 'mbfitsans': '𝞐' },
    'Β': { 'mbf': '𝚩', 'mit': '𝛣', 'mbfit': '𝜝', 'mbfsans': '𝝗', 'mbfitsans': '𝞑' },
    'Γ': { 'mbf': '𝚪', 'mit': '𝛤', 'mbfit': '𝜞', 'mbfsans': '𝝘', 'mbfitsans': '𝞒' },
    'Δ': { 'mbf': '𝚫', 'mit': '𝛥', 'mbfit': '𝜟', 'mbfsans': '𝝙', 'mbfitsans': '𝞓' },
    'Ε': { 'mbf': '𝚬', 'mit': '𝛦', 'mbfit': '𝜠', 'mbfsans': '𝝚', 'mbfitsans': '𝞔' },
    'Ζ': { 'mbf': '𝚭', 'mit': '𝛧', 'mbfit': '𝜡', 'mbfsans': '𝝛', 'mbfitsans': '𝞕' },
    'Η': { 'mbf': '𝚮', 'mit': '𝛨', 'mbfit': '𝜢', 'mbfsans': '𝝜', 'mbfitsans': '𝞖' },
    'Θ': { 'mbf': '𝚯', 'mit': '𝛩', 'mbfit': '𝜣', 'mbfsans': '𝝝', 'mbfitsans': '𝞗' },
    'Ι': { 'mbf': '𝚰', 'mit': '𝛪', 'mbfit': '𝜤', 'mbfsans': '𝝞', 'mbfitsans': '𝞘' },
    'Κ': { 'mbf': '𝚱', 'mit': '𝛫', 'mbfit': '𝜥', 'mbfsans': '𝝟', 'mbfitsans': '𝞙' },
    'Λ': { 'mbf': '𝚲', 'mit': '𝛬', 'mbfit': '𝜦', 'mbfsans': '𝝠', 'mbfitsans': '𝞚' },
    'Μ': { 'mbf': '𝚳', 'mit': '𝛭', 'mbfit': '𝜧', 'mbfsans': '𝝡', 'mbfitsans': '𝞛' },
    'Ν': { 'mbf': '𝚴', 'mit': '𝛮', 'mbfit': '𝜨', 'mbfsans': '𝝢', 'mbfitsans': '𝞜' },
    'Ξ': { 'mbf': '𝚵', 'mit': '𝛯', 'mbfit': '𝜩', 'mbfsans': '𝝣', 'mbfitsans': '𝞝' },
    'Ο': { 'mbf': '𝚶', 'mit': '𝛰', 'mbfit': '𝜪', 'mbfsans': '𝝤', 'mbfitsans': '𝞞' },
    'Π': { 'mbf': '𝚷', 'mit': '𝛱', 'mbfit': '𝜫', 'mbfsans': '𝝥', 'mbfitsans': '𝞟' },
    'Ρ': { 'mbf': '𝚸', 'mit': '𝛲', 'mbfit': '𝜬', 'mbfsans': '𝝦', 'mbfitsans': '𝞠' },
    'ϴ': { 'mbf': '𝚹', 'mit': '𝛳', 'mbfit': '𝜭', 'mbfsans': '𝝧', 'mbfitsans': '𝞡' },
    'Σ': { 'mbf': '𝚺', 'mit': '𝛴', 'mbfit': '𝜮', 'mbfsans': '𝝨', 'mbfitsans': '𝞢' },
    'Τ': { 'mbf': '𝚻', 'mit': '𝛵', 'mbfit': '𝜯', 'mbfsans': '𝝩', 'mbfitsans': '𝞣' },
    'Υ': { 'mbf': '𝚼', 'mit': '𝛶', 'mbfit': '𝜰', 'mbfsans': '𝝪', 'mbfitsans': '𝞤' },
    'Φ': { 'mbf': '𝚽', 'mit': '𝛷', 'mbfit': '𝜱', 'mbfsans': '𝝫', 'mbfitsans': '𝞥' },
    'Χ': { 'mbf': '𝚾', 'mit': '𝛸', 'mbfit': '𝜲', 'mbfsans': '𝝬', 'mbfitsans': '𝞦' },
    'Ψ': { 'mbf': '𝚿', 'mit': '𝛹', 'mbfit': '𝜳', 'mbfsans': '𝝭', 'mbfitsans': '𝞧' },
    'Ω': { 'mbf': '𝛀', 'mit': '𝛺', 'mbfit': '𝜴', 'mbfsans': '𝝮', 'mbfitsans': '𝞨' },
    '∇': { 'mbf': '𝛁', 'mit': '𝛻', 'mbfit': '𝜵', 'mbfsans': '𝝯', 'mbfitsans': '𝞩' },
    'α': { 'mbf': '𝛂', 'mit': '𝛼', 'mbfit': '𝜶', 'mbfsans': '𝝰', 'mbfitsans': '𝞪' },
    'β': { 'mbf': '𝛃', 'mit': '𝛽', 'mbfit': '𝜷', 'mbfsans': '𝝱', 'mbfitsans': '𝞫' },
    'γ': { 'mbf': '𝛄', 'mit': '𝛾', 'mbfit': '𝜸', 'mbfsans': '𝝲', 'mbfitsans': '𝞬' },
    'δ': { 'mbf': '𝛅', 'mit': '𝛿', 'mbfit': '𝜹', 'mbfsans': '𝝳', 'mbfitsans': '𝞭' },
    'ε': { 'mbf': '𝛆', 'mit': '𝜀', 'mbfit': '𝜺', 'mbfsans': '𝝴', 'mbfitsans': '𝞮' },
    'ζ': { 'mbf': '𝛇', 'mit': '𝜁', 'mbfit': '𝜻', 'mbfsans': '𝝵', 'mbfitsans': '𝞯' },
    'η': { 'mbf': '𝛈', 'mit': '𝜂', 'mbfit': '𝜼', 'mbfsans': '𝝶', 'mbfitsans': '𝞰' },
    'θ': { 'mbf': '𝛉', 'mit': '𝜃', 'mbfit': '𝜽', 'mbfsans': '𝝷', 'mbfitsans': '𝞱' },
    'ι': { 'mbf': '𝛊', 'mit': '𝜄', 'mbfit': '𝜾', 'mbfsans': '𝝸', 'mbfitsans': '𝞲' },
    'κ': { 'mbf': '𝛋', 'mit': '𝜅', 'mbfit': '𝜿', 'mbfsans': '𝝹', 'mbfitsans': '𝞳' },
    'λ': { 'mbf': '𝛌', 'mit': '𝜆', 'mbfit': '𝝀', 'mbfsans': '𝝺', 'mbfitsans': '𝞴' },
    'μ': { 'mbf': '𝛍', 'mit': '𝜇', 'mbfit': '𝝁', 'mbfsans': '𝝻', 'mbfitsans': '𝞵' },
    'ν': { 'mbf': '𝛎', 'mit': '𝜈', 'mbfit': '𝝂', 'mbfsans': '𝝼', 'mbfitsans': '𝞶' },
    'ξ': { 'mbf': '𝛏', 'mit': '𝜉', 'mbfit': '𝝃', 'mbfsans': '𝝽', 'mbfitsans': '𝞷' },
    'ο': { 'mbf': '𝛐', 'mit': '𝜊', 'mbfit': '𝝄', 'mbfsans': '𝝾', 'mbfitsans': '𝞸' },
    'π': { 'mbf': '𝛑', 'mit': '𝜋', 'mbfit': '𝝅', 'mbfsans': '𝝿', 'mbfitsans': '𝞹' },
    'ρ': { 'mbf': '𝛒', 'mit': '𝜌', 'mbfit': '𝝆', 'mbfsans': '𝞀', 'mbfitsans': '𝞺' },
    'ς': { 'mbf': '𝛓', 'mit': '𝜍', 'mbfit': '𝝇', 'mbfsans': '𝞁', 'mbfitsans': '𝞻' },
    'σ': { 'mbf': '𝛔', 'mit': '𝜎', 'mbfit': '𝝈', 'mbfsans': '𝞂', 'mbfitsans': '𝞼' },
    'τ': { 'mbf': '𝛕', 'mit': '𝜏', 'mbfit': '𝝉', 'mbfsans': '𝞃', 'mbfitsans': '𝞽' },
    'υ': { 'mbf': '𝛖', 'mit': '𝜐', 'mbfit': '𝝊', 'mbfsans': '𝞄', 'mbfitsans': '𝞾' },
    'φ': { 'mbf': '𝛗', 'mit': '𝜑', 'mbfit': '𝝋', 'mbfsans': '𝞅', 'mbfitsans': '𝞿' },
    'χ': { 'mbf': '𝛘', 'mit': '𝜒', 'mbfit': '𝝌', 'mbfsans': '𝞆', 'mbfitsans': '𝟀' },
    'ψ': { 'mbf': '𝛙', 'mit': '𝜓', 'mbfit': '𝝍', 'mbfsans': '𝞇', 'mbfitsans': '𝟁' },
    'ω': { 'mbf': '𝛚', 'mit': '𝜔', 'mbfit': '𝝎', 'mbfsans': '𝞈', 'mbfitsans': '𝟂' },
    '∂': { 'mbf': '𝛛', 'mit': '𝜕', 'mbfit': '𝝏', 'mbfsans': '𝞉', 'mbfitsans': '𝟃' },
    'ϵ': { 'mbf': '𝛜', 'mit': '𝜖', 'mbfit': '𝝐', 'mbfsans': '𝞊', 'mbfitsans': '𝟄' },
    'ϑ': { 'mbf': '𝛝', 'mit': '𝜗', 'mbfit': '𝝑', 'mbfsans': '𝞋', 'mbfitsans': '𝟅' },
    'ϰ': { 'mbf': '𝛞', 'mit': '𝜘', 'mbfit': '𝝒', 'mbfsans': '𝞌', 'mbfitsans': '𝟆' },
    'ϕ': { 'mbf': '𝛟', 'mit': '𝜙', 'mbfit': '𝝓', 'mbfsans': '𝞍', 'mbfitsans': '𝟇' },
    'ϱ': { 'mbf': '𝛠', 'mit': '𝜚', 'mbfit': '𝝔', 'mbfsans': '𝞎', 'mbfitsans': '𝟈' },
    'ϖ': { 'mbf': '𝛡', 'mit': '𝜛', 'mbfit': '𝝕', 'mbfsans': '𝞏', 'mbfitsans': '𝟉' },
    'Ϝ': { 'mbf': '𝟊' },
    'ϝ': { 'mbf': '𝟋' },
    '0': { 'mbf': '𝟎', 'Bbb': '𝟘', 'msans': '𝟢', 'mbfsans': '𝟬', 'mtt': '𝟶' },
    '1': { 'mbf': '𝟏', 'Bbb': '𝟙', 'msans': '𝟣', 'mbfsans': '𝟭', 'mtt': '𝟷' },
    '2': { 'mbf': '𝟐', 'Bbb': '𝟚', 'msans': '𝟤', 'mbfsans': '𝟮', 'mtt': '𝟸' },
    '3': { 'mbf': '𝟑', 'Bbb': '𝟛', 'msans': '𝟥', 'mbfsans': '𝟯', 'mtt': '𝟹' },
    '4': { 'mbf': '𝟒', 'Bbb': '𝟜', 'msans': '𝟦', 'mbfsans': '𝟰', 'mtt': '𝟺' },
    '5': { 'mbf': '𝟓', 'Bbb': '𝟝', 'msans': '𝟧', 'mbfsans': '𝟱', 'mtt': '𝟻' },
    '6': { 'mbf': '𝟔', 'Bbb': '𝟞', 'msans': '𝟨', 'mbfsans': '𝟲', 'mtt': '𝟼' },
    '7': { 'mbf': '𝟕', 'Bbb': '𝟟', 'msans': '𝟩', 'mbfsans': '𝟳', 'mtt': '𝟽' },
    '8': { 'mbf': '𝟖', 'Bbb': '𝟠', 'msans': '𝟪', 'mbfsans': '𝟴', 'mtt': '𝟾' },
    '9': { 'mbf': '𝟗', 'Bbb': '𝟡', 'msans': '𝟫', 'mbfsans': '𝟵', 'mtt': '𝟿' },
    '\u0627': {'mloop': '\u{1EE80}'},
    '\u0628': {'misol': '\u{1EE01}', 'minit': '\u{1EE21}', 'mstrc': '\u{1EE61}', 'mloop': '\u{1EE81}', 'Bbb': '\u{1EEA1}'},
    '\u062A': {'misol': '\u{1EE15}', 'minit': '\u{1EE35}', 'mstrc': '\u{1EE75}', 'mloop': '\u{1EE95}', 'Bbb': '\u{1EEB5}'},
    '\u062B': {'misol': '\u{1EE16}', 'minit': '\u{1EE36}', 'mstrc': '\u{1EE76}', 'mloop': '\u{1EE96}', 'Bbb': '\u{1EEB6}'},
    '\u062C': {'misol': '\u{1EE02}', 'minit': '\u{1EE22}', 'mtail': '\u{1EE42}', 'mstrc': '\u{1EE62}', 'mloop': '\u{1EE82}', 'Bbb': '\u{1EEA2}'},
    '\u062D': {'misol': '\u{1EE07}', 'minit': '\u{1EE27}', 'mtail': '\u{1EE47}', 'mstrc': '\u{1EE67}', 'mloop': '\u{1EE87}', 'Bbb': '\u{1EEA7}'},
    '\u062E': {'misol': '\u{1EE17}', 'minit': '\u{1EE37}', 'mtail': '\u{1EE57}', 'mstrc': '\u{1EE77}', 'mloop': '\u{1EE97}', 'Bbb': '\u{1EEB7}'},
    '\u062F': {'misol': '\u{1EE03}', 'mloop': '\u{1EE83}', 'Bbb': '\u{1EEA3}'},
    '\u0630': {'misol': '\u{1EE18}', 'mloop': '\u{1EE98}', 'Bbb': '\u{1EEB8}'},
    '\u0631': {'misol': '\u{1EE13}', 'mloop': '\u{1EE93}', 'Bbb': '\u{1EEB3}'},
    '\u0632': {'misol': '\u{1EE06}', 'mloop': '\u{1EE86}', 'Bbb': '\u{1EEA6}'},
    '\u0633': {'misol': '\u{1EE0E}', 'minit': '\u{1EE2E}', 'mtail': '\u{1EE4E}', 'mstrc': '\u{1EE6E}', 'mloop': '\u{1EE8E}', 'Bbb': '\u{1EEAE}'},
    '\u0634': {'misol': '\u{1EE14}', 'minit': '\u{1EE34}', 'mtail': '\u{1EE54}', 'mstrc': '\u{1EE74}', 'mloop': '\u{1EE94}', 'Bbb': '\u{1EEB4}'},
    '\u0635': {'misol': '\u{1EE11}', 'minit': '\u{1EE31}', 'mtail': '\u{1EE51}', 'mstrc': '\u{1EE71}', 'mloop': '\u{1EE91}', 'Bbb': '\u{1EEB1}'},
    '\u0636': {'misol': '\u{1EE19}', 'minit': '\u{1EE39}', 'mtail': '\u{1EE59}', 'mstrc': '\u{1EE79}', 'mloop': '\u{1EE99}', 'Bbb': '\u{1EEB9}'},
    '\u0637': {'misol': '\u{1EE08}', 'mstrc': '\u{1EE68}', 'mloop': '\u{1EE88}', 'Bbb': '\u{1EEA8}'},
    '\u0638': {'misol': '\u{1EE1A}', 'mstrc': '\u{1EE7A}', 'mloop': '\u{1EE9A}', 'Bbb': '\u{1EEBA}'},
    '\u0639': {'misol': '\u{1EE0F}', 'minit': '\u{1EE2F}', 'mtail': '\u{1EE4F}', 'mstrc': '\u{1EE6F}', 'mloop': '\u{1EE8F}', 'Bbb': '\u{1EEAF}'},
    '\u063A': {'misol': '\u{1EE1B}', 'minit': '\u{1EE3B}', 'mtail': '\u{1EE5B}', 'mstrc': '\u{1EE7B}', 'mloop': '\u{1EE9B}', 'Bbb': '\u{1EEBB}'},
    '\u0641': {'misol': '\u{1EE10}', 'minit': '\u{1EE30}', 'mstrc': '\u{1EE70}', 'mloop': '\u{1EE90}', 'Bbb': '\u{1EEB0}'},
    '\u0642': {'misol': '\u{1EE12}', 'minit': '\u{1EE32}', 'mtail': '\u{1EE52}', 'mstrc': '\u{1EE72}', 'mloop': '\u{1EE92}', 'Bbb': '\u{1EEB2}'},
    '\u0643': {'misol': '\u{1EE0A}', 'minit': '\u{1EE2A}', 'mstrc': '\u{1EE6A}'},
    '\u0644': {'misol': '\u{1EE0B}', 'minit': '\u{1EE2B}', 'mtail': '\u{1EE4B}', 'mloop': '\u{1EE8B}', 'Bbb': '\u{1EEAB}'},
    '\u0645': {'misol': '\u{1EE0C}', 'minit': '\u{1EE2C}', 'mstrc': '\u{1EE6C}', 'mloop': '\u{1EE8C}', 'Bbb': '\u{1EEAC}'},
    '\u0646': {'misol': '\u{1EE0D}', 'minit': '\u{1EE2D}', 'mtail': '\u{1EE4D}', 'mstrc': '\u{1EE6D}', 'mloop': '\u{1EE8D}', 'Bbb': '\u{1EEAD}'},
    '\u0647': {'minit': '\u{1EE24}', 'mstrc': '\u{1EE64}', 'mloop': '\u{1EE84}'},
    '\u0648': {'misol': '\u{1EE05}', 'mloop': '\u{1EE85}', 'Bbb': '\u{1EEA5}'},
    '\u064A': {'misol': '\u{1EE09}', 'minit': '\u{1EE29}', 'mtail': '\u{1EE49}', 'mstrc': '\u{1EE69}', 'mloop': '\u{1EE89}', 'Bbb': '\u{1EEA9}'},
    '\u066E': {'misol': '\u{1EE1C}', 'mstrc': '\u{1EE7C}',},
    '\u066F': {'misol': '\u{1EE1F}', 'mtail': '\u{1EE5F}',},
    '\u06A1': {'misol': '\u{1EE1E}', 'mstrc': '\u{1EE7E}',},
    '\u06BA': {'misol': '\u{1EE1D}', 'mtail': '\u{1EE5D}',},
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
        if (ch in mathFonts && mathStyle in mathFonts[ch]) {
            val += mathFonts[ch][mathStyle]
        } else {
            // ch not currently in Unicode. Let renderer do what it can
            val += ch
            removeAttr = false
        }
    }
    el.textContent = val
    if (removeAttr)
        el.removeAttribute('mathVariant')
}

// Compare tables and code implementations
const variantMaths = []
Object.entries(mathvariants).forEach(([key, value]) => {
    variantMaths[value] = key
})

function test() {
    let failed = 0
    let success = 0

    Object.entries(mathFonts).forEach(([ch, val]) => {
        Object.entries(val).forEach(([font, chT]) => {
            let ch1 = GetMathAlphanumeric(ch, font)
            if (chT != ch1)
                console.log(`ch: ${ch} font ${variantMaths[font]}: ${chT}`)
            if (chT != mathAlphas[variantMaths[font]][ch]) {
                console.log(`ch: ${ch} font ${variantMaths[font]}: ${chT}`)
                console.log(`${mathAlphas[variantMaths[font]][ch]}`)
                failed++
            } else {
                success++
            }
        })
    })
    // Should be 1160 successes (as of Unicode 16.0) and 0 failures
    console.log("success = " + success + ": failed = " + failed)
}

const abjad = [0, 1, -1, 21, 22, 2, 7, 23, 3, 24, 19, 6, 14, 20, 17, 25, 8,
    26, 15, 27, -1, -1, -1, -1, -1, -1, 16, 18, 10, 11, 12, 13, 4, 5, -1, 9]
const dottedChars = '\u066E\u06BA\u06A1\u066F'
//                          minit       mtail       mstrc       mloop       Bbb
const missingCharMask = [0xF5080169, 0x5569157B, 0xA1080869, 0xF0000000, 0xF0000000]
const setsAr = ['misol', 'minit','mtail', 'mstrc', 'mloop', 'Bbb']
const setsDigit = ['mbf', 'Bbb', 'msans', 'mbfsans', 'mtt']
const setsEn = ['mbf', 'mit', 'mbfit', 'mscr', 'mbfscr', 'mfrak', 'Bbb', 'mbffrak', 'msans', 'mbfsans', 'mitsans', 'mbfitsans', 'mtt']
const setsGr = ['mbf', 'mit', 'mbfit', 'mbfsans', 'mbfitsans']
const letterlikeDoubleStruck = {'C':'ℂ','H':'ℍ','N':'ℕ','P':'ℙ','Q':'ℚ','R':'ℝ','Z':'ℤ'}
const letterlikeFraktur = {'C':'ℭ','H':'ℌ','I':'ℑ','R':'ℜ','Z':'ℨ'}
const letterlikeScript = {'B':'ℬ','E':'ℰ','F':'ℱ','H':'ℋ','I':'ℐ','L':'ℒ','M':'ℳ','R':'ℛ','e':'ℯ','g':'ℊ','o':'ℴ'}
const offsetsGr = {'∂':51,'∇':25,'ϴ':17,'ϵ':52,'ϑ':53,'ϰ':54,'ϕ':55,'ϱ':56,'ϖ':57}

function GetMathAlphanumeric(ch, mathStyle) {
    // Return the Unicode math alphanumeric character corresponding to ch and
    // mathStyle. If the target character is missing, return ch. The Unicode
    // math alphanumerics are divided into four categories (English, Greek,
    // digits, and Arabic) each of which contains math-style character sets of
    // specific character counts. This leads to a simple encoding scheme (see
    // the digits category) that's somewhat complicated by exceptions in the
    // letter categories.
    let code = ch.charCodeAt(0)
    let n                                   // Set index

    if (ch >= '0' && ch <= '9') {           // ASCII digits
        code += 0x1D7CE - 0x30              // Get math-digit codepoint
        n = setsDigit.indexOf(mathStyle)
        return n != -1 ? String.fromCodePoint(code + n * 10) : ch
    }

    let chT = ''
    if (/[A-Za-z]/.test(ch)) {              // ASCII letters
		// Handle legacy Unicode Letterlike characters first
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
            return chT

        n = setsEn.indexOf(mathStyle)       // Get set index
		if (n == -1)                        // mathStyle isn't in setsEn
			return ch

		code -= 0x41                        // Compute char offset in set
		if (code > 26)
			code -= 6						// No punct between lower & uppercase

        code += 52 * n + 0x1D400			// Get math alphabetic codepoint
        chT = String.fromCodePoint(code)
		return chT
    }

    if (ch >= '\u0391' && ch <= '\u03F5' || ch == '∂' || ch == '∇') {
        // Greek letters
        if (mathStyle == 'mbf') {
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
                code -= 6                   // Map 𝛼 down to end of UC
        }
        return String.fromCodePoint(code + 58 * n + 0x1D6A8)
    }
    if (code < 0x627)                       // Codes preceding Arabic
        return ch == 'ı'                    // Dotless i and j
            ? '𝚤' : ch == 'ȷ'
            ? '𝚥' : ch

    if (code > 0x6BA)                       // No more chars
        return ch

    // Arabic letters
    n = setsAr.indexOf(mathStyle)
    if (n == -1)
        return ch

    // Translate code from the dictionary order followed approximately in the
    // Unicode Arabic block to the abjad order used by Arabic math alphabetics.
    // Both orders start with aleph, e.g., U+0627
    if (code <= 0x64A) {
        code = abjad[code - 0x0627]
        if (code == -1)
            return ch
    } else {
        code = dottedChars.indexOf(ch)
        if (code == -1)
            return ch
        code += 28                          // Get dotted-char offset
    }
    // Suppress conversion for missing Arabic math characters
    if (mathStyle == 'misol') {
        if (code == 4)
            n = 1                           // Use initial's heh
    } else if ((1 << code) & missingCharMask[n - 1])
        return ch						    // Undefined character
    return String.fromCodePoint(32 * n + code + 0x1EE00)
}

_MathTransforms.add('*[mathvariant]', convertMathvariant);
