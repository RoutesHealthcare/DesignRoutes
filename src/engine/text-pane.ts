/* ---------- the text pane: a tab that can be hidden, opened over the canvas, or pinned beside it ---------- */
import {$, S, kid, kids, svg, toast} from './core';
import {is1D, shapeCtx} from './visio-package';
import {applyView, pageCtx, render, renderTabs} from './render';
import {select} from './selection';
import {updateProps} from './properties';
import {EXPORTERS, FMT, exportIds, pageGraph, plural, type Format} from './formats/export';
import {IMPORTERS} from './formats/import';
import {applyTags, resolveType, userV} from './flow/model';
import {
    declObj,
    FLOW_KINDS,
    parseFlow,
    shapeStmt,
    splitComment,
    type FlowError,
    type FlowNote,
    type ShapeDecl
} from './flow/language';
import {editDoc, rebuild, selMemo, setDirty} from './document';
import {graphStatements, replacePageBody, type StatementNode} from './visio-io';
import {withTail} from './flow/sync';
import {ShapeKinds} from "./flow/shape-kinds";

/* The pane's state. mode is 'flow' (the document itself, applied as you type) or an export format's id from FMT,
   shown as that format and applied with the Apply button. */
export type TextPane = {
    open: boolean, pinned: boolean, mode: string,
    dirty: boolean,                 // the other-format text has edits not applied yet
    errors: FlowError[],            // what the flow text's last parse found wrong
    notes: FlowNote[],              // ... and its warnings and notes, which don't stop it being applied
    timer: number,                  // the pending apply-as-you-type
    lastTyped: number,              // when the last edit was applied (ms), so a burst of typing is one undo step
    cur: number                     // the highlighted line: the selection's, or -1
};
export const TP: TextPane = {
    open: false,
    pinned: false,
    mode: 'flow',
    dirty: false,
    errors: [],
    notes: [],
    timer: 0,
    lastTyped: 0,
    cur: -1
};
const FORMATS: Record<string, Format> = FMT;
let codeText: HTMLTextAreaElement, codeHl: HTMLElement, codeGutter: HTMLElement;

function storePane(): void {
    try {
        localStorage.setItem('flowEditor.pane', JSON.stringify({
            open: TP.open,
            pinned: TP.pinned,
            w: getComputedStyle(document.body).getPropertyValue('--tpw').trim()
        }));
    } catch (_) { /* storage can be unavailable; the pane still works */
    }
}

export function setPane(open: boolean, pinned: boolean): void {
    TP.open = open;
    TP.pinned = pinned;
    const $textPane = $('textPane');
    $textPane.hidden = !open;
    $('textTab').hidden = open;
    document.body.classList.toggle('tp-pinned', open && pinned);
    $textPane.classList.toggle('floating', open && !pinned);
    const $tpPin = $('tpPin');
    $tpPin.setAttribute('aria-pressed', String(pinned));
    $tpPin.textContent = pinned ? 'Unpin' : 'Pin';
    storePane();
    if (open) refreshEditor(true);
    applyView();
}

let FLOW_KW: RegExp, KIND_RE: RegExp;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function hlFlowLine(line: string): string {
    const {code, comment} = splitComment(line);
    /* the @animation block: its start, end and step lines are keywords; a step line's $id, +id, -$id or +$id names a
       shape, and the rest reads as a shape line does, a type first */
    const blk = code.match(/^(\s*)(@animation\s+(?:start|end)|step\s+\d+)(\s*)$/i);
    if (blk) return esc(blk[1]) + `<span class="k">${esc(blk[2])}</span>` + esc(blk[3]) + (comment ? `<span class="c">${esc(comment)}</span>` : '');
    const op = code.match(/^(\s*)([-+]?\$|\+)([A-Za-z_][\w-]*)(\s*:)?/);
    if (op) {   // the rest as the rest of a shape line "x: ...", less the "x: " (the overlay must match the text exactly)
        const after = code.slice(op[0].length), gap = after.match(/^\s*/)![0];
        return esc(op[1]) + `<span class="o">${esc(op[2])}</span><span class="i">${esc(op[3])}</span>` + esc((op[4] ?? '') + gap)
            + hlFlowLine('x: ' + after.slice(gap.length) + comment).replace(/^<span class="i">x<\/span>: /, '');
    }
    let out = '', p = 0;
    const re = /("(?:[^"\\]|\\.)*"?)|(@\s*-?[\d.]+\s*,\s*-?[\d.]+(?:\s+[\d.]+\s*x\s*[\d.]+)?)|(\[[^\]]*]?)|(\{[^}]*}?)|((?<=\s)(?:o--|\*--|[|}][|o](?:--|\.\.)[|o][|{])(?=\s))|([A-Za-z_][\w-]*)(\s*:)?|(\S+)/g;
    let m: RegExpExecArray | null, first = true;
    while ((m = re.exec(code))) {
        out += esc(code.slice(p, m.index));
        p = re.lastIndex;
        if (m[1]) out += `<span class="s">${esc(m[1])}</span>`;
        else if (m[2]) out += `<span class="n">${esc(m[2])}</span>`;
        else if (m[3] || m[4]) out += `<span class="a">${esc(m[3] || m[4])}</span>`;
        else if (m[5]) out += `<span class="o">${esc(m[5])}</span>`;
        else if (m[6]) {
            const w = m[6];
            if (first && FLOW_KW.test(w) && !m[7]) out += `<span class="k">${esc(w)}</span>`;
            else if (m[7]) out += `<span class="i">${esc(w)}</span>${esc(m[7])}`;
            else if (KIND_RE.test(w) && /:\s*\S*$/.test(code.slice(0, m.index))) out += `<span class="t">${esc(w)}</span>`;
            else if (/^(size|direction)$/.test(w)) out += `<span class="k">${esc(w)}</span>`;
            else out += `<span class="i">${esc(w)}</span>`;
        } else out += `<span class="o">${esc(m[8])}</span>`;
        first = false;
    }
    out += esc(code.slice(p));
    return out + (comment ? `<span class="c">${esc(comment)}</span>` : '');
}

function hlOtherLine(line: string): string {
    const c = line.match(/^(\s*)(%%|'|\/\/|#)(.*)$/);
    if (c) return esc(c[1]) + `<span class="c">${esc(c[2] + c[3])}</span>`;
    return esc(line).replace(/(&quot;|")((?:[^"\\]|\\.)*)(")/g, '<span class="s">"$2"</span>').replace(/(--+>|-\.->|==>|-->|\.\.>|->|--|\.\.|&lt;--&gt;)/g, '<span class="o">$1</span>');
}

export function paintCode(): void {
    const lines = codeText.value.split('\n'),
        errs = new Map((TP.mode === 'flow' ? TP.errors : []).map(e => [e.line, e.msg])),
        notes = new Map((TP.mode === 'flow' ? TP.notes : []).map(e => [e.line, e.msg]));
    const hl = TP.mode === 'flow' ? hlFlowLine : hlOtherLine,
        mark = (i: number) => errs.has(i) ? 'err' : notes.has(i) ? 'warn' : '';
    codeHl.innerHTML = lines.map((l, i) => `<div class="l${mark(i) ? ' ' + mark(i) : ''}${i === TP.cur ? ' cur' : ''}">${hl(l) || '&#8203;'}</div>`).join('');
    codeGutter.innerHTML = lines.map((_, i) => `<div class="${mark(i)}">${i + 1}</div>`).join('');
    syncScroll();
    if (TP.mode === 'flow') {
        const $tpStatus = $('tpStatus');
        const note = !TP.errors.length && TP.notes[0];
        $tpStatus.classList.toggle('error', !!TP.errors.length);
        $tpStatus.classList.toggle('warn', !!note);
        $tpStatus.textContent = TP.errors.length ? `Line ${TP.errors[0].line + 1}: ${TP.errors[0].msg}` + (TP.errors.length > 1 ? ` (and ${plural(TP.errors.length - 1, 'more problem')})` : '')
            : note ? `Line ${note.line + 1}: ${note.msg}` + (TP.notes.length > 1 ? ` (and ${plural(TP.notes.length - 1, 'more note')})` : '')
                : 'Changes apply as you type. Placements are in millimetres from the top left of the page.';
    }
}

function syncScroll(): void {
    const x = codeText.scrollLeft, y = codeText.scrollTop;
    codeHl.style.transform = `translate(${-x}px,${-y}px)`;
    codeGutter.style.transform = `translateY(${-y}px)`;
}

function setCode(t: string): void {
    if (codeText.value === t) {
        paintCode();
        return;
    }
    const y = codeText.scrollTop, x = codeText.scrollLeft;
    codeText.value = t;
    codeText.scrollTop = y;
    codeText.scrollLeft = x;
    paintCode();
}

export function curLineFor(): number {   // the text line of the selected shape or connection
    const el = S.sel && S.elById[S.sel], ap = S.ast && S.ast.pages[S.pi];
    if (!el || !ap) return -1;
    if (is1D(shapeCtx(el, null))) {
        const k = userV(el, 'FlowEdge');
        return k != null ? +k : -1;
    }
    const fid = userV(el, 'FlowId');
    if (fid === '__key') return ap.key ? ap.key.line : -1;
    const d = fid && ap.byId.get(fid);
    return d && d.line != null ? d.line : -1;
}

/* force: rewrite the pane's text even while the person is typing in it, or has edits not applied yet */
export function refreshEditor(force = false): void {
    if (!TP.open) return;
    TP.cur = TP.mode === 'flow' ? curLineFor() : -1;
    const typing = document.activeElement === codeText;
    if (TP.mode === 'flow') {
        if (!typing || force) setCode(S.text); else paintCode();
        if (!typing && TP.cur >= 0) {
            const top = TP.cur * 18, v = codeText.scrollTop, hgt = codeText.clientHeight;
            if (top < v || top > v + hgt - 36) codeText.scrollTop = Math.max(0, top - hgt / 3);
            syncScroll();
        }
    } else if (!TP.dirty || force) {
        try {
            const g = pageGraph();
            setCode(EXPORTERS[TP.mode](g));
            TP.dirty = false;
            setStatus(g.warnings.join(' ') || 'Edit and press Apply. Shapes keep their positions when their names match.');
        } catch (e) {
            console.error('Could not show the page as', TP.mode, e);
            setStatus('Could not show this page: ' + (e instanceof Error ? e.message : String(e)), true);
        }
    }
    const $tpApply = $<HTMLButtonElement>('tpApply');
    const $tpRevert = $<HTMLButtonElement>('tpRevert');
    $tpApply.hidden = $tpRevert.hidden = TP.mode === 'flow';
    $tpApply.disabled = $tpRevert.disabled = !TP.dirty;
}

function setStatus(msg: string, isErr = false): void {
    const $tpStatus = $('tpStatus');
    $tpStatus.textContent = msg;
    $tpStatus.classList.toggle('error', isErr);
}

/* Applies the flow text in the pane to the document: now, or after a short pause in typing */
export function applyFromEditor(now = false): void {
    clearTimeout(TP.timer);
    const run = () => {
        const t = codeText.value.replace(/\r\n?/g, '\n');
        if (t === S.text || S.present) return;   // a step of the animation is on the canvas, not the text
        const ast = parseFlow(t);
        if (ast.errors.length) {
            TP.errors = ast.errors;
            TP.notes = ast.notes;
            paintCode();
            return;
        }
        const t0 = Date.now();
        if (!TP.lastTyped || t0 - TP.lastTyped > 1500) {
            S.undo.push({text: S.text, pi: S.pi});
            S.redo = [];
        }
        TP.lastTyped = t0;
        S.text = t;
        setDirty(true);
        rebuild(selMemo());
        updateProps();
    };
    if (now) run(); else TP.timer = setTimeout(run, 350);
}

/* Applies the pane's text in another format to the current page. Shapes whose names match keep their places. */
async function applyForeign(): Promise<void> {
    const fmt = TP.mode, text = codeText.value;
    try {
        const g = applyTags(await IMPORTERS[fmt](text)), nodes: StatementNode[] = g.nodes;
        const cur = pageGraph(), rev: Record<string, string> = {}, byLabel: Record<string, string> = {};
        for (const [fid, eid] of Object.entries(exportIds(cur))) rev[eid] = fid;
        for (const n of cur.nodes) if (!byLabel[n.label]) byLabel[n.label] = n.id;
        const ap = S.ast?.pages[S.pi];
        if (!ap) throw new Error('there is no page to apply it to.');
        for (const n of nodes) {
            const fid = rev[n.id] || (fmt === 'activity' ? byLabel[n.label] : null);
            if (!fid) continue;
            const d = ap.byId.get(fid);
            n.id = fid;
            if (d && !d.implicit) {
                n.keepPlace = d.place || null;
                n.keepAttrs = d.attrs;
                if (n.kind === 'process' && d.kind !== 'process' && fmt === 'activity') n.kind = d.kind;
                if (d.kind === 'table' && !n.columns) n.columns = d.columns ?? undefined;
                if (d.kind === 'grid' && !n.cells && !n.label) n.cells = d.cells ?? undefined;
            }
        }
        for (const e of g.edges) {
            const old = ap.edges.find(o => o.from === e.from && o.to === e.to);
            if (old && resolveType({
                style: e.style || 'solid',
                start: e.start || 'none',
                end: e.end || 'arrow'
            }) === 'flow') Object.assign(e, {
                style: old.style,
                start: old.start,
                end: old.end,
                means: old.means,
                stroke: old.stroke,
                weight: old.weight
            });
        }
        const {lines} = graphStatements(g, {placed: false, used: new Set()});
        TP.dirty = false;
        editDoc(replacePageBody(S.text, ap, lines), S.pi);
        refreshEditor(true);
        toast(`Applied ${FORMATS[fmt].name} to ${ap.name}.` + (g.warnings.length ? ' ' + g.warnings.join(' ') : ''), g.warnings.length ? 9000 : 4500);
    } catch (e) {
        console.error('Apply failed', e);
        setStatus('Could not apply: ' + (e instanceof Error ? e.message : String(e)), true);
    }
}

const caretLine = () => codeText.value.slice(0, codeText.selectionStart).split('\n').length - 1;

/* Enter at the end of a just-typed shape line with no place of its own: bake in where automatic layout would put
   it, the same position dragging it would write back, so shapes get placed one by one as they're typed. Left
   alone: shapes already placed, mind-map topics, non-root lifelines and flexi container members, which are placed
   some other way. */
function autoPositionOnEnter(): boolean {
    if (TP.mode !== 'flow' || codeText.selectionStart !== codeText.selectionEnd) return false;
    const suggestBox = $('suggest');   // the suggestion list accepts Enter itself; don't also place the shape
    if (suggestBox && !suggestBox.hidden) return false;
    const val = codeText.value, caret = codeText.selectionStart,
        lineStart = val.lastIndexOf('\n', caret - 1) + 1, nl = val.indexOf('\n', caret),
        lineEnd = nl < 0 ? val.length : nl;
    if (caret !== lineEnd) return false;
    applyFromEditor(true);
    if (!S.ast || TP.errors.length) return false;
    const lineNum = val.slice(0, lineStart).split('\n').length - 1;
    let d: ShapeDecl | undefined, pi = -1;
    S.ast.pages.forEach((ap, i) => {
        const f = ap.shapes.find(s => s.line === lineNum && !s.implicit);
        if (f) {
            d = f;
            pi = i;
        }
    });
    if (!d || d.place) return false;
    if (d.map || (d.seq && d.seq.root !== d.id)) return false;
    const host = d.attrs.in ? S.ast.pages[pi].byId.get(d.attrs.in) : null;
    if (host && host.attrs.flow) return false;
    const geo = S.built[pi]?.get(d.id);
    if (!geo) return false;
    const round = (n: number) => Math.round(n * 10) / 10;
    const obj = declObj(d);
    obj.place = {x: round(geo.x), y: round(geo.y), w: d.dims ? round(d.dims.w) : null, h: d.dims ? round(d.dims.h) : null};
    obj.dims = null;
    const canon = withTail(val.slice(lineStart, lineEnd), shapeStmt(obj));
    codeText.setSelectionRange(lineStart, lineEnd);
    document.execCommand('insertText', false, canon);
    document.execCommand('insertText', false, '\n');
    return true;
}

function selectFromCaret(): void {
    if (TP.mode !== 'flow' || !S.ast) return;
    const line = caretLine();
    if (line === TP.cur) return;
    S.ast.pages.forEach((ap, pi) => {
        const d = ap.shapes.find(s => s.line === line), e = ap.edgeByLine.get(line),
            k = ap.key && ap.key.line === line ? ap.key : null;
        if (!d && !e && !k) return;
        if (pi !== S.pi) {
            S.pi = pi;
            renderTabs();
            render();
        }
        const top = kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape');
        const el = top.find(t => d ? userV(t, 'FlowId') === d.id : k ? userV(t, 'FlowId') === '__key' : userV(t, 'FlowEdge') === String(line));
        if (el) {
            select(el.getAttribute('ID'));
            TP.cur = line;
            paintCode();
        }
    });
}

/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init(): void {
    codeText = $<HTMLTextAreaElement>('codeText');
    codeHl = $('codeHl');
    codeGutter = $('codeGutter');
    try {
        const p = JSON.parse(localStorage.getItem('flowEditor.pane') || 'null');
        if (p) {
            if (p.w) document.body.style.setProperty('--tpw', p.w);
            TP.open = !!p.open;
            TP.pinned = !!p.pinned;
        }
    } catch (_) { /* first run or storage blocked */
    }
    FLOW_KW = /\b(flow|page|size|direction|key|icon)\b/;
    KIND_RE = new RegExp('^(?:' + [...FLOW_KINDS, ...Object.keys(ShapeKinds)].join('|') + ')$', 'i');
    codeText.addEventListener('input', () => {
        if (TP.mode === 'flow') {
            paintCode();
            applyFromEditor();
        } else {
            TP.dirty = true;
            paintCode();
            refreshEditor();
            setStatus('Not applied yet.');
        }
    });
    codeText.addEventListener('scroll', syncScroll);
    codeText.addEventListener('keydown', e => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            document.execCommand('insertText', false, '  ');
        } else if (e.key === 'Escape') {
            codeText.blur();
        } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (autoPositionOnEnter()) e.preventDefault();
        }
    });
    codeText.addEventListener('click', selectFromCaret);
    codeText.addEventListener('keyup', e => {
        if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) selectFromCaret();
    });
    codeText.addEventListener('blur', () => {
        if (TP.mode === 'flow') applyFromEditor(true);
    });
    const $tpLang = $<HTMLSelectElement>('tpLang');
    $tpLang.addEventListener('change', () => {
        if (TP.dirty && !confirm('Your unapplied edits will be lost. Continue?')) {
            $tpLang.value = TP.mode;
            return;
        }
        if (TP.mode === 'flow') applyFromEditor(true);
        TP.mode = $tpLang.value;
        TP.dirty = false;
        refreshEditor(true);
    });
    $('tpApply').onclick = applyForeign;
    $('tpRevert').onclick = () => {
        TP.dirty = false;
        refreshEditor(true);
    };
    $('tpPin').onclick = () => setPane(true, !TP.pinned);
    $('tpClose').onclick = () => setPane(false, TP.pinned);
    $('textTab').onclick = () => setPane(true, TP.pinned);
    svg.addEventListener('pointerdown', () => {
        if (TP.open && !TP.pinned) setPane(false, false);
    }, true);
    (() => {
        let start: { x: number, w: number } | null = null;   // drag the pane's left edge to resize it
        const $tpResize = $('tpResize');
        $tpResize.addEventListener('pointerdown', e => {
            start = {x: e.clientX, w: $('textPane').getBoundingClientRect().width};
            $tpResize.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        $tpResize.addEventListener('pointermove', e => {
            if (!start) return;
            const w = Math.max(280, Math.min(window.innerWidth * 0.7, start.w + (start.x - e.clientX)));
            document.body.style.setProperty('--tpw', w + 'px');
            applyView();
        });
        $tpResize.addEventListener('pointerup', () => {
            start = null;
            storePane();
        });
    })();
}
