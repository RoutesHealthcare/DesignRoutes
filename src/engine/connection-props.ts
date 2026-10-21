/* ---------- connection settings in the properties panel ---------- */
import {$, S, kid, kids} from './core.js';
import {is1D, shapeCtx, shapeText} from './visio-package';
import {pageCtx, render} from './render';
import {connectsEl, refreshConnector} from './connectors';
import {selEl} from './properties';
import {
    CARDS,
    CONN,
    CONN_SETS,
    LINE_STYLES,
    MARKERS,
    cap,
    connMeans,
    edgeStyleOf,
    resolveType,
    setEdgeStyle,
    userV,
    isCard,
    type ConnType,
    type EdgeStyle,
    type Marker
} from './flow/model';
import {keyStmt} from './flow/language';
import {modelPage} from './flow/sync';
import {commit, editDoc} from './document';


/* Every connection control is a <select>, except pMeans, which is an <input> */
const dropdown = (id: string) => $(id) as HTMLSelectElement;
const meansBox = () => $('pMeans') as HTMLInputElement;


function fillConnSelect(sel: HTMLSelectElement) {
    sel.replaceChildren();
    for (const set of CONN_SETS) {
        const og = document.createElement('optgroup');
        og.label = set;
        for (const [k, c] of Object.entries(CONN)) if (c.set === set) og.appendChild(new Option(c.name, k));
        sel.appendChild(og);
    }
}

export const typeStyle = (t: ConnType) => ({style: CONN[t].style, start: CONN[t].start, end: CONN[t].end});
const labelOfFid = (fid: string) => {
    const top = kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape'),
        el = top.find(t => userV(t, 'FlowId') === fid);
    return el ? shapeText(shapeCtx(el, null)) || fid : fid;
};

export function updateConnProps(el: Element) {
    const st = edgeStyleOf(el), t = resolveType(st) as ConnType, m = modelPage(S.pi).edges.find(e => e.el === el);
    dropdown('pConn').value = t;
    $('pConnMeans').textContent = connMeans(st, m?.from ? labelOfFid(m.from) : undefined, m?.to ? labelOfFid(m.to) : undefined);
    $('pErRow').hidden = t !== 'er';
    $('pCustom').hidden = t !== 'custom';
    dropdown('pCardStart').value = isCard(st.start) ? st.start : 'one';
    dropdown('pCardEnd').value = isCard(st.end) ? st.end : 'zeroMany';
    dropdown('pStyle').value = st.style;
    dropdown('pStart').value = st.start;
    dropdown('pEnd').value = st.end;
    dropdown('pRoute').value = st.route || 'straight';
    if (document.activeElement !== meansBox()) meansBox().value = st.means;
    meansBox().placeholder = CONN[t].means;
}

const restyle = (change: Partial<EdgeStyle>) => {
    const el = selEl();
    if (!el || !is1D(shapeCtx(el, null))) return;
    const st = {...edgeStyleOf(el), ...change};
    S.newConn = {style: st.style, start: st.start, end: st.end, route: st.route};   // new connections follow the last one changed $('pNewConn').value=resolveType(st)==='er'?'er':resolveType(st);
    commit(() => setEdgeStyle(el, st));
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

/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init() {
    fillConnSelect(dropdown('pConn'));
    fillConnSelect(dropdown('pNewConn'));
    const lists: [string, string[]][] = [['pCardStart', CARDS], ['pCardEnd', CARDS], ['pStart', Object.keys(MARKERS)], ['pEnd', Object.keys(MARKERS)], ['pStyle', Object.keys(LINE_STYLES)]];
    for (const [id, list] of lists)
        for (const k of list) $(id).appendChild(new Option(id === 'pStyle' ? cap(k) : MARKERS[k as Marker] || k, k));
    S.newConn = typeStyle('flow');
    $('pConn').addEventListener('change', () => {
        const t = dropdown('pConn').value as ConnType;
        restyle(t === 'custom' ? {} : t === 'er' ? {style: 'solid', start: 'one', end: 'zeroMany'} : typeStyle(t));
    });
    for (const id of ['pCardStart', 'pCardEnd']) $(id).addEventListener('change', () => restyle({
        start: dropdown('pCardStart').value,
        end: dropdown('pCardEnd').value
    }));
    for (const id of ['pStyle', 'pStart', 'pEnd']) $(id).addEventListener('change', () => restyle({
        style: dropdown('pStyle').value,
        start: dropdown('pStart').value,
        end: dropdown('pEnd').value
    }));
    meansBox().addEventListener('change', () => restyle({means: meansBox().value.trim()}));
    $('pRoute').addEventListener('change', () => restyle({
        route: dropdown('pRoute').value === 'elbow' ? 'elbow' : null,
        via: null
    }));
    $('pReverse').onclick = () => {
        const el = selEl();
        if (!el) return;
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
    };
    dropdown('pNewConn').addEventListener('change', () => {
        const t = dropdown('pNewConn').value as ConnType;
        S.newConn = t === 'er' ? {
            style: 'solid',
            start: 'one',
            end: 'zeroMany'
        } : typeStyle(t === 'custom' ? 'flow' : t);
    });
    $('pAddKey').onclick = () => {
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
    };
}
