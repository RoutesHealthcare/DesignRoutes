/* ---------- text to canvas ---------- */
import {NS, RNS, S, cellEl, colour, kid, kids, mk, parseXml, setCell} from '../core';
import {DEF} from '../colours';
import {cellV, is1D, numEl, rowCellEl, rowV, setText, shapeCtx, shapeText} from '../visio-package';
import {render} from '../render';
import {centreOf, connectsEl, refreshConnector, setConnector, setGlue} from '../connectors';
import {
    CONTAINER,
    LIFELINE_HEAD,
    SHAPES,
    buildConnector,
    buildGrid,
    buildShape,
    buildTable,
    cellValues,
    ensureShapes,
    gridIds,
    gridParts,
    isContainerKind,
    isPartKind,
    isShapeKind,
    pxToIn,
    roleOf,
    setRole,
    tableParts,
    type ShapeKind
} from '../../shapes';
import {layoutGraph} from '../layout';
import type {LayoutGraph} from '../layoutGraph';
import type {LayoutNode} from '../layoutNode';
import type {Page} from '../page';
import {
    CONN,
    connName,
    edgeStyleOf,
    resolveType,
    setEdgeStyle,
    setTextPt,
    setUser,
    SHAPE_TEXT_PT,
    textPt,
    userV,
    weightOf,
    type ConnType,
    type EdgeStyle
} from './model';
import {
    autoSizeMM,
    declObj,
    edgeStmt,
    fixedH,
    fixedHeight,
    keyStmt,
    shapeStmt,
    splitComment,
    uniqueFid,
    type Attrs,
    type FlowAlign,
    type FlowDir,
    type FlowAst,
    type FlowEdge,
    type FlowPage,
    type Place,
    type ShapeAttrs,
    type ShapeDecl,
    type ShapeObj
} from './language';

/* Sizes and positions here are mm from the page's top-left corner */
type Size = { w: number, h: number };
type XY = { x: number, y: number };
/* Where a shape was drawn: what buildModel records per page in S.built, and what geoMM reads back off the canvas */
export type Geo = XY & Size;
/* A shape as it is on the canvas now, to be written back as a statement */
export type ModelShape = ShapeObj & {
    el: Element,
    id: string,
    kind: ShapeKind,
    geo: Geo,
    label: string,
    attrs: ShapeAttrs
};
/* A connection as it is on the canvas now; from and to are null when that end isn't glued to a shape */
export type ModelEdge = EdgeStyle & {
    el: Element, key: string | null, from: string | null, to: string | null, label: string,
    style: string, start: string, end: string
};
export type ModelPage = { shapes: ModelShape[], edges: ModelEdge[], key: { title: string, geo: Geo } | null };
/* One row of a page's key: a sample of the connection type, its name and what it means */
type KeyRow = { e: FlowEdge, t: ConnType, name: string, means: string };
/* What syncFromModel reports about the text it rewrote */
export type SyncResult = {
    lineMap?: Map<number, number>,                 // old line number to new
    placedTags?: Map<Element, number>,             // a connector added as a new line, to that line
    track?: Record<number, { el: Element }>        // an existing connection line, to its connector
};

export const PAGE_MARGIN = 15, LOOSE_GAP = 10;   // mm
function emptyPageDoc(): XMLDocument {
    return parseXml(`<PageContents xmlns="${NS}" xmlns:r="${RNS}" xml:space="preserve"/>`);
}

/* Where every shape goes, in mm from the page's top-left. Shapes with a place in the text keep it. Containers are
   arranged first, innermost first: a container's loose members are laid out inside it, under its header, and then,
   unless the text gives its size, it is made big enough to hold them. A container with no place of its own goes
   round those of its members that have one. The page is then laid out with each container as one shape, and its
   loose members follow it. A pool of lanes stacks them, each as wide as the pool. */
function layoutPage(ap: FlowPage, sizes: Map<string, Size>, seqs: Map<string, MapUnit>): Map<string, XY> {
    const size = (id: string): Size => sizes.get(id)!;   // buildModel sizes every shape first
    const ROOT = '', HEAD = CONTAINER.header * 25.4, PAD = CONTAINER.pad * 25.4;
    const parent = (d: ShapeDecl): string => d.attrs.in ?? ROOT;   // parseFlow checked it: a container on this page, no loops
    const units = new Map([...mindMaps(ap, size), ...seqs]);
    const kidsOf = new Map<string, ShapeDecl[]>();
    for (const d of ap.shapes) {
        if (d.map || inSequence(d)) continue;   // a mind map topic, or a later lifeline: its map or sequence places it
        const p = parent(d);
        if (!kidsOf.has(p)) kidsOf.set(p, []);
        kidsOf.get(p)!.push(d);
    }
    const children = (id: string): ShapeDecl[] => kidsOf.get(id) ?? [];
    /* The child of `under` that holds shape id: the shape itself, or the container it is in, or that one's ... */
    const rootOf = (id: string): string => ap.byId.get(id)?.map?.root ?? ap.byId.get(id)?.seq?.root ?? id;
    const childOf = (id: string, under: string): string | null => {
        for (let d = ap.byId.get(id), n = 0; d && n <= ap.shapes.length; d = ap.byId.get(parent(d)), n++)
            if (parent(d) === under) return d.id;
        return null;
    };
    /* The connections between children of `under`, each end moved up to the child that holds it */
    const edgesAmong = (under: string): { from: string, to: string }[] => ap.edges.flatMap(e => {
        const a = childOf(rootOf(e.from), under), b = childOf(rootOf(e.to), under);
        return a && b && a !== b ? [{from: a, to: b}] : [];
    });
    /* Some shapes laid out in layers, from 0,0 */
    const layered = (ds: ShapeDecl[], under: string): Map<string, XY> => {
        const ids = new Set(ds.map(d => d.id));
        const g: LayoutGraph = {
            nodes: ds.map((d): LayoutNode => ({
                id: d.id,
                kind: units.has(d.id) ? 'process' : d.kind,
                columns: d.columns ?? undefined,
                cells: d.cells ?? undefined,
                w: size(d.id).w / 25.4,
                h: size(d.id).h / 25.4,
                x: 0, y: 0     // layoutGraph places them
            })),
            edges: edgesAmong(under).filter(e => ids.has(e.from) && ids.has(e.to)),
            direction: ap.direction,
            positioned: false
        };
        layoutGraph(g);
        /* beside a mind map, shapes joined to nothing go in a row underneath, as they would round a lone map */
        const lone = g.nodes.filter(n => !units.has(n.id) && !g.edges.some(e => e.from === n.id || e.to === n.id)),
            rest = g.nodes.filter(n => !lone.includes(n));
        if (lone.length && rest.some(n => units.has(n.id))) {
            let x = Math.min(...rest.map(n => n.x));
            const y = Math.max(...rest.map(n => n.y + n.h)) + LOOSE_GAP / 25.4;
            for (const n of lone) {
                n.x = x;
                n.y = y;
                x += n.w + LOOSE_GAP / 25.4;
            }
        }
        return new Map(g.nodes.map(n => [n.id, {x: n.x * 25.4, y: n.y * 25.4}]));
    };

    /* abs: shapes whose page position is known before the page is laid out; rel: loose members, from the top-left
       of their container */
    const abs = new Map<string, XY>(), rel = new Map<string, XY>();
    for (const d of ap.shapes) if (d.place) {   // a map whose branches would run off the page's top or left is moved in
        const u = units.get(d.id), at = u?.rel.get(d.id) ?? {x: 0, y: 0};
        abs.set(d.id, u ? {x: Math.max(0, d.place.x - at.x), y: Math.max(0, d.place.y - at.y)} : {
            x: d.place.x,
            y: d.place.y
        });
    }
    for (const [id, u] of units) sizes.set(id, {w: u.w, h: u.h});   // until the page is laid out: see spread
    const ownSize = (d: ShapeDecl): boolean => !!d.dims || (!!d.place && d.place.w != null);
    /* A scroll area keeps its size, as the text gives it or its default, and cuts off what doesn't fit */
    const keepsSize = (d: ShapeDecl): boolean => ownSize(d) || !!SHAPES[d.kind].scroll;
    /* A flexi container ([flow=row|column]): its members in text order along it, gap apart, lined up across it. Unless
       the text gives its size, it fits round them (its default size the least). given: the size its own flexi
       container stretched it to, when it is redone to stretch its members to match. */
    const flex = (c: ShapeDecl, given?: Size): void => {
        const ks = children(c.id), side = SHAPES[c.kind].container === 'side', row = c.attrs.flow === 'row',
            gap = c.attrs.gap ?? 4, align = c.attrs.align ?? 'stretch';
        const ox = (side ? HEAD : 0) + PAD, oy = (side ? 0 : HEAD) + PAD, own = given ?? size(c.id),
            main = (s: Size) => row ? s.w : s.h, cross = (s: Size) => row ? s.h : s.w,
            room = cross(own) - (row ? oy : ox) - PAD;   // across the inside, between header and padding
        const span = given || keepsSize(c) ? room : Math.max(room, ...ks.map(k => cross(size(k.id))));
        let at = 0;
        for (const k of ks) {
            abs.delete(k.id);   // the container places its members, whatever their own setting says
            const s = size(k.id);
            if (align === 'stretch' && !ownSize(k) && !(row && fixedHeight(k.kind))) {
                const stretched = row ? {w: s.w, h: span} : {w: span, h: s.h};
                sizes.set(k.id, stretched);
                if (k.attrs.flow) flex(k, stretched);
            }
            const t = size(k.id),
                off = align === 'center' ? (span - cross(t)) / 2 : align === 'end' ? span - cross(t) : 0;
            rel.set(k.id, row ? {x: ox + at, y: oy + off} : {x: ox + off, y: oy + at});
            at += main(t) + gap;
        }
        if (given) sizes.set(c.id, given);
        else if (!keepsSize(c) && ks.length) {
            const length = (row ? ox : oy) + at - gap + PAD, depth = (row ? oy : ox) + span + PAD;
            sizes.set(c.id, row ? {w: Math.max(own.w, length), h: depth} : {w: depth, h: Math.max(own.h, length)});
        }
    };
    const arrange = (c: ShapeDecl): void => {
        const ks = children(c.id), side = SHAPES[c.kind].container === 'side';
        for (const k of ks) if (isContainerKind(k.kind)) arrange(k);
        if (c.attrs.flow) return flex(c);
        const fixed = ks.filter(k => abs.has(k.id)), loose = ks.filter(k => !abs.has(k.id));
        const stack = side && ks.length > 0 && ks.every(k => k.kind === 'lane'), pad = stack ? 0 : PAD;
        const ox = (side ? HEAD : 0) + pad, oy = (side ? 0 : HEAD) + pad;
        if (!abs.has(c.id) && fixed.length) abs.set(c.id, {
            x: Math.min(...fixed.map(k => abs.get(k.id)!.x)) - ox,
            y: Math.min(...fixed.map(k => abs.get(k.id)!.y)) - oy
        });
        const at = abs.get(c.id);
        let top = oy;   // loose members go under the placed ones
        if (at && fixed.length) top = Math.max(oy, ...fixed.map(k => abs.get(k.id)!.y - at.y + size(k.id).h + (stack ? 0 : LOOSE_GAP)));
        if (stack) {
            let y = top;
            for (const k of loose) {
                rel.set(k.id, {x: ox, y});
                y += size(k.id).h;
            }
        } else if (loose.length) for (const [id, p] of layered(loose, c.id)) rel.set(id, {x: ox + p.x, y: top + p.y});
        if (!keepsSize(c)) {
            const own = size(c.id);
            let w = stack ? 0 : own.w, h = stack ? 0 : own.h;   // its default size is the least, except round lanes
            for (const k of ks) {
                const q = abs.get(k.id), p = rel.get(k.id) ?? (q && at ? {x: q.x - at.x, y: q.y - at.y} : null);
                if (!p) continue;
                w = Math.max(w, p.x + size(k.id).w + pad);
                h = Math.max(h, p.y + size(k.id).h + pad);
            }
            sizes.set(c.id, {w, h});
        }
        if (stack) for (const k of ks) if (!ownSize(k)) sizes.set(k.id, {w: size(c.id).w - HEAD, h: size(k.id).h});
    };
    const tops = children(ROOT);
    for (const d of tops) if (isContainerKind(d.kind)) arrange(d);
    /* members: placed ones where the text says, loose ones where their container went */
    const inside = (pos: Map<string, XY>): Map<string, XY> => {
        const into = (c: ShapeDecl): void => {
            const at = pos.get(c.id);
            if (!at) return;
            for (const k of children(c.id)) {
                const r = rel.get(k.id);
                pos.set(k.id, abs.get(k.id) ?? (r ? {x: at.x + r.x, y: at.y + r.y} : at));
                if (isContainerKind(k.kind)) into(k);
            }
        };
        for (const d of tops) if (isContainerKind(d.kind)) into(d);
        return pos;
    };

    /* each mind map from where its block went: the central topic and its topics where the map's own layout put them,
       and the central topic back to its own size */
    const spread = (pos: Map<string, XY>): Map<string, XY> => {
        for (const [id, u] of units) {
            const at = pos.get(id);
            if (!at) continue;
            for (const [m, r] of u.rel) pos.set(m, {x: at.x + r.x, y: at.y + r.y});
            sizes.set(id, u.own);
        }
        return pos;
    };
    const pos = new Map<string, XY>(), placed = tops.filter(d => abs.has(d.id)),
        loose = tops.filter(d => !abs.has(d.id));
    for (const d of placed) pos.set(d.id, abs.get(d.id)!);
    if (!loose.length) return spread(inside(pos));
    if (!placed.length) {   // nothing placed yet: lay the whole page out in layers
        for (const [id, p] of layered(loose, ROOT)) pos.set(id, {x: PAGE_MARGIN + p.x, y: PAGE_MARGIN + p.y});
        return spread(inside(pos));
    }
    /* some shapes are placed: put each unplaced shape next to a shape it connects to, in the first free spot */
    const boxes: Geo[] = placed.map(d => ({...pos.get(d.id)!, ...size(d.id)})), edges = edgesAmong(ROOT);
    const free = (x: number, y: number, w: number, h: number) => boxes.every(b => x + w + LOOSE_GAP <= b.x || b.x + b.w + LOOSE_GAP <= x || y + h + LOOSE_GAP <= b.y || b.y + b.h + LOOSE_GAP <= y);
    const nb = (id: string) => edges.filter(e => e.from === id || e.to === id).map(e => ({
        other: e.from === id ? e.to : e.from,
        below: e.to === id
    }));
    const queue = [...loose].sort((a, b) => nb(b.id).filter(n => pos.has(n.other)).length - nb(a.id).filter(n => pos.has(n.other)).length);
    const right = () => Math.max(...boxes.map(b => b.x + b.w)), top = () => Math.min(...boxes.map(b => b.y));
    const pending = [...queue], cap = pending.length * pending.length + 5;   // fixed: one shape is removed per iteration regardless,
    // so a cap that keeps shrinking with pending.length (rather than the original queue length) can cut the loop off
    // early and leave shapes with no position at all once there are more than about ten of them
    for (let guard = 0; pending.length && guard < cap; guard++) {
        let k = pending.findIndex(d => nb(d.id).some(n => pos.has(n.other)));
        const lone = k < 0;
        if (lone) k = 0;
        const d = pending.splice(k, 1)[0], {w, h} = size(d.id);
        let x: number, y: number;
        if (!lone) {
            const n = nb(d.id).find(n => pos.has(n.other))!, o = pos.get(n.other)!, os = size(n.other);
            x = o.x + os.w / 2 - w / 2;
            y = n.below ? o.y + os.h + LOOSE_GAP * 1.5 : o.y - h - LOOSE_GAP * 1.5;
            if (y < PAGE_MARGIN) y = o.y + os.h + LOOSE_GAP * 1.5;
        } else {
            x = right() + LOOSE_GAP * 2;
            y = top();
        }
        for (let t = 0; t < 60 && !free(x, y, w, h); t++) {
            if (t % 2 === 0) x += w / 2 + LOOSE_GAP; else y += h / 2 + LOOSE_GAP / 2;
        }
        pos.set(d.id, {x, y});
        boxes.push({x, y, w, h});
    }
    return spread(inside(pos));
}

/* A lifeline after the first in its sequence, which the sequence places */
const inSequence = (d: ShapeDecl | undefined): boolean => !!d?.seq && d.seq.root !== d.id;

/* Every sequence diagram on the page (see checkSequences), as a block standing on its first lifeline, like a mind map:
   its lifelines side by side in text order, tops level, all as long as the longest of them or as their messages
   need; and how far down from the lifelines' tops (in inches) each message runs, one under another in text order. A
   connection from a lifeline to itself isn't a message here (nor drawn: no shape's connection to itself is yet). */
const SEQ_GAP = 12, SEQ_STEP = 10;   // mm: between lifelines, and between messages

function sequences(ap: FlowPage, sizes: Map<string, Size>): {
    units: Map<string, MapUnit>,
    levels: Map<FlowEdge, number>
} {
    const units = new Map<string, MapUnit>(), levels = new Map<FlowEdge, number>(), head = LIFELINE_HEAD * 25.4;
    for (const r of ap.shapes) {
        if (r.seq?.root !== r.id) continue;
        const ls = ap.shapes.filter(d => d.seq?.root === r.id), ids = new Set(ls.map(d => d.id)),
            msgs = ap.edges.filter(e => e.from !== e.to && ids.has(e.from) && ids.has(e.to));
        const h = Math.max(...ls.map(d => sizes.get(d.id)!.h), head + SEQ_STEP * (msgs.length + 1));
        msgs.forEach((e, i) => levels.set(e, (head + SEQ_STEP * (i + 1)) / 25.4));
        const rel = new Map<string, XY>();
        let x = 0;
        for (const d of ls) {
            const w = sizes.get(d.id)!.w;
            sizes.set(d.id, {w, h});
            rel.set(d.id, {x, y: 0});
            x += w + SEQ_GAP;
        }
        units.set(r.id, {rel, w: x - SEQ_GAP, h, own: sizes.get(r.id)!});
    }
    return {units, levels};
}

/* Every mind map on the page laid out on its own (layoutMindMap, as its graph holds a central topic): its topics'
   places from the corner of the map's block, the block's size, and the central topic's own size. Its graph is the
   branch lines the map draws and the connections the text has between its shapes. */
type MapUnit = { rel: Map<string, XY>, w: number, h: number, own: Size };

function mindMaps(ap: FlowPage, size: (id: string) => Size): Map<string, MapUnit> {
    const units = new Map<string, MapUnit>();
    for (const c of ap.shapes) {
        const ms = ap.shapes.filter(d => d.map?.root === c.id);
        if (!ms.length) continue;
        const ids = new Set([c.id, ...ms.map(m => m.id)]);
        const g: LayoutGraph = {
            nodes: [c, ...ms].map((d): LayoutNode => ({
                id: d.id, kind: d.kind, w: size(d.id).w / 25.4, h: size(d.id).h / 25.4, x: 0, y: 0
            })),
            edges: [...ms.filter(m => m.map!.link).map(m => ({from: m.map!.parent, to: m.id})),
                ...ap.edges.filter(e => ids.has(e.from) && ids.has(e.to))],
            direction: ap.direction,
            positioned: false
        };
        layoutGraph(g);
        const rel = new Map(g.nodes.map(n => [n.id, {x: n.x * 25.4, y: n.y * 25.4}]));
        units.set(c.id, {
            rel,
            w: Math.max(...g.nodes.map(n => (n.x + n.w) * 25.4)),
            h: Math.max(...g.nodes.map(n => (n.y + n.h) * 25.4)),
            own: size(c.id)
        });
    }
    return units;
}

function applyShapeAttrs(el: Element, a: Attrs): void {
    if (a.fill) {
        setCell(el, 'FillForegnd', a.fill);
        setCell(el, 'FillPattern', 1);
    }
    if (a.stroke) {
        setCell(el, 'LineColor', a.stroke);
        if (numEl(el, 'LinePattern', 1) === 0) setCell(el, 'LinePattern', 1);
    }
    if (a.weight) setCell(el, 'LineWeight', a.weight / 72);
    if (a.icon) setUser(el, 'FlowIcon', a.icon);
    if (a.colours) setUser(el, 'FlowColours', a.colours);   // a chart or legend's series colours, read by render
    if (a.flow) setUser(el, 'FlowDir', a.flow);   // a flexi container's settings, read back by modelPage
    if (a.gap != null) setUser(el, 'FlowGap', a.gap);
    if (a.align) setUser(el, 'FlowAlign', a.align);
    if (a.scroll) setUser(el, 'FlowScroll', a.scroll);
    if (a.size) setTextPt(el, a.size);
    const tc = rowCellEl(el, 'Character', '0', 'Color');
    if (a.text && tc) tc.setAttribute('V', a.text);
}

function keyRows(ap: FlowPage): KeyRow[] {
    const rows = new Map<string, KeyRow>(), order = Object.keys(CONN);
    for (const e of ap.edges) {
        const t = resolveType(e),
            k = t === 'er' ? `er|${e.style}|${e.start}|${e.end}` : t === 'custom' ? `custom|${e.style}|${e.start}|${e.end}|${e.means}` : `${t}|${e.means}`;
        if (!rows.has(k)) rows.set(k, {e, t, name: connName(e), means: e.means || CONN[t].means});
    }
    return [...rows.values()].sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t));
}

/* the key is a group: a frame, a title and one sample line plus explanation per connection type used on the page */
function buildKey(doc: XMLDocument, first: number, L: number, Ttop: number, pg: Page, title: string,
                  rows: KeyRow[]): { el: Element, w: number, h: number, next: number } {
    const P = 0.12, TH = 0.36, LINE = 0.7, CH = 0.068;
    const texts = rows.length ? rows.map(r => `${r.name}: ${r.means}`) : ['No connections on this page yet.'];
    const TW = Math.min(4.6, Math.max(1.8, ...texts.map(t => t.length * CH)));
    const hs = texts.map(t => Math.max(0.3, Math.ceil(t.length * CH / TW) * 0.2 + 0.1)),
        H = TH + hs.reduce((a, b) => a + b, 0) + P, W = P + LINE + P + TW + P;
    let next = first;
    const B = pg.h - (Ttop + H);
    const g = mk(doc, 'Shape', {ID: String(next++), Type: 'Group', LineStyle: '0', FillStyle: '0', TextStyle: '0'}),
        C = (n: string, v: number, f?: string | null, u?: string) => g.appendChild(cellEl(doc, n, v, f, u));
    C('PinX', L + W / 2, null, 'MM');
    C('PinY', B + H / 2, null, 'MM');
    C('Width', W, null, 'MM');
    C('Height', H, null, 'MM');
    C('LocPinX', W / 2, 'Width*0.5', 'MM');
    C('LocPinY', H / 2, 'Height*0.5', 'MM');
    C('Angle', 0, null, 'DEG');
    C('FlipX', 0);
    C('FlipY', 0);
    setRole(g, 'key');
    setUser(g, 'FlowId', '__key');
    setUser(g, 'FlowKeyTitle', title);
    const inner = doc.createElementNS(NS, 'Shapes');
    g.appendChild(inner);
    const part = (el: Element) => {
        setRole(el, 'keyPart');
        inner.appendChild(el);
        return el;
    };
    const left = (el: Element) => {
        const c = rowCellEl(el, 'Paragraph', '0', 'HorzAlign');
        if (c) c.setAttribute('V', '0');
        return el;
    };
    part(buildShape(doc, 'process', String(next++), 0, 0, W, H, ''));
    const head = left(part(buildShape(doc, 'text', String(next++), P, H - TH, W - 2 * P, TH, title)));
    const chr = kids(head, 'Section').find(sec => sec.getAttribute('N') === 'Character'), row = chr && kid(chr, 'Row');
    if (row) row.appendChild(cellEl(doc, 'Style', 1));
    let y = H - TH;
    texts.forEach((t, i) => {
        y -= hs[i];
        if (rows[i]) {
            const mid = y + hs[i] - 0.15, ln = buildConnector(doc, String(next++), [P, mid], [P + LINE, mid]);
            setEdgeStyle(ln, rows[i].e);
            setCell(ln, 'LineColor', DEF.line);
            setConnector(ln, [P, mid], [P + LINE, mid], null, null);
            part(ln);
        }
        left(part(buildShape(doc, 'text', String(next++), P + LINE + P, y, TW, hs[i], t)));
    });
    return {el: g, w: W * 25.4, h: H * 25.4, next};
}

/* How a scroll area sits over its contents, along its bar: how much of them fits (1 when everything does), how far
   they're moved back in mm (its [scroll=], kept to what's left to see), and that as a share of the way, 0 to 1 */
function scrollState(ap: FlowPage, c: ShapeDecl, pos: Map<string, XY>, sizes: Map<string, Size>): {
    shown: number,
    by: number,
    at: number
} {
    const row = c.attrs.flow === 'row', at = pos.get(c.id)!, s = sizes.get(c.id)!, head = CONTAINER.header * 25.4;
    let end = 0;
    for (const d of ap.shapes) if (d.attrs.in === c.id) {
        const p = pos.get(d.id)!, z = sizes.get(d.id)!;
        end = Math.max(end, row ? p.x + z.w - at.x : p.y + z.h - at.y - head);
    }
    const room = row ? s.w : s.h - head, need = end + CONTAINER.pad * 25.4;
    const by = Math.max(0, Math.min(c.attrs.scroll ?? 0, need - room));
    return {shown: need > room ? room / need : 1, by, at: need > room ? by / (need - room) : 0};
}

export function buildModel(ast: FlowAst): void {
    const keepPi = S.pi;
    S.pages = [];
    S.built = [];
    S.masters = {};
    S.styles = {};
    ast.pages.forEach((ap, pi) => {
        const sizes = new Map<string, Size>();
        for (const d of ap.shapes) {
            const auto = autoSizeMM(d), p = d.place && d.place.w != null ? d.place : d.dims;
            sizes.set(d.id, {
                w: p && p.w != null ? p.w : auto.w,
                h: fixedHeight(d.kind) ? auto.h : p && p.h != null ? p.h : auto.h
            });
        }
        const seq = sequences(ap, sizes), pos = layoutPage(ap, sizes, seq.units), ext = {x: 0, y: 0};
        const within = (d: ShapeDecl): ShapeDecl[] => {   // the containers it's in, nearest first
            const cs: ShapeDecl[] = [];
            for (let c = d.attrs.in ? ap.byId.get(d.attrs.in) : undefined, n = 0; c && n <= ap.shapes.length; c = c.attrs.in ? ap.byId.get(c.attrs.in) : undefined, n++)
                cs.push(c);
            return cs;
        };
        // inside a scroll area, which cuts it off, so the page needn't hold it
        const scrolled = (d: ShapeDecl) => within(d).some(c => SHAPES[c.kind].scroll);
        /* where each shape is drawn: moved back by how far each scroll area it's in is scrolled. The text (and
           S.built) keep where it would be unscrolled; modelPage adds the scroll back (FlowScrollAt). */
        const scrolls = new Map(ap.shapes.filter(d => SHAPES[d.kind].scroll).map(d => [d.id, scrollState(ap, d, pos, sizes)])),
            drawn = new Map<string, XY>();
        for (const d of ap.shapes) {
            const p = pos.get(d.id)!, at = {x: p.x, y: p.y};
            for (const c of within(d)) {
                const by = scrolls.get(c.id)?.by ?? 0;
                if (c.attrs.flow === 'row') at.x -= by; else at.y -= by;
            }
            drawn.set(d.id, at);
        }
        for (const d of ap.shapes) {
            if (scrolled(d)) continue;
            const p = pos.get(d.id)!, s = sizes.get(d.id)!;
            ext.x = Math.max(ext.x, p.x + s.w);
            ext.y = Math.max(ext.y, p.y + s.h);
        }
        const rows = ap.key ? keyRows(ap) : [];
        const keyAt = ap.key ? (ap.key.place || {x: ext.x + LOOSE_GAP * 2, y: PAGE_MARGIN}) : null;
        if (keyAt) {
            ext.x = Math.max(ext.x, keyAt.x + 130);
            ext.y = Math.max(ext.y, keyAt.y + 20 + rows.length * 12);
        }
        // An explicit size (set in the Page panel) is the page itself, even when content reaches past it: nothing is
        // moved, resized or dropped for that, but the canvas keeps growing to hold it, and the renderer shows the
        // part past the page in grey. With no explicit size, the page grows with the content as before (a floor of
        // A4 landscape), so page and canvas are the same thing and nothing is ever shown as "past the page".
        const autoW = ext.x + PAGE_MARGIN, autoH = ext.y + PAGE_MARGIN;
        const pageW = ap.size ? ap.size[0] : Math.max(297, autoW), pageH = ap.size ? ap.size[1] : Math.max(210, autoH);
        const pw = Math.max(pageW, autoW), ph = Math.max(pageH, autoH);
        const pg: Page = {
            name: ap.name,
            w: pw / 25.4,
            h: ph / 25.4,
            pageW: pageW / 25.4,
            pageH: pageH / 25.4,
            doc: emptyPageDoc(),
            bg: false
        };
        S.pages.push(pg);
        S.pi = pi;
        const doc = pg.doc, shapes = ensureShapes(doc), built = new Map<string, Geo>(),
            elOf = new Map<string, string>();
        let next = 1;
        for (const d of ap.shapes) {
            const {w, h} = sizes.get(d.id)!, {x, y} = pos.get(d.id)!, at = drawn.get(d.id)!, L = at.x / 25.4,
                B = pg.h - (at.y + h) / 25.4, sc = scrolls.get(d.id);
            let el: Element;
            if (d.kind === 'table') {
                const columns = d.columns ?? [];
                el = buildTable(doc, next, L, B, w / 25.4, d.label || 'table', columns);
                next += 2 + columns.length;
            } else if (d.kind === 'grid') {
                const cells = d.cells ?? [];
                el = buildGrid(doc, next, next + 1, L, B, w / 25.4, cells);
                next += gridIds(cells);
            } else {
                el = buildShape(doc, d.kind, String(next++), L, B, w / 25.4, h / 25.4, d.label || '', d.values ?? undefined,
                    sc ? {...d.attrs, shown: sc.shown, at: sc.at} : d.attrs);
                applyShapeAttrs(el, d.attrs || {});
                if (sc?.by) setUser(el, 'FlowScrollAt', sc.by);   // how far its contents were moved back, for modelPage
            }
            setUser(el, 'FlowId', d.id);
            if (d.attrs.in) setUser(el, 'FlowIn', d.attrs.in);   // tables and grids can be in a container too
            shapes.appendChild(el);
            elOf.set(d.id, el.getAttribute('ID')!);   // the build functions always give it one
            built.set(d.id, {x, y, w, h});
        }
        if (ap.key && keyAt) {
            const k = buildKey(doc, next, keyAt.x / 25.4, keyAt.y / 25.4, pg, ap.key.title, rows);
            next = k.next;
            shapes.appendChild(k.el);
            built.set('__key', {x: keyAt.x, y: keyAt.y, w: k.w, h: k.h});
        }
        render();
        const conns: string[] = [];
        for (const e of ap.edges) {
            const a = elOf.get(e.from), b = elOf.get(e.to);
            if (!a || !b) continue;
            const id = String(next++), el = buildConnector(doc, id, pxToIn(centreOf(a), pg), pxToIn(centreOf(b), pg));
            shapes.appendChild(el);
            setEdgeStyle(el, e);
            if (e.label) setText(el, e.label);
            setUser(el, 'FlowEdge', String(e.line));
            const level = seq.levels.get(e);   // a sequence's message: refreshConnector keeps it level at this depth
            if (level != null && e.route !== 'elbow') setUser(el, 'FlowLevel', String(level));
            setGlue(id, 'Begin', a);
            setGlue(id, 'End', b);
            conns.push(id);
        }
        for (const d of ap.shapes) {   // a mind map's branch lines (see checkMindMaps)
            const a = d.map?.link ? elOf.get(d.map.parent) : undefined, b = elOf.get(d.id);
            if (!a || !b) continue;
            const id = String(next++), el = buildConnector(doc, id, pxToIn(centreOf(a), pg), pxToIn(centreOf(b), pg));
            shapes.appendChild(el);
            setEdgeStyle(el, {style: 'solid', start: 'none', end: 'none'});
            setUser(el, 'FlowAuto', '1');
            setGlue(id, 'Begin', a);
            setGlue(id, 'End', b);
            conns.push(id);
        }
        render();
        for (const id of conns) refreshConnector(id);
        S.built.push(built);
    });
    S.pi = Math.max(0, Math.min(keepPi, S.pages.length - 1));
}

/* ---------- canvas to text ---------- */
export function geoMM(el: Element, pg: { h: number }): Geo {
    const W = numEl(el, 'Width', 0), H = numEl(el, 'Height', 0), L = numEl(el, 'PinX', 0) - numEl(el, 'LocPinX', W / 2),
        B = numEl(el, 'PinY', 0) - numEl(el, 'LocPinY', H / 2);
    return {x: L * 25.4, y: (pg.h - (B + H)) * 25.4, w: W * 25.4, h: H * 25.4};
}

export function modelPage(pi: number): ModelPage {
    const idOf = (el: Element) => el.getAttribute('ID') ?? '';
    const pg = S.pages[pi], doc = pg.doc, top = kids(kid(doc.documentElement, 'Shapes'), 'Shape'),
        topOf: Record<string, Element> = {}, fidOf: Record<string, string> = {}, shapes: ModelShape[] = [],
        edges: ModelEdge[] = [];
    const used = new Set(top.map(el => userV(el, 'FlowId')).filter((f): f is string => !!f));
    let key: ModelPage['key'] = null;
    for (const el of top) {
        topOf[idOf(el)] = el;
        for (const c of el.getElementsByTagNameNS(NS, 'Shape')) topOf[idOf(c)] = el;
    }
    for (const el of top) {
        const sh = shapeCtx(el, null);
        if (is1D(sh)) continue;
        const role = roleOf(el), geo = geoMM(el, pg);
        if (role === 'key') {
            key = {title: userV(el, 'FlowKeyTitle') || 'Key', geo};
            continue;
        }
        const kind: ShapeKind = isShapeKind(role) && !isPartKind(role) ? role : 'process',
            s: ModelShape = {el, id: '', kind, geo, label: '', attrs: {}};   // id is filled in below
        if (kind === 'table') {
            const p = tableParts(el);
            s.label = p.header ? shapeText(shapeCtx(p.header, null)) : '';
            s.columns = p.rows.map(r => shapeText(shapeCtx(r, null)));
        } else if (kind === 'grid') {
            s.label = '';
            s.cells = gridParts(el).rows.map(r => r.map(c => shapeText(shapeCtx(c, null))));
        } else {
            const vals = userV(el, 'FlowValues');
            if (vals) s.values = cellValues(vals);
            s.label = shapeText(sh);
            const T = SHAPES[kind],
                diff = (v: string | null, d: unknown) => v && v.toUpperCase() !== String(d).toUpperCase() ? v.toUpperCase() : null;
            s.attrs = {
                fill: T.bare ? null : diff(colour(cellV(sh, 'FillForegnd', null), null), T.fill || DEF.fill),
                stroke: T.bare ? null : diff(colour(cellV(sh, 'LineColor', null), null), DEF.line),
                text: diff(colour(rowV(sh, 'Character', '0', 'Color'), null), T.textColour || DEF.text),
                weight: T.bare ? null : weightOf(sh),
                icon: userV(el, 'FlowIcon') || null,
                state: T.stateful && userV(el, 'FlowState') === 'on' ? 'on' : null,
                side: T.sides && userV(el, 'FlowSide') === 'right' ? 'right' : null,
                bg: T.bg && userV(el, 'FlowBg') === 'off' ? 'off' : null,
                bgfill: T.bg ? userV(el, 'FlowBgFill') || null : null,
                map: T.maps ? userV(el, 'FlowMap') || null : null,
                lang: T.langs ? userV(el, 'FlowLang') || null : null,
                face: T.faces ? userV(el, 'FlowFace') || null : null,
                colours: T.colours ? userV(el, 'FlowColours') || null : null,
                flow: T.container ? (userV(el, 'FlowDir') as FlowDir | null) || null : null,
                gap: T.container && userV(el, 'FlowGap') != null ? Number(userV(el, 'FlowGap')) : null,
                align: T.container ? (userV(el, 'FlowAlign') as FlowAlign | null) || null : null,
                scroll: T.scroll && Number(userV(el, 'FlowScroll')) > 0 ? Number(userV(el, 'FlowScroll')) : null,
                size: (pt => pt && Math.abs(pt - SHAPE_TEXT_PT) > 0.01 ? pt : null)(textPt(sh))
            };
        }
        let fid = userV(el, 'FlowId');
        if (!fid) {
            fid = uniqueFid(s.label || kind, used);
            used.add(fid);
            setUser(el, 'FlowId', fid);
        }
        s.id = fid;
        fidOf[idOf(el)] = fid;
        shapes.push(s);
    }
    /* the container each shape is in, read for every kind (a table or grid can be in one too); one that is no longer
       on the page, after a delete, is dropped, which takes its members out */
    const frames = new Set(shapes.filter(s => isContainerKind(s.kind)).map(s => s.id));
    for (const s of shapes) {
        const fin = userV(s.el, 'FlowIn');
        s.attrs.in = fin && fin !== s.id && frames.has(fin) ? fin : null;
    }
    /* A shape in a scroll area was drawn moved back by how far it's scrolled (buildModel's FlowScrollAt), so where
       it goes in the text is that much further on. One dragged in or out is read where it's dropped. */
    const byFid = new Map(shapes.map(s => [s.id, s]));
    for (const s of shapes)
        for (let c = s.attrs.in ? byFid.get(s.attrs.in) : undefined, n = 0; c && n <= shapes.length; c = c.attrs.in ? byFid.get(c.attrs.in) : undefined, n++) {
            const by = Number(userV(c.el, 'FlowScrollAt')) || 0;
            if (c.attrs.flow === 'row') s.geo.x += by; else s.geo.y += by;
        }
    const cons = kids(connectsEl(doc, false), 'Connect');
    for (const el of top) {
        const sh = shapeCtx(el, null);
        if (!is1D(sh) || userV(el, 'FlowAuto')) continue;   // a mind map's branch line: drawn from the text, never written
        const id = el.getAttribute('ID');
        const end = (e: 'Begin' | 'End') => {
            const c = cons.find(c => c.getAttribute('FromSheet') === id && c.getAttribute('FromCell') === e + 'X'),
                t = c && topOf[c.getAttribute('ToSheet') ?? ''];
            return t ? fidOf[idOf(t)] || null : null;
        };
        edges.push({
            el,
            key: userV(el, 'FlowEdge'),
            from: end('Begin'),
            to: end('End'),
            label: shapeText(sh).trim(), ...edgeStyleOf(el)
        });
    }
    return {shapes, edges, key};
}

/* inFlow: the shape is in a flexi container, which places it, so it gets no position: only a size, if it has its
   own (it had one, or it was resized on the page) */
function modelShapeObj(s: ModelShape, d: ShapeDecl | undefined, built: Map<string, Geo>, inFlow = false): ShapeObj {
    const b = built.get(s.id), g = s.geo, near = (a: number, c: number) => Math.abs(a - c) <= 0.06;
    const moved = !b || !near(b.x, g.x) || !near(b.y, g.y),
        resized = !b || !near(b.w, g.w) || (!fixedHeight(s.kind) && !near(b.h, g.h));
    const auto = autoSizeMM(s), had = d && !d.implicit && d.place && d.place.w != null;
    const differs = Math.abs(g.w - auto.w) > 0.6 || (!fixedHeight(s.kind) && Math.abs(g.h - auto.h) > 0.6);
    if (inFlow) {
        const own = (d && !d.implicit && (d.dims || had)) || (!!b && resized && differs);
        return {
            id: s.id,
            kind: s.kind,
            label: s.label,
            columns: s.columns,
            cells: s.cells,
            values: s.values,
            attrs: s.attrs,
            place: null,
            dims: own ? {w: g.w, h: fixedHeight(s.kind) ? fixedH(s) : g.h} : null
        };
    }
    const placed = (d && !d.implicit && d.place) || moved || !d;
    // a container is sized round its members only until it is placed, moved or resized on the page: from then on its
    // size is written down, so it stays put when they move
    const frame = isContainerKind(s.kind) && (moved || resized || !(d && !d.implicit && d.place));
    const sized = had || frame || (resized && differs);
    return {
        id: s.id, kind: s.kind, label: s.label, columns: s.columns, cells: s.cells, values: s.values, attrs: s.attrs,
        place: placed ? {
            x: g.x,
            y: g.y,
            w: sized ? g.w : null,
            h: sized ? (fixedHeight(s.kind) ? fixedH(s) : g.h) : null
        } : null
    };
}

/* A container and its members are placed all together or not at all: once one of them is given a place (it was
   moved, say), the rest are given the place they have now, so the next layout can't pull them apart. Containers
   get their size written down with it. */
function placeFamilies(shapes: ModelShape[], objs: Map<string, ShapeObj>, inFlow: (s: ModelShape) => boolean): void {
    const fam = new Map<string, ModelShape[]>();
    for (const s of shapes) if (isContainerKind(s.kind)) fam.set(s.id, [s]);
    for (const s of shapes) if (s.attrs.in && !inFlow(s)) fam.get(s.attrs.in)?.push(s);   // a flexi container places its own
    for (let changed = true, n = 0; changed && n <= shapes.length; n++) {
        changed = false;
        for (const group of fam.values()) {
            if (!group.some(s => objs.get(s.id)!.place) || group.every(s => objs.get(s.id)!.place)) continue;
            for (const s of group) {
                const o = objs.get(s.id)!;
                if (o.place) continue;
                const box = isContainerKind(s.kind);
                o.place = {x: s.geo.x, y: s.geo.y, w: box ? s.geo.w : null, h: box ? s.geo.h : null};
                changed = true;
            }
        }
    }
}

/* canon with the old line's indent and trailing comment kept */
export function withTail(old: string, canon: string): string {
    const indent = (old.match(/^\s*/) || [''])[0], c = splitComment(old).comment;
    return indent + canon + (c ? '  ' + c.trim() : '');
}

/* write the model back into the text, rewriting only statements that changed */
export function syncFromModel(): SyncResult {
    const ast = S.ast;
    if (!ast || S.present) return {};   // a step of the animation is on the canvas, not the text
    const L = S.text.split('\n'), repl = new Map<number, string>(), del = new Set<number>(),
        perm = new Map<number, number>(),
        ins = new Map<number, { text: string, tag?: { el: Element } }[]>(), track: Record<number, { el: Element }> = {},
        gone = new Set<string>(), alive = new Set<string>();   // shapes deleted on the canvas, and those still there
    const add = (after: number, text: string, tag?: { el: Element }) => {
        if (!ins.has(after)) ins.set(after, []);
        ins.get(after)!.push({text, tag});
    };
    S.pages.forEach((pg, pi) => {
        const ap = ast.pages[pi];
        if (!ap) return;
        const m = modelPage(pi), built = S.built[pi] || new Map(), seen = new Set(), seenE = new Set();
        const shapeAt = ap.lastShapeLine ?? ap.headerLine ?? ap.endLine, edgeAt = ap.lastEdgeLine ?? shapeAt;
        const byId = new Map(m.shapes.map(s => [s.id, s])),
            flexOf = (s: ModelShape) => s.attrs.in && byId.get(s.attrs.in)?.attrs.flow ? byId.get(s.attrs.in)! : null;
        const inMap = (s: ModelShape) => !!ap.byId.get(s.id)?.map || inSequence(ap.byId.get(s.id));   // its mind map or sequence places it
        const objs = new Map(m.shapes.map(s => [s.id, modelShapeObj(s, ap.byId.get(s.id), built, !!flexOf(s) || inMap(s))]));
        placeFamilies(m.shapes, objs, s => !!flexOf(s) || inMap(s));
        const lineOf = (s: ModelShape) => {
            const d = ap.byId.get(s.id);
            return d && !d.implicit ? d.line : null;
        };
        for (const s of m.shapes) {
            const d = ap.byId.get(s.id), canon = shapeStmt(objs.get(s.id)!);
            seen.add(s.id);
            if (d && !d.implicit) {
                const line = d.line!;   // only implicit shapes have no line
                if (canon !== shapeStmt(declObj(d))) repl.set(line, withTail(L[line], canon));
            } else if (!flexOf(s) && (!d || canon !== shapeStmt(declObj(d)))) add(shapeAt, canon);
        }
        /* A flexi container's members go in the order of their lines, so put the lines in the order they are in on the
           page now: the lines they already use are shared out again, and a new member's line goes in after its
           neighbour's (or just before the first member's, or after the container's when it has none yet). A shape
           just dropped in from elsewhere counts as new: its line moves to join the others. */
        for (const c of m.shapes.filter(s => s.attrs.flow)) {
            const row = c.attrs.flow === 'row',
                mid = (s: ModelShape) => row ? s.geo.x + s.geo.w / 2 : s.geo.y + s.geo.h / 2;
            const members = m.shapes.filter(s => s.attrs.in === c.id).sort((a, b) => mid(a) - mid(b));
            const stays = (s: ModelShape) => lineOf(s) != null && ap.byId.get(s.id)!.attrs.in === c.id;
            for (const s of members) if (lineOf(s) != null && !stays(s)) del.add(lineOf(s)!);
            const old = members.filter(stays), slots = old.map(s => lineOf(s)!).sort((a, b) => a - b);
            old.forEach((s, i) => {
                if (slots[i] !== lineOf(s)) perm.set(slots[i], lineOf(s)!);
            });
            let after = slots.length ? slots[0] - 1 : lineOf(c) ?? shapeAt, k = 0;
            for (const s of members) {
                if (stays(s)) after = slots[k++];
                else add(after, lineOf(s) != null ? withTail(L[lineOf(s)!], shapeStmt(objs.get(s.id)!)) : shapeStmt(objs.get(s.id)!));
            }
        }
        for (const d of ap.shapes) if (!d.implicit && d.line != null && !seen.has(d.id)) {
            del.add(d.line);
            gone.add(d.id);
        }
        for (const id of seen) alive.add(id as string);
        for (const e of m.edges) {
            const {from, to} = e;
            if (!from || !to || from === to) continue;
            const canon = edgeStmt({...e, from, to}), ae = e.key != null ? ap.edgeByLine.get(+e.key) : null;
            if (ae && !seenE.has(ae.line)) {
                seenE.add(ae.line);
                if (canon !== edgeStmt(ae)) repl.set(ae.line, withTail(L[ae.line], canon));
                track[ae.line] = {el: e.el};
            } else add(edgeAt, canon, {el: e.el});
        }
        for (const ae of ap.edges) if (!seenE.has(ae.line)) del.add(ae.line);
        if (ap.key && !m.key) del.add(ap.key.line);
        else if (m.key) {
            const b = built.get('__key'),
                moved = !b || Math.abs(b.x - m.key.geo.x) > 0.06 || Math.abs(b.y - m.key.geo.y) > 0.06;
            const k = {
                title: m.key.title,
                place: (ap.key && ap.key.place) || moved ? {x: m.key.geo.x, y: m.key.geo.y} : null
            };
            if (ap.key) {
                const c = keyStmt(k);
                if (c !== keyStmt(ap.key)) repl.set(ap.key.line, withTail(L[ap.key.line], c));
            } else add(shapeAt, keyStmt(k));
        }
    });
    /* the @animation block's lines for shapes deleted here go with them, so it still reads: then a step with nothing
       left to do, and the block itself once it has no steps */
    const anim = ast.animation;
    if (anim && anim.end != null && [...gone].some(id => !alive.has(id))) {
        let left = 0;
        for (const st of anim.steps) {
            const keep = st.ops.filter(o => o.op === 'add' || !gone.has(o.id) || alive.has(o.id));
            for (const o of st.ops) if (!keep.includes(o)) del.add(o.line);
            if (keep.length) left++; else del.add(st.line);
        }
        if (!left) for (let i = anim.start; i <= anim.end; i++) del.add(i);
    }
    const out: string[] = [], lineMap = new Map<number, number>(), placedTags = new Map<Element, number>();
    const flush = (after: number) => {
        for (const it of ins.get(after) || []) {
            if (it.tag) placedTags.set(it.tag.el, out.length);
            out.push(it.text);
        }
    };
    flush(-1);
    for (let i = 0; i < L.length; i++) {
        if (!del.has(i)) {
            lineMap.set(i, out.length);
            const src = perm.get(i) ?? i;   // a flexi container's member line, moved to keep its members in order
            out.push(repl.get(src) ?? L[src]);
        }
        flush(i);
    }
    if (L.length === 0) flush(0);
    S.text = out.join('\n');
    return {lineMap, placedTags, track};
}
