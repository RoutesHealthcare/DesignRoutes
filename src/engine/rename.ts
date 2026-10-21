/* ---------- renaming a shape ----------
   Changes a shape's id everywhere its page names it: its own line, the [in=] of anything inside it and both ends of
   its connections (renameIds in flow/language.ts). One undo step, and the shape stays selected under its new id.
   The properties panel's Id field and the text pane's Rename both come here. */
import {S} from './core';
import {editDoc} from './document';
import {select} from './selection';
import {userV} from './flow/model';
import {idProblem, renameIds} from './flow/language';
import {is1D, shapeCtx} from './visio-package';

/* The id of the one selected shape, or null when the selection is a connection, the key or not one thing */
export function selectedShapeId(): string | null {
    const el = S.sel ? S.elById[S.sel] : null;
    if (!el || S.selection.size !== 1 || is1D(shapeCtx(el, null))) return null;
    const fid = userV(el, 'FlowId');
    return fid && fid !== '__key' ? fid : null;
}

/* Renames from to to on page pi. Returns what's wrong with to instead, if anything, and changes nothing. */
export function renameShape(pi: number, from: string, to: string): string | null {
    const ap = S.ast?.pages[pi];
    to = to.trim();
    if (!ap || !ap.byId.has(from)) return `There is no shape "${from}" on this page.`;
    if (to === from) return null;
    const bad = idProblem(ap, from, to);
    if (bad) return bad;
    editDoc(renameIds(S.text, S.ast!, pi, new Map([[from, to]])), pi, pi === S.pi);
    const el = Object.values(S.elById).find(e => userV(e, 'FlowId') === to);
    if (el) select(el.getAttribute('ID'));
    return null;
}
