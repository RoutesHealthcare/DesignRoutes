/* ---------- document state, undo and rebuild ---------- */
import {S, kid, kids, toast} from './core';
import {is1D, shapeCtx} from './visio-package';
import {fit, pageCtx, render, updateTitle} from './render';
import {selIds} from './selection';
import {commitText} from './text-editor';
import {plural} from './formats/export';
import {userV} from './flow/model';
import {keepAnimationLast, parseFlow} from './flow/language';
import {buildModel, syncFromModel, type SyncResult} from './flow/sync';
import {TP, refreshEditor, setPane} from './text-pane';
import {notify} from './store';

/* How to find a selected shape again after a rebuild: a shape by its FlowId, a connector by its FlowEdge line */
export type SelMemo = { el?: Element, fid?: string | null, edgeEl?: Element, key?: string | null };
type UndoEntry = { text: string, pi: number };

const BLANK_FLOW = 'flow 1\n\npage "Page-1" size 297x210\n';
/* a new shape has no FlowId until syncFromModel names it, so keep the element and read its name back at reselect time */
const memoFor = (el: Element): SelMemo => is1D(shapeCtx(el, null)) ? {edgeEl: el, key: userV(el, 'FlowEdge')} : {
    el,
    fid: userV(el, 'FlowId')
};

/* the primary selection comes first so it stays primary after a rebuild */
export function selMemo(): SelMemo[] | null {
    const ids = [S.sel, ...selIds().filter(id => id !== S.sel)].filter((id): id is string => !!id && !!S.elById[id]);
    return ids.length ? ids.map(id => memoFor(S.elById[id])) : null;
}

function findByMemo(memo: SelMemo, sync: SyncResult | undefined, top: Element[]): Element | null {
    const fid = memo.fid || (memo.el && userV(memo.el, 'FlowId'));
    if (fid) return top.find(t => userV(t, 'FlowId') === fid) || null;
    if (memo.el) return null;
    let line: number | undefined = sync && sync.placedTags && memo.edgeEl ? sync.placedTags.get(memo.edgeEl) : undefined;
    if (line == null && memo.key != null) line = sync && sync.lineMap ? sync.lineMap.get(+memo.key) : +memo.key;
    return line != null ? top.find(t => userV(t, 'FlowEdge') === String(line)) || null : null;
}

function reselect(memos: SelMemo[] | null, sync?: SyncResult): void {
    if (!memos) {
        S.sel = null;
        S.selection = new Set();
        return;
    }
    const pg = pageCtx();
    if (!pg) return;
    const top = kids(kid(pg.doc.documentElement, 'Shapes'), 'Shape');
    const ids = memos.map(m => findByMemo(m, sync, top)).filter((el): el is Element => !!el).map(el => el.getAttribute('ID') ?? '');
    S.sel = ids[0] ?? null;
    S.selection = new Set(ids);
}

export function rebuild(memo: SelMemo[] | null, sync?: SyncResult): boolean {
    const ast = parseFlow(S.text);
    S.ast = ast;
    TP.errors = ast.errors;
    TP.notes = ast.notes;
    buildModel(ast);
    reselect(memo, sync);
    render();
    refreshEditor();
    notify();
    if (ast.errors.length) console.error('Flow text has errors', ast.errors);
    return !ast.errors.length;
}

export function snapshot(): string {
    return S.text;
}

export function setDirty(v: boolean): void {
    S.dirty = v;
    updateTitle();
}

export function pushUndo(snap: string): void {
    if (S.present) return;   // nothing edits a step of the animation
    const memo = selMemo(), sync: SyncResult = syncFromModel();
    if (S.text !== snap) {
        S.undo.push({text: snap, pi: S.pi});
        if (S.undo.length > 200) S.undo.shift();
        S.redo = [];
        setDirty(true);
        TP.lastTyped = 0;
    }
    rebuild(memo, sync);
}

export function commit(fn: () => void): void {
    const snap = snapshot();
    fn();
    pushUndo(snap);
}

export function editDoc(text: string, pi?: number | null, keepView?: boolean): void {   // a change made directly to the text, such as an import or a page added
    text = keepAnimationLast(text);   // a page added at the end goes in above the @animation block
    if (text === S.text || S.present) return;
    S.undo.push({text: S.text, pi: S.pi});
    S.redo = [];
    S.text = text;
    if (pi != null) S.pi = pi;
    setDirty(true);
    rebuild(selMemo());
    if (!keepView) fit();
}

function restore(from: UndoEntry[], to: UndoEntry[]): void {
    const u = from.pop();
    if (!u) return;
    to.push({text: S.text, pi: S.pi});
    S.text = u.text;
    S.pi = u.pi;
    setDirty(true);
    rebuild(selMemo());
}

/* What clicking a page tab does: commit any in-progress shape text first, since it belongs to the page being left */
export function switchPage(pi: number): void {
    if (S.editing) commitText();
    S.pi = pi;
    S.sel = null;
    render();
    fit();
    refreshEditor();
}

export const undo = (): void => {
    if (S.editing) commitText();
    restore(S.undo, S.redo);
};
export const redo = (): void => {
    if (S.editing) commitText();
    restore(S.redo, S.undo);
};

export function loadText(text: string, name: string, handle?: FileSystemFileHandle | null): void {
    S.text = text.replace(/\r\n?/g, '\n');
    S.name = name;
    S.handle = handle || null;
    S.undo = [];
    S.redo = [];
    S.sel = null;
    S.pi = 0;
    S.dirty = false;
    rebuild(null);
    updateTitle();
    fit();
    if (TP.errors.length) {
        setPane(true, TP.pinned);
        toast(`${plural(TP.errors.length, 'line')} in this file could not be read. They are marked in the text.`, 8000);
    }
}

export function newDoc(): void {
    loadText(BLANK_FLOW, 'Untitled.flow', null);
}
