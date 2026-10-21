/* ---------- Rename in the text pane: what's under the caret ----------
   The menu and the box are components/CodeRename.tsx; this works out whether the word at a place in the pane's text
   is a shape id that can be renamed, and where on screen it's drawn. */
import {S} from './core';
import {splitComment} from './flow/language';
import {TP, applyFromEditor} from './text-pane';

/* A shape id in the text: which page it's on, and where it starts and ends in the whole text */
export type IdAt = { pi: number, id: string, start: number, end: number };

/* Brings the pane's typing up to date first, so ids are looked up in the text as it stands. False if the text has
   errors, and so isn't the document's: there's nothing reliable to rename then. */
export function flowUpToDate(ta: HTMLTextAreaElement): boolean {
    applyFromEditor(true);
    return TP.mode === 'flow' && ta.value.replace(/\r\n?/g, '\n') === S.text;
}

/* The shape id at offset at in the text, if the word there is one: not quoted, not in a comment, and where a
   statement names a shape (its own line, either end of a connection, an [in=]), not a shape type or a setting's
   value that happens to be spelt like an id */
export function idAt(text: string, at: number): IdAt | null {
    if (!S.ast) return null;
    const ls = text.lastIndexOf('\n', at - 1) + 1, nl = text.indexOf('\n', at),
        n = text.slice(0, ls).split('\n').length - 1,
        code = splitComment(text.slice(ls, nl < 0 ? text.length : nl)).code, col = at - ls;
    const pi = S.ast.pages.findIndex(p => n >= (p.headerLine ?? 0) && n <= p.endLine), ap = S.ast.pages[pi];
    const a = S.ast.animation;
    if (pi < 0 && a && n > a.start && n < (a.end ?? Infinity)) {   // in the @animation block: the id after $, -$ or +$,
        const m = code.match(/^(\s*[-+]?\$)([A-Za-z_][\w-]*)/);   // renamed on the one page it's on
        if (!m || col < m[1].length || col > m[0].length) return null;
        const on = S.ast.pages.flatMap((p, i) => p.byId.has(m[2]) ? [i] : []);
        return on.length === 1 ? {pi: on[0], id: m[2], start: ls + m[1].length, end: ls + m[0].length} : null;
    }
    let s = col, e = col;
    while (s > 0 && /[\w-]/.test(code[s - 1])) s--;
    while (e < code.length && /[\w-]/.test(code[e])) e++;
    const id = code.slice(s, e), before = code.slice(0, s);
    if (!ap || !/^[A-Za-z_]/.test(id) || !ap.byId.has(id)) return null;
    if ((before.match(/(?<!\\)"/g) || []).length % 2) return null;   // inside quotes
    const d = ap.byId.get(id)!, edge = ap.edgeByLine.get(n), first = !before.trim();
    const named = (first && (d.line === n || edge?.from === id))
        || (edge?.to === id && /^\s*[A-Za-z_][\w-]*\s+\S+\s+$/.test(before))
        || (/\[[^\]]*\bin\s*=\s*"?$/i.test(before) && ap.shapes.some(x => x.line === n));
    return named ? {pi, id, start: ls + s, end: ls + e} : null;
}

/* Where id's old occurrence at at in before ends up in after, once it and every other occurrence of the same id on
   the page have been renamed to to. Earlier occurrences can change the text's length before at, and later ones on
   the same line can too, so the caret has to be found again rather than kept at the same offset. */
export function renamedOffset(before: string, after: string, at: number, to: string): number {
    const ls = before.lastIndexOf('\n', at - 1) + 1, n = before.slice(0, ls).split('\n').length - 1,
        col = at - ls, bLines = before.split('\n'), aLines = after.split('\n');
    let lsAfter = 0;
    for (let i = 0; i < n && i < aLines.length; i++) lsAfter += aLines[i].length + 1;
    const line = aLines[n] ?? bLines[n] ?? '', isWord = (c: string | undefined) => !!c && /[\w-]/.test(c);
    let best = -1, bestDist = Infinity;
    for (let i = line.indexOf(to); i >= 0; i = line.indexOf(to, i + 1)) {
        if (isWord(line[i - 1]) || isWord(line[i + to.length])) continue;   // part of a longer word
        const d = Math.abs(i - col);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return lsAfter + (best >= 0 ? best : Math.min(col, line.length));
}

/* Where an offset in the pane's text is drawn, in px from the top left of the code area. The code font is
   monospaced with 18 px lines, as the suggestion list assumes too. */
let charW = 0;

export function spotOf(ta: HTMLTextAreaElement, at: number): { top: number, left: number } {
    if (!charW) {
        const c = document.createElement('canvas').getContext('2d');
        if (c) c.font = getComputedStyle(ta).font;
        charW = c?.measureText('0').width || 7.5;
    }
    const before = ta.value.slice(0, at), line = before.split('\n').length - 1,
        col = before.length - before.lastIndexOf('\n') - 1,
        pad = parseFloat(getComputedStyle(ta).paddingLeft) || 10;
    return {top: 8 + line * 18 - ta.scrollTop, left: pad + col * charW - ta.scrollLeft};
}
