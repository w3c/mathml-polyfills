// @ts-check
/* -*- Mode: Java; tab-width: 4; indent-tabs-mode:nil; c-basic-offset: 4 -*- */
/* vim: set ts=4 et sw=4 tw=80: */
/*

  Copyright (c) 2020 Neil Soiffer, Talking Cat Software

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

/*
 * lineBreakDisplayMath() is the starting point
 */

import { _MathTransforms, cloneElementWithShadowRoot, convertToPx, MATHML_NS } from '../common/math-transforms.js'

const ORIGINAL_MATH_ATTR = 'data-math-no-linebreaking';
const MTABLE_HAS_LINEBREAKS = 'data-has-linebreaks'

// bit of a hack to pass the info to where it is needed without adding it as a param for several layers of calls
const MTABLE_LINEBREAKS_ATTR = 'data-max-linebreak-width';
const INDENT_ATTRS = 'data-saved-indent-attrs';
const INDENT_AMOUNT = 'data-x-indent';

const ELEMENT_DEPTH = 'data-nesting-depth'

/******* Values used for indenting  *******/

// Value used if it can't find a good alignment char on previous line
const FALLBACK_INDENT_AMOUNT = '3em';


/******* Values used for linebreaking  *******/

// Linebreaking computes a penalty for breaking at a certain point.
// Currently depth of the <mo> and emptiness of the line are used

// Weighting between depth and fill
const DEPTH_PENALTY_TO_FILL_PENALTY_RATIO = 3.0;

// Amount to scale down penalty if labelled as a good break point
const GOOD_PENALTY_SCALE_FACTOR = 3.0;

// Amount to scale up penalty if labelled as a bad break point
const BAD_PENALTY_SCALE_FACTOR = 3.0;

// Ideal amount to fill a line -- typically display equations don't fill a line to "balance" being indented
const LINE_FILL_TARGET = 0.9

const EMBELLISHED_ELEMENT_NAMES = [
    'msub', 'msub', 'msubsup', 'mover', 'munder', 'munderover', 'mfrac', 'mmultiscripts'
]

// Hack to close over the shadowRoot so it can be accessed deep down
var shadowRoot = (function () {
    var root = null;
    var emInPixels = 0;
    var breakWidth = 0

    return {
        set: function (shadow, em, width) {
            root = shadow;
            emInPixels = em;
            breakWidth = width;
        },

        get: function () {
            return root;
        },

        getEmInPixels: function () {
            return emInPixels;
        },

        getBreakWidth: function () {
            return breakWidth;
        }
    };
})();

/**
 * Look first in the shadowRoot for the 'id'; if not found, check the whole document
 * @param {string} id 
 * @returns {Element | null}
 */
function getElementByIdEverywhere(id) {
    const found = shadowRoot.get().getElementById(id);
    if (found) {
        return found;
    }
    return document.getElementById(id);
}

/**
 * Creates a new MathML element
 * @param {string} tagName 
 * @returns {Element}
 */
function newElement(tagName) {
    // Create an empty <mrow>.
    return document.createElementNS(MATHML_NS, tagName);
}

/**
 * Copies the attributes from 'source' to 'target'
 * 'target' is unchanged.
 * @param {Element} target
 * @param {Element} source 
 * @returns {Element}       // target
 */
function copyAttributes(target, source) {
    const attrs = source.attributes;
    for (let i = 0; i < attrs.length; i++) {
        target.setAttribute(attrs[i].name, attrs[i].value);
    }
    return target;
}
/**
 * Looks at 'element' and its ancestors to see if the value is set on an attr; if so, it is returned.
 * @param {Element} element 
 * @param {string} attrName 
 * @param {string} defaultVal
 * @returns {string} 
 */
function getMathMLAttrValueAsString(element, attrName, defaultVal) {
    let lookingForMathElement = true;
    do {
        if (element.hasAttribute(attrName)) {
            return element.getAttribute(attrName);
        }
        lookingForMathElement = (element.tagName !== 'math')
        element = element.parentElement;
    } while (lookingForMathElement);
    return defaultVal;
}

/**
 * @returns {Element}
 */
function createLineBreakMTable() {
    const mtable = newElement('mtable')
    mtable.setAttribute(MTABLE_HAS_LINEBREAKS, "true");
    mtable.setAttribute('displaystyle', "true");        // currently ok because only display math is linebroken
    return mtable;
}

/**
 * 
 * @param {Element} mtd 
 * @returns {boolean}
 */
function isInLineBreakTable(mtd) {
    return mtd.tagName === 'mtd' &&
        mtd.parentElement.tagName === 'mtr' &&
        mtd.parentElement.parentElement.tagName === 'mtable' &&
        mtd.parentElement.parentElement.hasAttribute(MTABLE_HAS_LINEBREAKS);
}

/**
 * 
 * @param {Element} child 
 * @returns {Element}
 */
function createNewTableRowWithChild(child) {
    const mtr = newElement('mtr');
    const mtd = newElement('mtd');
    mtd.appendChild(child);
    mtr.appendChild(mtd);
    return mtr;
}

/**
 * 
 * @param {Element} mo
 * @param {'first' | 'middle' | 'last'}  firstMiddleOrLast
 * @returns {Object}
 */
function computeIndentAttrObject(mo, firstMiddleOrLast) {
    const attrObject = {};

    let linebreakstyle = getMathMLAttrValueAsString(mo, 'linebreakstyle', 'before');
    if (linebreakstyle === 'infixLineBreakStyle') {
        linebreakstyle = getMathMLAttrValueAsString(mo, 'infixLineBreakStyle', 'before');
    }
    attrObject.linebreakstyle = linebreakstyle;

    attrObject.indentAlign = getMathMLAttrValueAsString(mo, 'indentalign', 'auto');
    attrObject.indentShift = getMathMLAttrValueAsString(mo, 'indentshift', '0px');
    if (firstMiddleOrLast == 'first') {
        attrObject.indentAlign = getMathMLAttrValueAsString(mo, 'indentalignfirst', attrObject.indentAlign);
        attrObject.indentShift = getMathMLAttrValueAsString(mo, 'indentshiftfirst', attrObject.indentShift);
    } else if (firstMiddleOrLast === 'last') {
        attrObject.indentAlign = getMathMLAttrValueAsString(mo, 'indentalignlast', attrObject.indentAlign);
        attrObject.indentShift = getMathMLAttrValueAsString(mo, 'indentshiftlast', attrObject.indentShift);
    }
    attrObject.indentShift = convertToPx(mo, attrObject.indentShift);   // do conversion at most once
    attrObject.target = getMathMLAttrValueAsString(mo, 'indenttarget', '');
    attrObject.firstMiddleOrLast = firstMiddleOrLast;
    return attrObject;
}
/**
 * Stores the attrs used for indenting on the 'mtd' so they can be found easily later
 * @param {Element} mtd
 * @param {Element} mo
 */
function storeLineBreakAttrsOnMtd(mtd, mo) {
    /** @type {'first' | 'middle' | 'last'} */
    let firstMiddleOrLast = 'middle';
    if (mtd.parentElement === mtd.parentElement.parentElement.firstElementChild) {
        firstMiddleOrLast = 'first';
    } else if (mtd.parentElement === mtd.parentElement.parentElement.lastElementChild) {
        firstMiddleOrLast = 'last';
    }
    mtd.setAttribute(INDENT_ATTRS, JSON.stringify(computeIndentAttrObject(mo, firstMiddleOrLast)))
}

/**
 * Either create a new (linebreak) mtable with the new table row or if it already exists, add the row
 * It exists if we stopped at a <mtd> and it is an mtable inserted for linebreaking purposes
 * @param {Element} parent              // 'mtd' if stopped in existing table, otherwise some non-mrow element
 * @param {Element} upToBreak           // the first part of the split line
 * @param {Element} afterBreak          // the remainder of the current line
 * @returns {Element}                   // the last row added to the table (one or two rows are created)
 */
function addNewLineBreakRow(parent, upToBreak, afterBreak) {
    const mtr = createNewTableRowWithChild(upToBreak);
    if (isInLineBreakTable(parent)) {
        // upToBreak/afterBreak were the same line, but uptToBreak was split off into a new mrow and is not part of parent
        // parent has the indenting info on it and it applies to the upToBreakLine, so we need to move it over
        copyAttributes(mtr.firstElementChild, parent);
        while (parent.attributes.length > 0) {
            parent.removeAttributeNode(parent.attributes[0]);
        }
        parent.parentElement.parentElement.insertBefore(mtr, parent.parentElement);
        return parent.parentElement;          // parent === afterBreak.parentElement
    } else {
        const mtable = createLineBreakMTable();
        mtable.setAttribute("style", "width: 100%");        // make sure there is room for alignment
        mtable.appendChild(mtr);
        afterBreak.replaceWith(mtable);
        mtable.appendChild(createNewTableRowWithChild(afterBreak));
        return mtable.lastElementChild;
    }
}

/**
 * Splits the line at the 'mo' -- at beginning/end of line depending on 'linebreakstyle'
 * @param {Element} mo      // operator to split
 * @returns {Element}       // the last row added to the table 
 */
function splitLine(mo) {
    // break before the <mo> or after it...
    let linebreakstyle = getMathMLAttrValueAsString(mo, 'linebreakstyle', 'before');
    if (linebreakstyle === 'infixLineBreakStyle') {
        linebreakstyle = getMathMLAttrValueAsString(mo, 'infixLineBreakStyle', 'before');
    }

    // walk up tree from <mo> splitting <mrow>s (mrow structure is preserved)
    let upToBreak = null;           // the first part of the line (the later part stays in the 'mrow's) 
    let breakElement = mo;          // the element we break on as we move to the root

    // FIX: should check operator dictionary to see if 'mo' is infix or if 'form' is set here or on an ancestor
    //      in leu of that, this test to see if there is something on left/right is not a correct infix test (e.g, 2nd '-' in "--a") if not well structured
    if (mo.previousElementSibling !== null && mo.nextElementSibling !== null) {
        mo.setAttribute('form', 'infix');
    }
    let parent = breakElement.parentElement;
    for (; parent.tagName === 'mrow'; parent = parent.parentElement) {
        let newMRow = newElement('mrow');

        // walk across the <mrow> pulling out children and putting them into a new <mrow>
        while (parent.firstElementChild) {
            const child = parent.firstElementChild;
            if (child === breakElement) {                       // found the split point
                if (linebreakstyle === 'after') {
                    newMRow.appendChild(child);                 // put on current row
                    linebreakstyle = 'before';                  // everything else is in subsequent row
                    break;
                } else if (linebreakstyle === 'duplicate') {
                    linebreakstyle = 'before';                  // everything else is in subsequent row 
                    newMRow.appendChild(child.cloneNode(true)); // leave 'child' in tree so it starts new line
                }
                // if 'before'/'duplicate', 'child' is at the start of the next row
                break;
            }
            newMRow.appendChild(child);
        }

        breakElement = parent;
        if (upToBreak) {
            newMRow.appendChild(upToBreak);
        }
        upToBreak = (newMRow.children.length === 1) ? newMRow.firstElementChild : newMRow; // avoid needlessly nesting <mrow>s
    }
    if (breakElement.tagName === 'mrow' && breakElement.children.length === 1) {
        const newBreakElement = breakElement.firstElementChild
        breakElement.replaceWith(newBreakElement);       // remove extra mrow (hides <mo>)
        breakElement = newBreakElement;
    }
    return addNewLineBreakRow(parent, upToBreak, breakElement);
}

/**
 * 
 * @param {Element} mo 
 * @returns {Element}
 */
function computeLineBreakRoot(mo) {
    let mrow = mo;
    let parent = mo.parentElement;
    while (parent.tagName === 'mrow' || parent.tagName === 'mstyle' || parent.tagName === 'mpadded') {
        mrow = parent;
        parent = parent.parentElement;
    }
    return mrow;
}

/**
 * Finds all the forced linebreaks, splits the lines, and stores the indent info on the 'mtd'
 * @param {Element} math 
 */
function splitIntoLinesAtForcedBreaks(math, maxLineWidth) {
    const forcedBreakElements = math.querySelectorAll('mo[linebreak="newline"]');
    if (forcedBreakElements.length === 0) {
        // pre-compute depth info since it will be used many times in linebreaking and (auto) indentation
        // do before splitting line because that ruins depth computation for indentation
        return;
    }

    /** @type {Element} */
    let lastRow = null;
    // for each forced linebreak, add a new row to the table
    forcedBreakElements.forEach(mo => {
        lastRow = splitLine(mo);
    })

    // store linebreak info on the <mtd> so we can get it later
    // because the info goes on the line after the <mo>, it is easier to do this in a second pass once all the <mtd>s exist
    const tableChildren = lastRow.parentElement.children;
    storeLineBreakAttrsOnMtd(tableChildren[0].firstElementChild, tableChildren[0].firstElementChild);
    for (let i = 0; i < forcedBreakElements.length; i++) {
        storeLineBreakAttrsOnMtd(tableChildren[i + 1].firstElementChild, forcedBreakElements[i]);
    }
}

/**
 * Returns true if first line of math
 * @param {Element} mtr
 * returns {boolean}
 */
function isFirstRow(mtr) {
    return mtr === mtr.parentElement.firstElementChild;
}

/**
 * Find the leftMostChild not counting an mspace
 * @param {Element} element 
 */
function leftMostChild(element) {
    while (element.children.length > 0) {
        element = element.firstElementChild;
    }
    return (element.tagName == 'mspace') ? element.nextElementSibling : element;
}

function isMatchLessThanHalfWay(xStart, indent, maxWidth) {
    return (indent - xStart) <= 0.5 * maxWidth;
}

/**
 * Return the operators that match 'char'. For the match, "+"/"-" match each other 
 * @param {Element[]} operators 
 * @param {string} char 
 * @returns {Element[]}
 */
function filterOnCharMatch(operators, char) {
    if (char === '-') {
        char = '+';
    }
    return operators.filter(function (operator) {
        let opChar = operator.textContent.trim();
        if (opChar === '-') {
            opChar = '+';
        }
        return char === opChar;
    })
}
/**
 * Look through all the previous lines and find a good indent 
 * Potential breakpoints are those 'mo's at the same depth as the 'mo' that starts the current line
 * Preference is given to an 'mo' with the same char (i.e, if we have a '+', find another '+' at the same depth).
 * Of those 'mo' that match, the one with the minimum amount of indent is chosen so that more fits on that line.
 * @param {Element} mtd
 * @returns {number}
 */
function computeAutoShiftAmount(mtd) {
    if (isFirstRow(mtd.parentElement)) {
        return 0;
    }

    const mo = leftMostChild(mtd);
    if (!mo.hasAttribute(ELEMENT_DEPTH)) {
        console.log(`Linebreaking error: depth not set on ${mo.tagName} with content '${mo.textContent.trim()}'`);
    }
    const moDepth = mo.getAttribute(ELEMENT_DEPTH);
    const moChar = mo.textContent.trim();

    let minIndentAmount = 10e20;
    let operatorMatched = false;
    const xStart = mtd.getBoundingClientRect().left;
    const maxWidth = parseFloat(mtd.parentElement.parentElement.getAttribute(MTABLE_LINEBREAKS_ATTR));     // stored on mtable
    let previousLine = mtd.parentElement.previousElementSibling;
    while (previousLine) {
        const previousLineOperators = getAllBreakPoints(previousLine.firstElementChild).filter(
            operator => moDepth === operator.getAttribute(ELEMENT_DEPTH)
        );
        const prevChar = previousLineOperators.length === 0 ? 'none' : previousLineOperators[0].textContent.trim();
        const previousLineMatches = filterOnCharMatch(previousLineOperators, moChar);
        let indent = previousLineMatches.length === 0 ? minIndentAmount : previousLineMatches[0].getBoundingClientRect().left;
        if (isMatchLessThanHalfWay(xStart, indent, maxWidth)) {
            // characters match
            if (indent < minIndentAmount || !operatorMatched) {
                operatorMatched = true;
                minIndentAmount = indent;
            }
        }
        indent = previousLineOperators.length === 0 ? minIndentAmount : previousLineOperators[0].getBoundingClientRect().left;
        if (!operatorMatched && isMatchLessThanHalfWay(xStart, indent, maxWidth)) {
            minIndentAmount = Math.min(indent, minIndentAmount);
        }

        previousLine = previousLine.previousElementSibling;
    }

    // if there were no matches, do a fixed amount of indents
    if (minIndentAmount == 10e20) {
        return convertToPx(mo, FALLBACK_INDENT_AMOUNT);
    }
    return minIndentAmount - xStart;
}

/**
 * Adds shift amounts to the mtd
 * The amount is finalized in a pass after linebreaking.
 * It is not done now because center/right alignment positioning would mess up linebreaking
 * @param {Element} mtd
 * @param {string} alignment    // should be one of 'left'|'center'|'right'
 * @param {number} shiftAmount 
 */
function setupLineShifts(mtd, alignment, shiftAmount) {
    mtd.setAttribute('style', `text-align: ${alignment};`);

    // Igalia chrome's core implementation seems to require an mrow around the contents of the mtd (6/2020), so stick mspace in mrow
    const mspace = newElement('mspace');
    mspace.setAttribute('width', shiftAmount.toString() + 'px');
    mtd.setAttribute(INDENT_AMOUNT, shiftAmount.toString());        // save so linebreaking knows where the line starts
    if (mtd.children.length !== 1 || mtd.firstElementChild.tagName !== 'mrow') {
        console.log(`unexpected element '${mtd.firstElementChild.tagName}' encountered while trying to indent line`);
        return;
    }
    const mrow = mtd.firstElementChild;

    if (alignment === 'right') {
        mrow.appendChild(mrow);
    } else {
        // works for both 'left' and 'center'
        mrow.insertBefore(mspace, mrow.firstElementChild);
    }
    return;
}

/**
 * Return the amount of indent that should happen if we break on 'mo'
 * @param {Element} mo          // mo or mtd
 * @param {number} xLineStart 
 * @param {Object} indentAttrs 
 * @returns {number}
 */
function computeIndentAmount(mo, xLineStart, indentAttrs) {
    let indentShiftAsPx = parseFloat(indentAttrs.indentShift);
    let indentAlign = indentAttrs.indentAlign;
    if (indentAlign === 'id') {
        const elementWithID = getElementByIdEverywhere(indentAttrs.target);
        if (elementWithID) {
            return elementWithID.getBoundingClientRect().left - xLineStart + indentShiftAsPx;
        }
        indentAlign = 'auto';
    }

    if (indentAlign == 'auto') {
        if (indentAttrs.firstMiddleOrLast !== 'first') {
            // since it isn't the first line, 'mtd' (in a linebreaking mtable) must be a parent 
            while (mo.tagName !== 'mtd' && !mo.parentElement.parentElement.hasAttribute(MTABLE_HAS_LINEBREAKS)) {
                mo = mo.parentElement;
            }
            indentShiftAsPx += computeAutoShiftAmount(mo);
        }
    }
    return indentShiftAsPx;
}

/**
 * Indent the line
 * @param {Element} mtd 
 */
function indentLine(mtd) {
    if (mtd.hasAttribute(INDENT_AMOUNT)) {
        return;         // already processed
    }
    const indentAttrs = JSON.parse(mtd.getAttribute(INDENT_ATTRS));

    const xLineStart = mtd.getBoundingClientRect().left;
    let indentShiftAsPx = computeIndentAmount(mtd, xLineStart, indentAttrs);
    let indentAlign = indentAttrs.indentAlign;
    if (indentAlign === 'id') {
        const elementWithID = getElementByIdEverywhere(indentAttrs.target);
        if (elementWithID && !mtd.querySelector('#' + indentAttrs.target)) {    // don't try to align with 'id' in same line
            setupLineShifts(mtd, 'left', indentShiftAsPx);
            return;
        }
        indentAlign = 'auto';
    }

    if (indentAlign == 'auto') {
        indentAlign = 'left';
    }
    setupLineShifts(mtd, indentAlign, indentShiftAsPx);
    return;
}

/**
 * Returns the outermost embellishment of an 'mo'
 * @param {Element} mo 
 * @returns {Element}
 */
function expandToEmbellishedElement(mo) {
    let el = mo;
    let parent = mo.parentElement;
    do {
        if (parent.firstElementChild !== mo || !EMBELLISHED_ELEMENT_NAMES.includes(parent.tagName)) {
            if (el !== mo) {
                if (!mo.hasAttribute(ELEMENT_DEPTH)) {
                    console.log(`Linebreaking error: depth not set on ${mo.tagName} with content '${mo.textContent.trim()}'`);
                }
                el.setAttribute(ELEMENT_DEPTH, mo.getAttribute(ELEMENT_DEPTH));  // lift depth setting
            }
            return el;
        }
        el = parent;
        parent = parent.parentElement;
    } while (parent);
    console.log(`In linebreaking in expandToEmbellishedElement: unexpected loop termination. mo = '${mo.tagName}'`)
    return mo;      // shouldn't get here
}

/**
 * Return all the potential break points inside 'element' (math or mtd)
 * @param {Element} element 
 * @returns {Element[]}
 */
function getAllBreakPoints(element) {
    // FIX: only want <mo> not in 2-d elements -- grabbing all and trying to cleanup seems wasteful
    const allMos = Array.from(element.querySelectorAll('mo:not([linebreak="nobreak"])'));
    const linebreakMos = allMos.filter(mo => {
        do {
            mo = mo.parentElement;
        } while (mo.tagName === 'mrow' || mo.tagName === 'mstyle' || mo.tagName === 'mpadded'); // assumes mfenced has been polyfilled already
        return mo.tagName === 'math' || isInLineBreakTable(mo);
    })
    return linebreakMos.map(mo => expandToEmbellishedElement(mo));
}

// FIX: the precedence table needs to be imported from the spec. This trivial one is for testing.
const InvisibleTimes = '\u2062';
const InvisibleFunctionApply = '\u2061';
const PrecedenceTable = {
    '(': 0,
    ')': 0,
    '=': 10,
    '+': 30,
    '±': 30,
    '-': 30,
    '*': 40,
    '×': 40,
    InvisibleTimes: 40,
    InvisibleFunctionApply: 50
}

//FIX: the list of open chars needs to come from the spec
const OpenList = [
    '(', '[', '{'
]

//FIX: the list of close chars needs to come from the spec
const CloseList = [
    ')', ']', '}'
]

/**
 * 
 * @param {string} ch 
 * @returns number
 */
function operatorPrecedence(ch) {
    // FIX: replace with real lookup
    const precedence = PrecedenceTable[ch];
    if (precedence === undefined) {
        return 40;      // FIX: not sure what value should be used
    }
    return precedence;
}

/**
 * 
 * @param {Element} el 
 * @returns {Element}
 */
function getEmbellishedOperator(el) {
    if (el.tagName === 'mo') {
        return el;
    }

    let firstChild = el;
    while (EMBELLISHED_ELEMENT_NAMES.includes(firstChild.tagName)) {
        firstChild = firstChild.firstElementChild;
        if (!firstChild) {
            return el;
        }
    }
    return firstChild.tagName === 'mo' ? firstChild : el;
}

/**
 * 
 * @param {[any]} stack
 * @returns {any}
 */
function top(stack) {
    return stack[stack.length - 1];
}

/**
 * 
 * @param {[] | Element} elementStackEntry 
 * @returns {boolean}
 */
function isOperand(elementStackEntry) {
    return Array.isArray(elementStackEntry);
}

/**
 * 
 * @param {string} mo
 * @returns {boolean}
 */
function isPrefix(mo) {
    // FIX: include prefix ops in this; might need to pass in whether char before is operand
    return OpenList.includes(mo);
}

/**
 * The "reduce" step of parsing.
 * @param {[number]} opStack
 * @param {[Element | [Element]]} elementStack
 * @param {number} childPrecedence
 * @returns {[[number], [Element | [Element]]}

 */
function parseReduce(opStack, elementStack, childPrecedence) {
    // FIX: really need to include prefix/postfix info
    let stackPrecedence = top(opStack);
    let previousStackPrecedence = stackPrecedence + 1;          // needs to start with different value
    while (childPrecedence < stackPrecedence) {                // stack never reaches length zero due to initial value
        let iPopTo = elementStack.length - 1;                  // we need to pop at least one element
        while (Array.isArray(elementStack[iPopTo])) {          // pop any "operands" (items already reduced to an "mrow") 
            iPopTo--;
        }
        // iPopTo now points to operator corresponding to top of opStack. Pop that from elementStack and any more operands
        iPopTo--;
        opStack.pop();
        while (Array.isArray(elementStack[iPopTo])) {          // pop any "operands" (items already reduced to an "mrow") 
            iPopTo--;
        }
        // iPopTo now points to the operator that should be on top of the elementStack
        const elementsPopped = elementStack.splice(iPopTo + 1);
        if (stackPrecedence === previousStackPrecedence &&                      // n-ary
            Array.isArray(top(elementsPopped))) {         // not first reduction
            const lastElement = elementsPopped.pop();
            elementStack.push(elementsPopped.concat(lastElement));
        } else {
            elementStack.push(elementsPopped);
        }
        previousStackPrecedence = stackPrecedence;
        stackPrecedence = top(opStack);
    }
    return [opStack, elementStack];
}

const InvisibleFunctionApplyMo = ( function() {
    const mo = document.createElementNS(MATHML_NS, 'mo');
    mo.textContent = InvisibleFunctionApply;
    return mo;
});

function addInvisibleFunctionApply(opStack, elementStack) {
    // reduce if need be, then push
    const childPrecedence = operatorPrecedence(InvisibleFunctionApply);
    [opStack, elementStack] = parseReduce(opStack, elementStack, childPrecedence);
    opStack.push(childPrecedence);
    elementStack.push(InvisibleFunctionApplyMo);
}

/**
 * @param {Element} treeRoot 
 * @param {[number]} opStack
 * @param {[Element | [Element]]} elementStack
 * @returns {[[number], [Element | [Element]]}
 */
function buildParseTree(treeRoot, opStack, elementStack) {
    // Act like a operator precedence parser, where operator precedences are shifted on or "reduced" based on their precedence
    // Arrays are treated as operands/something already reduced.
    for (let i = 0; i < treeRoot.children.length; i++) {
        // FIX: might be adorned mrow, so just checking for <mo> is not enough
        const child = getEmbellishedOperator(treeRoot.children[i]);
        if (child.tagName === 'mo') {
            const childCh = child.textContent.trim();
            if (isOperand(top(elementStack)) && isPrefix(childCh)) {
                // operand/operand -- need to add either invisible times or function apply, using function apply
                addInvisibleFunctionApply(opStack, elementStack);
            }

            if (isPrefix(childCh)) {
                opStack.push(0);
                elementStack.push(child);        // push onto the last element (not the stack)
            } else if (CloseList.includes(childCh)) {
                [opStack, elementStack] = parseReduce(opStack, elementStack, 0);
                elementStack.push(child);
                if (top(opStack) !== 0) {
                    console.log(`In linebreaking, parsing error with close char -- top of op stack is ${top(opStack)}`);
                }
                opStack.pop();

                // FIX: need to figure out implicit mult/function call (function call pops more)
                const elementsPopped = elementStack.splice(elementStack.length - 3);
                elementStack.push(elementsPopped);
            } else {
                // reduce if need be, then push
                const childPrecedence = operatorPrecedence(childCh);
                [opStack, elementStack] = parseReduce(opStack, elementStack, childPrecedence);
                opStack.push(childPrecedence);
                elementStack.push(child);
            }
        } else if (child.tagName === 'mrow' || child.tagName === 'mpadded' || child.tagName === 'mstyle') {
            [opStack, elementStack] = buildParseTree(child, opStack, elementStack);
        } else {
            if (isOperand(top(elementStack))) {
                // operand/operand -- need to add either invisible times or function apply, using function apply
                addInvisibleFunctionApply(opStack, elementStack);
            }
            elementStack.push([child]);       // treat as operand/reduced (hence push array)
        }
    }
    return [opStack, elementStack];
}

/**
 * Store nesting depth info for each 'mo' as an attr. Depth is based on depth in tree of arrays
 * @param {[Element | [Element]]} elementStack
 * @param {number} depth
 */
function setDepthAttr(elementStack, depth) {
    elementStack.forEach(child => {
        if (Array.isArray(child)) {
            setDepthAttr(child, depth + 1);
        } else if (child.tagName === 'mo') {
            child.setAttribute(ELEMENT_DEPTH, depth.toString());
        }
    })
}

/**
 * Tries to determine if there is good mrow structure. If so returns true.
 * @param {Element} mrow
 * @returns {boolean}
 */
function isMRowWellStructured(mrow) {
    if (mrow.childElementCount <= 3) {
        return true;
    }
    // only n-ary with same operator precedence and alternating operand/operator/operand are valid
    if (mrow.childElementCount % 2 === 0) {
        return false;
    }

    const precedence = operatorPrecedence(mrow.children[1].textContent.trim());
    for (let i = 0; i < mrow.childElementCount - 1; i += 2) {
        if (mrow.children[i].tagName === 'mo' ||
            mrow.children[i + 1].tagName !== 'mo' ||
            operatorPrecedence(mrow.children[i + 1].textContent.trim()) !== precedence) {
            return false;
        }
    }
    return true;
}

/**
 * Tries to determine if there is good mrow structure. If so returns true.
 * @param {Element} treeRoot
 * @returns {boolean}
 */
function isWellStructured(treeRoot) {
    // True if there are 3 children or less because this is infix prefix or postfix, and also covers fences but should have just one child.
    // N-ary functions should alternate between operand/operator/operand and the operators all have the same precedence.
    //   this allows for +/-, multiple forms of times, or multiple relations to exist.
    // Especially for n-ary functions, we can't easily tell if this good structure or "luck".
    // We check up to three mrows and if all seem well structured, we say this is well structured.
    const mrows = Array.from(treeRoot.querySelectorAll('mrow'));
    if (treeRoot.tagName === 'mrow' || treeRoot.tagName === 'math') { // could be 'math' with no mrows
        mrows.push(treeRoot);
    }
    switch (mrows.length) {
        case 0:
            return true;
        case 1:
            return isMRowWellStructured(mrows[0]);
        case 2:
            return isMRowWellStructured(mrows[0]) && isMRowWellStructured(mrows[1]);
        default:
            return isMRowWellStructured(mrows[0]) &&
                isMRowWellStructured(mrows[Math.floor(mrows.length / 2)]) &&
                isMRowWellStructured(mrows[mrows.length - 1]);
    }
}


/**
 * Store nesting depth info for each 'mo' as an attr. Depth is based on depth in tree
 * @param {Element} el
 * @param {number} depth
 */
function setDepthAttrBasedOnOriginalTree(el, depth) {
    const embellishedOp = getEmbellishedOperator(el);
    if (embellishedOp.tagName === 'mo') {
        embellishedOp.setAttribute(ELEMENT_DEPTH, depth.toString());
        return;
    }
    if (el.tagName === 'mrow' || el.tagName === 'mstyle' || el.tagName === 'mpadded' || el.tagName === 'math') {
        for (let i = 0; i < el.childElementCount; i++) {
            setDepthAttrBasedOnOriginalTree(el.children[i], depth + (el.tagName === 'mrow' ? 1 : 0));
        }
    }
}

/**
 * Store nesting depth info for each 'mo' as an attr
 * @param {Element} linebreakRoot 
 */
function addDepthInfo(linebreakRoot) {
    // This works in two passes:
    // 1. For each potential linebreak (include treeRoot), parse tree (array whose children are )
    // 2. Set the depth of the operators in the parse tree

    /** @type {Element[]} */
    let linebreakRoots = [];        // keep track of the things we have already linebroken
    const linebreakElements = Array.from(linebreakRoot.querySelectorAll('mo[linebreak="newline"]'));
    linebreakElements.push(linebreakRoot);                                // add non forced 
    // for each forced linebreak, add a new row to the table
    linebreakElements.forEach(mo => {
        const linebreakRoot = computeLineBreakRoot(mo);
        if (!linebreakRoots.includes(linebreakRoot)) {
            linebreakRoots.push(linebreakRoot);
            // if it looks to be well structured, don't second guess the structure (and save time)
            if (isWellStructured(linebreakRoot)) {
                setDepthAttrBasedOnOriginalTree(linebreakRoot, 0);
            } else {
                let [opStack, elementStack] = buildParseTree(linebreakRoot, [-1], [null]);         // '-1' guarantees stack never gets empty
                if (elementStack.length != 2) {
                    [opStack, elementStack] = parseReduce(opStack, elementStack, -1);
                }
                setDepthAttr(elementStack[1], 0);
            }
        }
    })
}

/********* linebreaking penalty computation *******/
/**
 * Used in penalty computation; 0 <= x <= max
 * @param {number} x 
 * @param {number} xMax
 * @returns {number}
 */
function computeLineFillPenalty(x, xMax) {
    // ideal amount is not necessarily a full line.
    // squaring the distance away steepens the curve/penalty if you move too far away
    const penalty = (LINE_FILL_TARGET * xMax - x) / xMax;
    return penalty * penalty;		// always positive but less than one -- far away is much worse
}

/**
 * Used in penalty computation
 * @param {Element} mo
 * @returns {number}
 */
function computeDepthPenalty(mo) {
    // Use an exponential decay for the penalty function: 1 - 1.1^-depth
    // That gives higher importance to depth changes closer to the root
    // Set up some initial values to avoid expensive computation
    const depthTable = [
        0.050000, 0.090909, 0.173554, 0.248685,
        0.316987, 0.379079, 0.435526, 0.486842,
        0.533493, 0.575902, 0.614457, 0.649506,
        0.681369, 0.710336, 0.736669, 0.760608
    ];

    if (!mo.hasAttribute(ELEMENT_DEPTH)) {
        console.log(`Linebreaking error: depth not set on ${mo.tagName} with content '${mo.textContent.trim()}'`);
    }
    let depth = parseInt(mo.getAttribute(ELEMENT_DEPTH));
    return depth >= depthTable.length ? 1 - 3.482066 / depth : depthTable[depth]; // always less than one
}

/**
 * Computes a penalty based on % line filled, depth in the syntax tree, and whether the user indicated a break here is good/bad
 * @param {Element} mo 
 * @param {number } x 
 * @param {number} xMax 
 * @returns {number}
 */
function computePenalty(mo, x, xMax) {
    const penalty = DEPTH_PENALTY_TO_FILL_PENALTY_RATIO * computeDepthPenalty(mo) + computeLineFillPenalty(x, xMax);
    const linebreakAttrVal = getMathMLAttrValueAsString(mo, 'linebreak', 'auto');
    if (linebreakAttrVal === 'goodbreak') {
        return penalty / GOOD_PENALTY_SCALE_FACTOR;
    } else if (linebreakAttrVal === 'badbreak') {
        return BAD_PENALTY_SCALE_FACTOR * penalty;
    } else {            // 'nobreak' has already been filtered out
        return penalty;
    }
}

/**
 * Handles substitution of char if InvisibleTimes ('linebreakmultchar' mo attr)
 * The array is modified and the node replaced in the DOM
 * @param {Element[]} potentialBreaks
 * @param {number} index                           // index of char in  
 * @returns {Element}                              // the mo @index or it's replacement
 */
function substituteCharIfNeeded(potentialBreaks, index) {
    const mo = potentialBreaks[index];
    if (mo.textContent.trim() === '\u2062' /* invisible times */) {
        const replaceChar = getMathMLAttrValueAsString(mo, 'linebreakmultchar', '\u2062');
        if (replaceChar !== '\u2062') {
            const replacementMO = newElement('mo');
            replacementMO.textContent = replaceChar;
            copyAttributes(replacementMO, mo);
            mo.replaceWith(replacementMO);
            potentialBreaks[index] = replacementMO;
            return replacementMO;
        }
    }
    return mo;
}
/**
 * The entry point to linebreaking
 * @param {Element} element             // <math> or <mtd> (if previously split due to manual linebreak)
 * @param {number} maxLineWidth
 */
function linebreakLine(element, maxLineWidth) {
    // do we need to linebreak this element?
    //console.log(`    linebreakLine: full ${element.getAttribute(FULL_WIDTH)}, max ${maxLineWidth}`)
    if (parseFloat(element.getAttribute(FULL_WIDTH)) <= maxLineWidth) {
        return;
    }

    // collect up all the places (mo's) where the line can break
    const potentialBreaks = getAllBreakPoints(element);

    // Loop through all the potential break points looking for a good spot to break
    // This works by checking each potential break point until the current line is too wide
    // For each potential breakpoint, we compute a "penalty" for breaking there.
    // We keep track of the minimum penalty found for all the elements on the line.
    // After splitting the line, we start again with the next potential breakpoint and repeat the above.
    // The process stops when get to the last potential breakpoint

    // the leftSide can change as linebreaks cause reflow of ancestors
    //    'element' might center/right align mrow inside, so use child's position

    let lineBreakMO;                // the 'mo' used for linebreaking (might be changed if invisible times)
    /** @type {Element} */
    // @ts-ignore
    let lastRow = (element.tagName === 'mtd') ?
        element.parentElement :
        element.parentNode;
    // when a line is split, there are now two of them (actually rows in mtable); this is the last one
    let nLines = 0;                 // really only care if first line, but useful for debugging to know # of lines
    let iOperator = 1;              // start of each line (want at least one element on the first line)
    while (iOperator < potentialBreaks.length) {
        let iLine = iOperator;      // index into current line of breakpoints
        // the amount of room we have is reduced by the indentation if we break here.
        const firstMTD = element.tagName === 'mtd' ? lastRow.firstElementChild : lastRow.lastElementChild;
        const indentAttrs = JSON.parse(firstMTD.getAttribute(INDENT_ATTRS));
        const leftSide = indentAttrs.linebreakstyle === 'before' ?
            potentialBreaks[iOperator - 1].getBoundingClientRect().left :
            firstMTD.firstElementChild.getBoundingClientRect().left;
        const indentAmount = computeIndentAmount(
            potentialBreaks[iOperator - 1],   // where we broke
            firstMTD.getBoundingClientRect().left,
            indentAttrs);
        const lineBreakWidth = maxLineWidth - indentAmount;
        let minPenalty = 100000.0;  // in practice, the numbers don't get over 2
        let iMinPenalty = -1;

        // walk across the current line until it is full
        // keep track of the spot that gives the minimum penalty
        while (iLine < potentialBreaks.length) {
            // FIX: should check breakpoint === invisible times (\u2062) and if linebreakmultchar is not \u2062, include the width of the substitution
            const xRelativePosition = potentialBreaks[iLine].getBoundingClientRect().right - leftSide;
            if (xRelativePosition > lineBreakWidth) {
                break;
            }
            const penalty = computePenalty(potentialBreaks[iLine], xRelativePosition, lineBreakWidth);
            if (penalty <= minPenalty) {
                minPenalty = penalty;
                iMinPenalty = iLine;
            }
            iLine++
        }

        if (iMinPenalty === -1) {
            console.log(`Linebreaking error: no breakpoint found on line ${nLines + 1}`);
            iMinPenalty = iOperator;    // for count to advance
        }
        nLines++;
        iOperator = iMinPenalty + 1;                    // move on to next line

        if (iOperator < potentialBreaks.length) {
            // now that we have a break point, we need to split at that point
            // the creates two rows -- the first one is the line we just processed so we figure out the indentation
            // (there is a little bookkeeping also needed)
            lineBreakMO = substituteCharIfNeeded(potentialBreaks, iMinPenalty);
            lastRow = splitLine(potentialBreaks[iMinPenalty]);
            // only needs to be set once, but the value is needed to compute the indent amount as soon as we aren't on the first line
            lastRow.parentElement.setAttribute(MTABLE_LINEBREAKS_ATTR, maxLineWidth.toString());
            storeLineBreakAttrsOnMtd(lastRow.firstElementChild, lineBreakMO);

            const previousRow = lastRow.previousElementSibling;
            if (!previousRow.firstElementChild.hasAttribute(INDENT_ATTRS)) {
                // created a new mtable -- the indent attrs were on the math element.
                previousRow.firstElementChild.setAttribute(INDENT_ATTRS, element.getAttribute(INDENT_ATTRS));
            }
            indentLine(previousRow.firstElementChild);
        } else if (nLines === 1) {
            // shouldn't get here, but happens if entire expr fits on one line
            return;
        }

        // set value for start of next line
    }
    // all done with linebreaking -- indent the last row
    if (nLines > 0) {
        indentLine(lastRow.firstElementChild);
    }
    return;
}


/**
 * Linebreak/indent display math
 * There is no good target in core, so the following hack is used if linebreaking is needed:
 * 1. The custom element 'math-with-linebreaks' is created as the parent of 'math' if it isn't already there.
 * 2. A clone is made and added into the shadow DOM (avoids duplicate 'id' problems)
 * 3. A marked <mtable> is created at the appropriate point (typically a child of <math>) and each line of the math is a row in the table
 * 
 * On resize, we throw out the old shadow and start from fresh with a clone of the <math> element. 
 * 
 * Since most math doesn't need to be linebroken, we start with a quick check to see if there are forced linebreaks or if it is wide.
 * @param {HTMLElement} math 
 */

/*
 * Note: this is not efficient code due to making changes to the live DOM -- tons of reflow potentially happens,
 *   although most reflow is probably limited in scope except for when a new line is added.
 * It would be useful to measure whether reflow is a majority of the time used for linebreaking.
 * An alternative would be to copy the left/right position of the potential break points to attrs on the corresponding clone's break points.
 * That covers the majority of what needs to be measured. The other cases are:
 *    - the left most child at the start of a line. That is either an operator (hence already marked) for linebreakstyle != 'right'
 *      or the child after an 'mo' for the other linebreak styles (after indenting, it can also be an mspace, but those should be ignored)
 *    - the left/right position of the created line -- that can be computed from the children at the edges when it is created
 *      this means siblings to both the left/right of a potential linebreak should get their left/right position stored
 * Using stored attrs offers a minor code simplification because the code doesn't need to query left/right as often because they don't change.
 * 
 * Another efficiency idea:
 * If we add parsing to get the correct depth of the <mo>s, that might be a little slow, especially for resizing.
 * The mrow structure is important for knowing the depth for indentation alignment and linebreak penalties, but if we add parsing,
 * the structure is not important. That means that we can avoid throwing out the shadow DOM 'math' and instead zip the lines back together.
 * The structure is ruined, but depth computations wouldn't need to be done again.
 */
const SHADOW_ELEMENT_NAME = "math-with-linebreaks";

/**
 * The main starting point
 * @param {Element} customElement        // <math> (likely inside a shadow DOM)
 * @param {number} maxLineWidth
 */
function lineBreakDisplayMath(customElement, maxLineWidth) {
    maxLineWidth = Math.min(maxLineWidth, parseFloat(customElement.getAttribute(FULL_WIDTH)));
    const math = customElement.shadowRoot.lastElementChild;
    if (math.childElementCount > 1) {
        // add an mrow underneath 'math' -- having an mrow makes the rest of the code work more cleanly
        const mrow = newElement('mrow');
        while (math.firstElementChild) {
            mrow.appendChild(math.firstElementChild);
        }
        math.appendChild(mrow);
    }
    //console.log(`  lineBreakDisplayMath: full ${customElement.getAttribute(FULL_WIDTH)}, max ${maxLineWidth}`);

    shadowRoot.set(customElement.shadowRoot);

    splitIntoLinesAtForcedBreaks(math, maxLineWidth);

    // gather up all the parts with forced linebreaks (turned into an array because don't want them live (linebreaking augments them later)
    let linebreakGroups = Array.from(math.querySelectorAll(`mtable[${MTABLE_HAS_LINEBREAKS}]`));
    if (linebreakGroups.length > 0) {
        //console.log(`    ${linebreakGroups.length} forced linebreaks`);
        linebreakGroups.forEach(table => {
            table.setAttribute(MTABLE_LINEBREAKS_ATTR, maxLineWidth.toString());
            const lines = Array.from(table.children);     // don't want a live collection -- messes up with linebreaks adding rows
            lines.forEach(line => {
                const mtd = line.firstElementChild;
                indentLine(mtd);
                if (mtd.firstElementChild.getBoundingClientRect().right - mtd.getBoundingClientRect().left > maxLineWidth) {
                    // the line may still be too long and need to be broken
                    linebreakLine(mtd, maxLineWidth);
                }
            })
        })
    } else if (parseInt(customElement.getAttribute(FULL_WIDTH)) >= maxLineWidth) {
        // no forced breaks, but still need to check for auto breaks
        // they may create some breaks (mtable), and those breaks need indenting
        math.setAttribute(INDENT_ATTRS, JSON.stringify(computeIndentAttrObject(math, 'first')));
        linebreakLine(math, maxLineWidth);
    }
}
// the width before linebreaking *not* taking into account forced linebreaks (set on original math element)
const FULL_WIDTH = 'data-full-width';

// the width to use for linebreaking (set on shadow host)
const LINE_BREAK_WIDTH = 'data-linebreak-width'

// hack to get 'em' width (set on shadow host)
const EM_WIDTH = 'data-em-in-pixels'

/**
 * 
 * @param {Element} customElement 
 * @param {Element} math 
 */
function setShadowRootContents(customElement, math) {
    /** @type {HTMLElement} */
    // @ts-ignore
    const mathClone = cloneElementWithShadowRoot(math);
    customElement.shadowRoot.appendChild(mathClone);
    // keep track of the width before linebreaking
    let fullWidth = mathClone.lastElementChild.getBoundingClientRect().right - mathClone.firstElementChild.getBoundingClientRect().left;
    if (mathClone.hasAttribute('maxwidth')) {
        fullWidth = Math.min(fullWidth, convertToPx(mathClone, mathClone.getAttribute('maxwidth')));
    }
    customElement.setAttribute(FULL_WIDTH, fullWidth.toString());
    lineBreakDisplayMath(customElement, fullWidth);
    customElement.setAttribute(LINE_BREAK_WIDTH, (2 * fullWidth).toString());

    //console.log(`Set... y: ${customElement.getBoundingClientRect().y}; FULL_WIDTH: ${customElement.getAttribute(FULL_WIDTH)}`)
}

function addCustomElement(math) {
    // only handle display math -- inline math requires being able to have a reflow observer, and that doesn't exist
    // even if the display math fit on the current line, if the width shrinks, it might not fit.
    //   we add the custom element with the resize observer so we can tell when that happens.
    const computedStyle = getComputedStyle(math).getPropertyValue('display');
    const displayValue = math.hasAttribute('display') ? math.getAttribute('display') : 'inline';
    if (computedStyle === 'inline' || displayValue === 'inline') {
        return null;
    }

    if (math.tagName.toLowerCase() === SHADOW_ELEMENT_NAME) {
        return math;        // already is a custom element
    } else if (math.parentElement.tagName.toLowerCase() === SHADOW_ELEMENT_NAME) {
        return math;        // already inside a custom element
    } else {
        //console.log(`addCustomElement... math width ${math.getBoundingClientRect().width}`);
        const mathParent = math.parentElement;
        const nextSibling = math.nextElementSibling;
        const shadowHost = document.createElement(SHADOW_ELEMENT_NAME);
        shadowHost.appendChild(math);
        mathParent.insertBefore(shadowHost, nextSibling);
        addDepthInfo(math);
        setShadowRootContents(shadowHost, math);
        return null;
    }
}

_MathTransforms.add('math', addCustomElement);

// @ts-ignore
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        if (entry.target.tagName.toLowerCase() === SHADOW_ELEMENT_NAME) {
            const customElement = entry.target;
            //console.log(`In resize...entry width: ${entry.contentRect.width}; prev width: ${customElement.getAttribute(LINE_BREAK_WIDTH)}; \
            //            FULL ${customElement.getAttribute(FULL_WIDTH)}; $y: ${customElement.getBoundingClientRect().y}`);
            if (entry.contentRect.width < parseInt(customElement.getAttribute(FULL_WIDTH))) {  // room to break is less than full width
                const mathClone = cloneElementWithShadowRoot(customElement.firstElementChild);
                const oldDisplayedMath = customElement.shadowRoot.lastElementChild;
                oldDisplayedMath.replaceWith(mathClone);
                customElement.setAttribute(LINE_BREAK_WIDTH, entry.contentRect.width.toString());
                //console.log("   linebreaking...")
                lineBreakDisplayMath(customElement, entry.contentRect.width.toString());
            } else if (!customElement.hasAttribute(LINE_BREAK_WIDTH) ||
                parseInt(customElement.getAttribute(LINE_BREAK_WIDTH)) <= parseInt(customElement.getAttribute(FULL_WIDTH))) {
                // enough room for line but previous one was linebroken -- don't linebreak
                const mathClone = cloneElementWithShadowRoot(customElement.firstElementChild);
                const oldDisplayedMath = customElement.shadowRoot.lastElementChild;
                oldDisplayedMath.replaceWith(mathClone);
                customElement.setAttribute(LINE_BREAK_WIDTH, (2 * entry.contentRect.width).toString()); // 2*width to make sure no linebreaking
                lineBreakDisplayMath(customElement, 2 * entry.contentRect.width.toString());
            }
            // else enough room and wasn't linebroken
        }
    }
});

// define the custom element in case someone wants to use it directly -- it should have only 'math' as its child
customElements.define(SHADOW_ELEMENT_NAME, class extends HTMLElement {
    constructor() {
        super();

        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(_MathTransforms.getCSSStyleSheet());
        const math = this.firstElementChild;
        //console.log(`in constructor...math width ${math ? math.getBoundingClientRect().width : 'set elsewhere'}`);
        if (math) {
            // SHADOW_ELEMENT_NAME is in doc as opposed to being wrapped around 'math' programmatically 
            addDepthInfo(math);
            setShadowRootContents(this, math);
        }
        resizeObserver.observe(this);
    }
});

{
    let UAStyle = document.createElement('style')
    UAStyle.innerHTML = `
           math-with-linebreaks {
                display: block;
            }
    `
    document.head.insertBefore(UAStyle, document.head.firstElementChild)
}
