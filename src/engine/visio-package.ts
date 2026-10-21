/* ---------- package reading ---------- */
import {NS, PRNS, RNS, S, kid, kids, ownCell, parseXml} from './core';

/* A Visio shape as shapeCtx builds it: its own element, the id of the master it uses, and that master's element */
export type VisioShape = { el: Element, mid: string | null, mel: Element | null };
/* One package relationship (an entry in a .rels file), with its target resolved to a path inside the zip */
type Rel = { target: string, type: string | null };

function resolvePath(base: string, target: string): string {
    if (target.startsWith('/')) return target.slice(1);
    const out: string[] = [];
    for (const p of (base + target).split('/')) {
        if (p === '..') out.pop(); else if (p && p !== '.') out.push(p);
    }
    return out.join('/');
}

function relsPathFor(part: string): string {
    const i = part.lastIndexOf('/');
    return part.slice(0, i + 1) + '_rels/' + part.slice(i + 1) + '.rels';
}

async function readXml(path: string): Promise<Document | null> {
    const f = S.zip?.file(path);
    if (!f) return null;
    return parseXml(await f.async('string'));
}

async function readRels(part: string): Promise<Record<string, Rel>> {
    const d = await readXml(relsPathFor(part));
    const m: Record<string, Rel> = {};
    if (!d) return m;
    const base = part.slice(0, part.lastIndexOf('/') + 1);
    for (const r of d.getElementsByTagNameNS(PRNS, 'Relationship')) {
        if (r.getAttribute('TargetMode') === 'External') continue;
        m[r.getAttribute('Id') ?? ''] = {
            target: resolvePath(base, r.getAttribute('Target') ?? ''),
            type: r.getAttribute('Type')
        };
    }
    return m;
}

const relOf = (rels: Record<string, Rel>, suffix: string): string | undefined => Object.values(rels).find(r => r.type && r.type.endsWith(suffix))?.target;

export async function parsePackage(): Promise<void> {
    const rootRels = await readRels('');
    const docPart = relOf(rootRels, '/document') || 'visio/document.xml';
    const docRels = await readRels(docPart);
    const pagesPart = relOf(docRels, '/pages'), mastersPart = relOf(docRels, '/masters');
    if (!pagesPart) throw new Error('no pages were found in the package');

    S.styles = {};
    const dd = await readXml(docPart);
    if (dd) for (const st of kids(kid(dd.documentElement, 'StyleSheets'), 'StyleSheet')) S.styles[st.getAttribute('ID') ?? ''] = st;

    S.masters = {};
    if (mastersPart) {
        const md = await readXml(mastersPart), mr = await readRels(mastersPart);
        if (md) for (const m of kids(md.documentElement, 'Master')) {
            const rel = kid(m, 'Rel'), t = rel && mr[rel.getAttributeNS(RNS, 'id') ?? ''];
            if (!t) continue;
            const d = await readXml(t.target);
            if (!d) continue;
            const byId: Record<string, Element> = {};
            for (const s of d.getElementsByTagNameNS(NS, 'Shape')) byId[s.getAttribute('ID') ?? ''] = s;
            S.masters[m.getAttribute('ID') ?? ''] = {
                byId,
                top: kid(kid(d.documentElement, 'Shapes'), 'Shape'),
                name: m.getAttribute('NameU') || m.getAttribute('Name') || ''
            };
        }
    }

    const pd = await readXml(pagesPart), pr = await readRels(pagesPart);
    if (!pd) throw new Error('no pages were found in the package');
    S.pages = [];
    S.pagesDoc = pd;
    S.pagesPart = pagesPart;
    for (const p of kids(pd.documentElement, 'Page')) {
        const rel = kid(p, 'Rel'), t = rel && pr[rel.getAttributeNS(RNS, 'id') ?? ''];
        if (!t) continue;
        const doc = await readXml(t.target);
        if (!doc) continue;
        const ps = kid(p, 'PageSheet');
        const gv = (n: string, d: number): number => {
            const c = ownCell(ps, n);
            const v = c ? parseFloat(c.getAttribute('V') ?? '') : NaN;
            return isFinite(v) ? v : d;
        };
        S.pages.push({
            name: p.getAttribute('Name') || p.getAttribute('NameU') || 'Page', path: t.target, doc,
            w: gv('PageWidth', 8.5), h: gv('PageHeight', 11), bg: p.getAttribute('Background') === '1', sheet: ps
        });
    }
    if (!S.pages.length) throw new Error('no readable pages were found');
}

/* ---------- inheritance: shape -> master -> style ---------- */
export function shapeCtx(el: Element, inheritMid: string | null | undefined): VisioShape {
    const m = el.getAttribute('Master'), mid = m || inheritMid || null, ms = mid ? S.masters[mid] : undefined;
    let mel: Element | null = null;
    if (ms) {
        const msId = el.getAttribute('MasterShape');
        mel = msId ? (ms.byId[msId] || null) : (m ? ms.top : null);
    }
    return {el, mid, mel};
}

function styleCell(sh: VisioShape, n: string): Element | null {
    const kind = /^(Fill|Shdw)/.test(n) ? 'FillStyle' : /^(Line|BeginArrow|EndArrow|Rounding)/.test(n) ? 'LineStyle' : 'TextStyle';
    let sid = sh.el.getAttribute(kind) ?? (sh.mel ? sh.mel.getAttribute(kind) : null);
    for (let i = 0; i < 8 && sid != null; i++) {
        const st = S.styles[sid];
        if (!st) break;
        const c = ownCell(st, n);
        if (c) return c;
        sid = st.getAttribute(kind);
    }
    return null;
}

function findCell(sh: VisioShape, n: string): Element | null {
    return ownCell(sh.el, n) || ownCell(sh.mel, n) || styleCell(sh, n);
}

export function cellV<D>(sh: VisioShape, n: string, d: D): string | D {
    const c = findCell(sh, n);
    if (!c) return d;
    const v = c.getAttribute('V');
    return v == null ? d : v;
}

export function num(sh: VisioShape, n: string, d: number): number {
    const v = parseFloat(cellV(sh, n, ''));
    return isFinite(v) ? v : d;
}

export const numEl = (el: Element | null, n: string, d: number): number => {
    const c = ownCell(el, n);
    const v = c ? parseFloat(c.getAttribute('V') ?? '') : NaN;
    return isFinite(v) ? v : d;
};

export function rowCellEl(el: Element | null, sec: string, ix: string, n: string): Element | null {
    if (!el) return null;
    for (const s of kids(el, 'Section')) if (s.getAttribute('N') === sec) for (const r of kids(s, 'Row')) if ((r.getAttribute('IX') || '0') === ix) {
        const c = ownCell(r, n);
        if (c) return c;
    }
    return null;
}

export function rowV(sh: VisioShape, sec: string, ix: string, n: string): string | null {
    let c = rowCellEl(sh.el, sec, ix, n) || rowCellEl(sh.mel, sec, ix, n);
    let sid = sh.el.getAttribute('TextStyle') ?? (sh.mel ? sh.mel.getAttribute('TextStyle') : null);
    for (let i = 0; !c && i < 8 && sid != null; i++) {
        const st = S.styles[sid];
        if (!st) break;
        c = rowCellEl(st, sec, ix, n);
        sid = st.getAttribute('TextStyle');
    }
    return c ? c.getAttribute('V') : null;
}

export const is1D = (sh: VisioShape): boolean => cellV(sh, 'BeginX', null) != null;

/* Visio marks soft line breaks with U+2028 and paragraphs with U+2029; both are plain line breaks here */
export function shapeText(sh: VisioShape): string {
    const t = kid(sh.el, 'Text') || kid(sh.mel, 'Text');
    return t ? (t.textContent ?? '').replace(/\r/g, '').replace(/[\u2028\u2029]/g, '\n').replace(/\n+$/, '') : '';
}

export function setText(el: Element, txt: string): void {
    let t = kid(el, 'Text');
    if (!t) {
        t = el.ownerDocument.createElementNS(NS, 'Text');
        el.insertBefore(t, [...el.children].find(x => ['Data1', 'Data2', 'Data3', 'ForeignData', 'Shapes'].includes(x.localName)) || null);
    }
    while (t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(el.ownerDocument.createTextNode(txt));
}
