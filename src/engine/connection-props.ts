/* ---------- connection settings in the properties panel ---------- */
import {S, kid, kids} from './core.js';
import {is1D, shapeCtx, shapeText} from './visio-package';
import {pageCtx, render} from './render';
import {connectsEl, refreshConnector} from './connectors';
import {
    CONN,
    connMeans,
    edgeStyleOf,
    resolveType,
    setEdgeStyle,
    userV,
    isCard,
    type ConnType,
    type EdgeStyle
} from './flow/model';
import {keyStmt} from './flow/language';
import {modelPage} from './flow/sync';
import {commit, editDoc} from './document';

export const typeStyle = (t: ConnType) => ({style: CONN[t].style, start: CONN[t].start, end: CONN[t].end});
const labelOfFid = (fid: string) => {
    const top = kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape'),
        el = top.find(t => userV(t, 'FlowId') === fid);
    return el ? shapeText(shapeCtx(el, null)) || fid : fid;
};

export function moveStatement(el: Element, front: boolean) {
    const fid = userV(el, 'FlowId'), ap = S.ast?.pages[S.pi];
    if (!ap) return;
    const d = fid && (fid === '__key' ? ap.key : ap.byId.get(fid));
    if (!d || ('implicit' in d && d.implicit) || d.line == null) return;
    const lines = [...ap.shapes.flatMap(s => s.implicit || s.line == null ? [] : [s.line]), ...(ap.key ? [ap.key.line] : [])].sort((a, b) => a - b);
    const target = front ? lines[lines.length - 1] : lines[0];
    if (target === d.line) return;
    const L = S.text.split('\n'), text = L.splice(d.line, 1)[0], t = target > d.line ? target - 1 : target;   // removing the line shifts later lines up
    L.splice(front ? t + 1 : t, 0, text);
    editDoc(L.join('\n'), S.pi);
}

/* What a selected connection's panel needs to show, read fresh from el on every render */
export function connectionView(el: Element) {
    const st = edgeStyleOf(el), t = resolveType(st) as ConnType, m = modelPage(S.pi).edges.find(e => e.el === el);
    return {
        type: t,
        route: st.route || 'straight',
        description: connMeans(st, m?.from ? labelOfFid(m.from) : undefined, m?.to ? labelOfFid(m.to) : undefined),
        isEr: t === 'er',
        isCustom: t === 'custom',
        cardStart: isCard(st.start) ? st.start : 'one',
        cardEnd: isCard(st.end) ? st.end : 'zeroMany',
        style: st.style,
        start: st.start,
        end: st.end,
        rawMeans: st.means,
        placeholder: CONN[t].means,
    };
}

export function restyleConn(el: Element, change: Partial<EdgeStyle>): void {
    if (!is1D(shapeCtx(el, null))) return;
    const st = {...edgeStyleOf(el), ...change};
    S.newConn = {style: st.style, start: st.start, end: st.end, route: st.route};
    commit(() => setEdgeStyle(el, st));
}

export function reverseConnection(el: Element): void {
    const id = el.getAttribute('ID');
    if (!id) return;
    commit(() => {
        const cons = kids(connectsEl(pageCtx().doc, false), 'Connect').filter(c => c.getAttribute('FromSheet') === id);
        const b = cons.find(c => c.getAttribute('FromCell') === 'BeginX'),
            e = cons.find(c => c.getAttribute('FromCell') === 'EndX');
        const bt = b?.getAttribute('ToSheet'), et = e?.getAttribute('ToSheet');
        if (b && e && bt && et) {
            b.setAttribute('ToSheet', et);
            e.setAttribute('ToSheet', bt);
            render();
            refreshConnector(id);
        }
    });
}

/* The page's "add a key" toggle (PageProps.tsx) */
export function toggleKey(): void {
    const ap = S.ast?.pages[S.pi], L = S.text.split('\n');
    if (!ap) return;
    if (ap.key) {
        L.splice(ap.key.line, 1);
        editDoc(L.join('\n'), S.pi);
        return;
    }
    const at = ap.lastShapeLine ?? ap.headerLine ?? ap.endLine;
    L.splice(at + 1, 0, keyStmt({title: 'Key'}));
    editDoc(L.join('\n'), S.pi);
}

/* The default style new connections start with (PageProps.tsx's "New connections" picker) */
export function setNewConnType(t: ConnType): void {
    S.newConn = t === 'er' ? {style: 'solid', start: 'one', end: 'zeroMany'} : typeStyle(t === 'custom' ? 'flow' : t);
}

export type {ConnType, EdgeStyle};

S.newConn = typeStyle('flow');
