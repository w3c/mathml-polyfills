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

_MathTransforms.add('*[mathvariant]', convertMathvariant);
