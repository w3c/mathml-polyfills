/***
 * Converts an element with a mathvariant attribute other than 'normal' into
 * the same kind of element with the corresponding math-style character(s)
 * and no mathvariant attribute. To test the algorithm against an explicit
 * table, rename mathvariant.js to be mathvariantoriginal.js and rename
 * mathvarianttest.js to be mathvariant.js
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
    // plus possible TeX names for Arabic math alphabets, roundhand, and chancery.
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

    let text = el.textContent
    let val = ''
    let removeAttr = true

    for (let i = 0; i < text.length; i++) {
        let ch = getMathAlphanumeric(text[i], mathStyle)
        if (ch == text[i])                  // Math styled char not in Unicode
            removeAttr = false
        val += ch
    }
    el.textContent = val
    if (removeAttr)
        el.removeAttribute('mathVariant')
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
    // exists, return ch. The Unicode math alphanumerics are divided into four
    // categories (ASCII digits, ASCII letters, Greek letters, and Arabic
    // letters) each of which contains math-style character sets with specific
    // character counts, e.g., 10 for the digit sets. This leads to a simple
    // encoding scheme (see the ASCII digits category) that's a bit complicated
    // by exceptions in the letter categories.
    if (!mathStyle || mathStyle == 'mup')
        return ch                           // No change for upright

    let code = ch.charCodeAt(0)
    let n                                   // Set index

    // ASCII digits
    if (ch >= '0' && ch <= '9') {
        code += 0x1D7CE - 0x30              // Get math-digit codepoint
        n = setsDigit.indexOf(mathStyle)
        return n != -1 ? String.fromCodePoint(code + n * 10) : ch
    }

    // ASCII letters
    if (/[A-Za-z]/.test(ch)) {
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

    // Greek letters
    if (ch >= '\u0391' && ch <= '\u03F5' || ch == '∂' || ch == '∇') {
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
