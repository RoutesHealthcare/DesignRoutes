/* ---------- connectors and glue ---------- */
import {
    NS,
    PX,
    S,
    WALK,
    cellEl,
    delCell,
    insertSection,
    kid,
    kids,
    mk,
    setCell,
    type Box,
    type Pt
} from './core';
import {is1D, num, shapeCtx} from './visio-package';
import {pageCtx} from './render';
import {delUser, parseVia, setUser, userV, viaToStr} from './flow/model';
import {isContainer} from './containers';

/* A shape's four snap points, the midpoints of its sides */
export type Side = 'n' | 'e' | 's' | 'w';
export const SNAP_SIDES: Side[] = ['n', 'e', 's', 'w'];

/* One <Connect>: connector `from` has the end named by `fromCell` ('BeginX' or 'EndX') glued to shape `to` */
export type Connect = { el: Element, from: string | null, fromCell: string | null, to: string | null };
/* How a drag moved shapes, for refreshForMany: dx, dy in page inches, `from` the bends when it began */
export type Shift = { dx: number, dy: number, from?: Map<string, Pt[]> };

/* The page's <Connects> section. With create, it's added (after <Shapes>) if missing, so it's never null */
export function connectsEl(doc: Document, create: true): Element;
export function connectsEl(doc: Document, create: boolean): Element | null;
export function connectsEl(doc: Document, create: boolean): Element | null {
    const root = doc.documentElement;
    let c = kid(root, 'Connects');
    if (!c && create) {
        c = doc.createElementNS(NS, 'Connects');
        const sh = kid(root, 'Shapes');
        root.insertBefore(c, sh ? sh.nextSibling : null);
    }
    return c;
}

export function listConnects(): Connect[] {
    return kids(connectsEl(pageCtx().doc, false), 'Connect').map(c => ({
        el: c,
        from: c.getAttribute('FromSheet'),
        fromCell: c.getAttribute('FromCell'),
        to: c.getAttribute('ToSheet')
    }));
}

export function setGlue(cid: string, end: 'Begin' | 'End', toId: string | null | undefined): void {
    const doc = pageCtx().doc, ce = connectsEl(doc, true);
    for (const c of kids(ce, 'Connect')) if (c.getAttribute('FromSheet') === cid && c.getAttribute('FromCell') === end + 'X') c.remove();
    if (toId) ce.appendChild(mk(doc, 'Connect', {
        FromSheet: cid,
        FromCell: end + 'X',
        FromPart: end === 'Begin' ? '9' : '12',
        ToSheet: toId,
        ToCell: 'PinX',
        ToPart: '3'
    }));
    if (!kids(ce, 'Connect').length) ce.remove();
}

function raySeg(p: Pt, d: Pt, a: Pt, b: Pt): number | null {
    const e = [b[0] - a[0], b[1] - a[1]], den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) return null;
    const w = [a[0] - p[0], a[1] - p[1]], t = (w[0] * e[1] - w[1] * e[0]) / den, u = (w[0] * d[1] - w[1] * d[0]) / den;
    return (u < -1e-9 || u > 1 + 1e-9) ? null : t;
}

export const centreOf = (id: string): Pt => {
    const b = S.boxes[id];
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
};

function anchorFor(id: string, toward: Pt): Pt {
    const b = S.boxes[id], c = centreOf(id);
    const polys = S.polys[id] || [[[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]];
    const d: Pt = [toward[0] - c[0], toward[1] - c[1]];
    if (Math.hypot(d[0], d[1]) < 1e-6) return c;
    let best: number | null = null;
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
        const t = raySeg(c, d, poly[i], poly[(i + 1) % poly.length]);
        if (t != null && t > 1e-6 && (best == null || t < best)) best = t;
    }
    if (best == null) return c;
    const t = Math.min(best, 1);
    return [c[0] + d[0] * t, c[1] + d[1] * t];
}

const CARD_DIR: Record<string, Pt> = {n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0]};

/* A connection's end as written: a side (n, e, s or w), and how far along it (0 to 1, down e and w, across n and s),
   which is the middle when it isn't given (e@0.3 is 0.3 of the way down the right side) */
const endSpec = (v: string): { side: string, at: number | null } => {
    const [side, at] = v.split('@');
    return {side, at: at != null && Number.isFinite(+at) ? Math.max(0, Math.min(1, +at)) : null};
};

/* The point on a shape's box for an end like e or e@0.3 (page pixels), or null for anything else */
function sidePoint(b: Box, v: string): Pt | null {
    const {side, at} = endSpec(v), f = at ?? 0.5, x = b.x0 + (b.x1 - b.x0) * f, y = b.y0 + (b.y1 - b.y0) * f;
    return ({n: [x, b.y0], s: [x, b.y1], e: [b.x1, y], w: [b.x0, y]} as Record<string, Pt>)[side] ?? null;
}

/* Where a connection glued to one of a shape's snap points lands on the outline: the middle of a side (n, e, s, w),
   or a point along it (e@0.3). A point along a side where the shape has no outline (a lifeline below its head) is on
   the line through its middle instead: a lifeline's dashed line. `side` is a string, not a Side, because it comes from
   the text and the file; anything else gives the centre. */
export function cardinalPoint(id: string, side: string): Pt {
    const b = S.boxes[id], base = b && sidePoint(b, side);
    if (!b || !base) return centreOf(id);
    const s = endSpec(side).side, d = CARD_DIR[s], out: Pt = [base[0] + d[0] * STUB, base[1] + d[1] * STUB];
    if (endSpec(side).at == null) return landOn(id, out);
    const c = centreOf(id);
    return hitAlong(id, out, [-d[0], -d[1]]) ?? (s === 'e' || s === 'w' ? [c[0], base[1]] : [base[0], c[1]]);
}

/* b, e and bends are page inches. With bends the line is drawn as a polyline the way Visio stores its dynamic
   connectors: no rotation, Width and Height spanning begin to end, and one geometry row per point. */
export function setConnector(el: Element, b: Pt, e: Pt, bTo: string | null, eTo: string | null, bends: Pt[] = []): void {
    const doc = el.ownerDocument, L = Math.hypot(e[0] - b[0], e[1] - b[1]), ang = Math.atan2(e[1] - b[1], e[0] - b[0]);
    if (bTo || eTo) {
        setCell(el, 'BegTrigger', bTo ? 2 : 0, bTo ? `_XFTRIGGER(Sheet.${bTo}!EventXFMod)` : undefined);
        setCell(el, 'EndTrigger', eTo ? 2 : 0, eTo ? `_XFTRIGGER(Sheet.${eTo}!EventXFMod)` : undefined);
    } else {
        delCell(el, 'BegTrigger');
        delCell(el, 'EndTrigger');
    }
    setCell(el, 'BeginX', b[0], bTo ? WALK : undefined);
    setCell(el, 'BeginY', b[1], bTo ? WALK : undefined);
    setCell(el, 'EndX', e[0], eTo ? WALK : undefined);
    setCell(el, 'EndY', e[1], eTo ? WALK : undefined);
    setCell(el, 'PinX', (b[0] + e[0]) / 2, 'GUARD((BeginX+EndX)/2)');
    setCell(el, 'PinY', (b[1] + e[1]) / 2, 'GUARD((BeginY+EndY)/2)');
    setCell(el, 'FlipX', 0);
    setCell(el, 'FlipY', 0);
    for (const s of kids(el, 'Section')) if (s.getAttribute('N') === 'Geometry') s.remove();
    const sec = mk(doc, 'Section', {
        N: 'Geometry',
        IX: '0'
    }, [cellEl(doc, 'NoFill', 1), cellEl(doc, 'NoLine', 0), cellEl(doc, 'NoShow', 0)]);
    let rowCount: number;
    if (bends.length) {
        const W = e[0] - b[0], H = e[1] - b[1],
            local: Pt[] = [[0, 0], ...[...bends, e].map((p): Pt => [p[0] - b[0], p[1] - b[1]])];
        setCell(el, 'Width', W, 'GUARD(EndX-BeginX)');
        setCell(el, 'Height', H, 'GUARD(EndY-BeginY)');
        setCell(el, 'Angle', 0);
        setCell(el, 'LocPinX', W / 2, 'GUARD(Width*0.5)');
        setCell(el, 'LocPinY', H / 2, 'GUARD(Height*0.5)');
        local.forEach((p, i) => sec.appendChild(mk(doc, 'Row', {
            T: i ? 'LineTo' : 'MoveTo',
            IX: String(i + 1)
        }, [cellEl(doc, 'X', p[0]), cellEl(doc, 'Y', p[1])])));
        const mid = pathMidpoint(local);
        setCell(el, 'TxtPinX', mid[0]);
        setCell(el, 'TxtPinY', mid[1]);   // the label sits halfway along the line
        rowCount = local.length;
    } else {
        setCell(el, 'Width', L, 'GUARD(SQRT((EndX-BeginX)^2+(EndY-BeginY)^2))');
        setCell(el, 'Height', 0);
        setCell(el, 'Angle', ang, 'GUARD(ATAN2(EndY-BeginY,EndX-BeginX))');
        setCell(el, 'LocPinX', L / 2, 'GUARD(Width*0.5)');
        setCell(el, 'LocPinY', 0, 'GUARD(Height*0.5)');
        delCell(el, 'TxtPinX');
        delCell(el, 'TxtPinY');
        sec.appendChild(mk(doc, 'Row', {
            T: 'MoveTo',
            IX: '1'
        }, [cellEl(doc, 'X', 0, 'Width*0'), cellEl(doc, 'Y', 0, 'Height*0.5')]));
        sec.appendChild(mk(doc, 'Row', {
            T: 'LineTo',
            IX: '2'
        }, [cellEl(doc, 'X', L, 'Width*1'), cellEl(doc, 'Y', 0, 'Height*0.5')]));
        rowCount = 2;
    }
    const sh = shapeCtx(el, null);
    if (sh.mel) for (const ms of kids(sh.mel, 'Section')) if (ms.getAttribute('N') === 'Geometry') {
        const ix = ms.getAttribute('IX') || '0';
        if (ix === '0') {
            for (const r of kids(ms, 'Row')) {
                const rix = r.getAttribute('IX');
                if (Number(rix) > rowCount) sec.appendChild(mk(doc, 'Row', {
                    T: r.getAttribute('T'),
                    IX: rix,
                    Del: '1'
                }));
            }
        } else insertSection(el, mk(doc, 'Section', {N: 'Geometry', IX: ix, Del: '1'}));
    }
    insertSection(el, sec);
}

/* The shapes a connector's two ends are glued to, when those shapes are drawn */
function gluedEnds(cid: string): { bTo: string | null, eTo: string | null } {
    const cons = listConnects().filter(c => c.from === cid);
    let bTo = cons.find(c => c.fromCell === 'BeginX')?.to || null,
        eTo = cons.find(c => c.fromCell === 'EndX')?.to || null;
    if (bTo && !S.boxes[bTo]) bTo = null;
    if (eTo && !S.boxes[eTo]) eTo = null;
    return {bTo, eTo};
}

const mmToPx = ([x, y]: Pt): Pt => [x / 25.4 * PX, y / 25.4 * PX],
    pxToMM = ([x, y]: Pt): Pt => [x / PX * 25.4, y / PX * 25.4];
/* A right-angled line's bend points, in mm from the page's top-left corner, as stored on the connector */
export const bendsMM = (cid: string): Pt[] => {
    const el = S.elById[cid];
    return el ? parseVia(userV(el, 'FlowVia')) || [] : [];
};

export function setBends(cid: string, via: Pt[] | null): void {
    const el = S.elById[cid];
    if (!el) return;
    if (via && via.length) setUser(el, 'FlowVia', viaToStr(via)); else delUser(el, 'FlowVia');
}

/* Bend points from an import only fit the shapes where they were; dragging a line's end off its shape re-routes it */
export function clearBends(cid: string): void {
    setBends(cid, null);
}

function endsPx(el: Element): [Pt, Pt] {
    const pg = pageCtx(), sh = shapeCtx(el, null), toPx = (x: number, y: number): Pt => [x * PX, (pg.h - y) * PX];
    return [toPx(num(sh, 'BeginX', 0), num(sh, 'BeginY', 0)), toPx(num(sh, 'EndX', 0), num(sh, 'EndY', 0))];
}

export function refreshConnector(cid: string): void {
    const pg = pageCtx(), el = S.elById[cid];
    if (!el || el.parentNode !== kid(pg.doc.documentElement, 'Shapes')) return;
    const toIn = (q: Pt): Pt => [q[0] / PX, pg.h - q[1] / PX], {bTo, eTo} = gluedEnds(cid);
    let [b, e] = endsPx(el);
    const beginPt = userV(el, 'FlowBeginPt'), endPt = userV(el, 'FlowEndPt'), level = userV(el, 'FlowLevel');
    if (level != null && bTo && eTo && !beginPt && !endPt) {   // a sequence's message: level, from line to line
        const y = (id: string) => S.boxes[id].y0 + Number(level) * PX;
        setConnector(el, toIn([centreOf(bTo)[0], y(bTo)]), toIn([centreOf(eTo)[0], y(eTo)]), bTo, eTo);
        return;
    }
    if (userV(el, 'FlowRoute') === 'elbow') {
        const via = bendsMM(cid).map(mmToPx), fitted = fitBends(via, bTo, eTo);
        if (fitted.changed) setBends(cid, fitted.via.map(pxToMM));
        const pts = elbowRoute(bTo, eTo, b, e, fitted.via, beginPt, endPt);
        setConnector(el, toIn(pts[0]), toIn(pts[pts.length - 1]), bTo, eTo, pts.slice(1, -1).map(toIn));
        return;
    }
    const bc = bTo ? centreOf(bTo) : b, ec = eTo ? centreOf(eTo) : e;
    if (bTo) b = beginPt ? cardinalPoint(bTo, beginPt) : anchorFor(bTo, ec);
    if (eTo) e = endPt ? cardinalPoint(eTo, endPt) : anchorFor(eTo, bc);
    setConnector(el, toIn(b), toIn(e), bTo, eTo);
}

/* Every point of a right-angled line as drawn now, in page pixels, ends included */
export function routePoints(cid: string): Pt[] {
    const el = S.elById[cid];
    if (!el) return [];
    const {bTo, eTo} = gluedEnds(cid), [b, e] = endsPx(el);
    return elbowRoute(bTo, eTo, b, e, fitBends(bendsMM(cid).map(mmToPx), bTo, eTo).via, userV(el, 'FlowBeginPt'), userV(el, 'FlowEndPt'));
}

/* ---------- moving shapes ---------- */
function withChildren(ids: Iterable<string>): Set<string> {
    const out = new Set<string>();
    for (const id of ids) {
        const el = S.elById[id];
        if (!el) continue;
        out.add(id);
        for (const s of el.getElementsByTagNameNS(NS, 'Shape')) {
            const sid = s.getAttribute('ID');
            if (sid) out.add(sid);
        }
    }
    return out;
}

const linesTouching = (moved: Set<string>): Set<string> =>
    new Set(listConnects().flatMap(c => c.from && c.to && moved.has(c.to) ? [c.from] : []));

/* The bends of every line attached to these shapes, so a drag can always work from where they started */
export function bendsAround(ids: Iterable<string>): Map<string, Pt[]> {
    const m = new Map<string, Pt[]>();
    for (const c of linesTouching(withChildren(ids))) m.set(c, bendsMM(c));
    return m;
}

/* Re-routes the lines attached to shapes that moved or changed size. With shift ({dx,dy} in page inches, and
   optionally `from`, the bends when the move began) a line whose two ends both moved keeps its route and moves
   with them; a line with one end moved keeps its bends, and the one next to that end slides to stay square. */
export function refreshForMany(ids: Iterable<string>, shift?: Shift): void {
    const moved = withChildren(ids);
    for (const c of linesTouching(moved)) {
        if (shift) {
            const ends = listConnects().filter(x => x.from === c),
                both = ends.length === 2 && ends.every(x => x.to != null && moved.has(x.to));
            const base = shift.from?.get(c) ?? bendsMM(c);
            setBends(c, both ? base.map(([x, y]): Pt => [x + shift.dx * 25.4, y - shift.dy * 25.4]) : base);
        }
        refreshConnector(c);
    }
}

export const refreshFor = (id: string): void => refreshForMany([id]);

/* ---------- right-angled routing (page pixels) ---------- */
const STUB = 12;          // px a routed line runs straight out of a shape before it turns
const CLEAR = 12;         // px a routed line keeps from shapes it passes
function pathMidpoint(pts: Pt[]): Pt {
    const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])),
        total = seg.reduce((a, b) => a + b, 0);
    let left = total / 2;
    for (let i = 0; i < seg.length; i++) {
        if (left <= seg[i] && seg[i] > 0) {
            const t = left / seg[i], a = pts[i], c = pts[i + 1];
            return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        }
        left -= seg[i];
    }
    return pts[pts.length - 1];
}

/* Where a line from `from` heading along `dir` first meets the outline of shape `id` */
function hitAlong(id: string, from: Pt, dir: Pt): Pt | null {
    const b = S.boxes[id], polys = S.polys[id] || [[[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]];
    let best: number | null = null;
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
        const t = raySeg(from, dir, poly[i], poly[(i + 1) % poly.length]);
        if (t != null && t > 1e-6 && (best == null || t < best)) best = t;
    }
    return best == null ? null : [from[0] + dir[0] * best, from[1] + dir[1] * best];
}

/* The point on shape `id` where a horizontal or vertical line from `toward` lands, or the nearest edge point if
   `toward` is not level with the shape in either direction */
function landOn(id: string, toward: Pt): Pt {
    const b = S.boxes[id], [x, y] = toward;
    let p: Pt | null = null;
    if (y >= b.y0 && y <= b.y1 && (x < b.x0 || x > b.x1)) p = hitAlong(id, toward, [x < b.x0 ? 1 : -1, 0]);
    else if (x >= b.x0 && x <= b.x1 && (y < b.y0 || y > b.y1)) p = hitAlong(id, toward, [0, y < b.y0 ? 1 : -1]);
    return p || anchorFor(id, toward);
}

const boxOf = (id: string | null, p: Pt): Box => id ? S.boxes[id] : {x0: p[0], x1: p[0], y0: p[1], y1: p[1]};
const level = (p: Pt, q: Pt): boolean => Math.abs(p[0] - q[0]) < 0.5 || Math.abs(p[1] - q[1]) < 0.5;

/* Drops repeated points and points in the middle of a straight run */
function simplify(pts: Pt[]): Pt[] {
    const out: Pt[] = [];
    for (const p of pts) {
        const q = out[out.length - 1];
        if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) out.push(p);
    }
    for (let i = out.length - 2; i > 0; i--) {
        const a = out[i - 1], b = out[i], c = out[i + 1];
        if ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)) out.splice(i, 1);
    }
    return out;
}

/* Every point of a right-angled line, ends included: through its bend points when it has them, otherwise along
   the best route found by autoRoute */
function elbowRoute(bTo: string | null, eTo: string | null, b: Pt, e: Pt, via: Pt[], beginSide: string | null, endSide: string | null): Pt[] {
    if (!via.length) return autoRoute(bTo, eTo, b, e, beginSide, endSide);
    const start = beginSide && bTo ? cardinalPoint(bTo, beginSide) : (bTo ? landOn(bTo, via[0]) : b);
    const end = endSide && eTo ? cardinalPoint(eTo, endSide) : (eTo ? landOn(eTo, via[via.length - 1]) : e);
    return simplify([start, ...via, end]);
}

/* Keeps a right-angled line meeting its shapes square after a shape moved or was resized: the bend next to an
   end slides along its segment until it is level with that shape again. The other bends stay where they were. */
function fitBends(via: Pt[], bTo: string | null, eTo: string | null): { via: Pt[], changed: boolean } {
    const n = via.length;
    if (!n) return {via, changed: false};
    const v = via.map((p): Pt => [p[0], p[1]]), A = bTo ? S.boxes[bTo] : undefined, B = eTo ? S.boxes[eTo] : undefined;
    const inX = (p: Pt, r: Box) => p[0] >= r.x0 && p[0] <= r.x1, inY = (p: Pt, r: Box) => p[1] >= r.y0 && p[1] <= r.y1,
        vertical = (p: Pt, q: Pt) => Math.abs(p[0] - q[0]) < 0.5;
    // segments alternate, so the segment after the first bend says which way the line leaves its first shape
    const firstAcross = n > 1 ? vertical(v[0], v[1]) : A ? inY(v[0], A) : B ? inX(v[0], B) : true;
    const lastAcross = n > 1 ? vertical(v[n - 1], v[n - 2]) : !firstAcross;
    if (bTo && A) {
        const c = centreOf(bTo);
        if (firstAcross) {
            if (!inY(v[0], A)) v[0][1] = c[1];
        } else if (!inX(v[0], A)) v[0][0] = c[0];
    }
    if (eTo && B) {
        const c = centreOf(eTo), p = v[n - 1];
        if (lastAcross) {
            if (!inY(p, B)) p[1] = c[1];
        } else if (!inX(p, B)) p[0] = c[0];
    }
    return {via: v, changed: v.some((p, i) => p[0] !== via[i][0] || p[1] !== via[i][1])};
}

/* Shapes a line should go round: every drawn top-level shape except lines, the two it joins and containers,
   whose frames lines cross freely to reach the shapes inside */
function obstacles(skip: string[]): Box[] {
    const out: Box[] = [];
    for (const el of kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape')) {
        const id = el.getAttribute('ID'), b = id ? S.boxes[id] : undefined;
        if (!id || !b || skip.includes(id) || is1D(shapeCtx(el, null)) || isContainer(el)) continue;
        out.push(b);
    }
    return out;
}

/* How many of the boxes an axis-aligned segment passes through */
function crossings(p: Pt, q: Pt, boxes: Box[], pad = 2): number {
    let n = 0;
    const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
    for (const r of boxes) if (x0 < r.x1 - pad && x1 > r.x0 + pad && y0 < r.y1 - pad && y1 > r.y0 + pad) n++;
    return n;
}

/* The best right-angled route between two shapes (or loose ends): every pair of sides, joined directly, with one
   turn, or with two turns along a channel beside the shapes in the way. A route is scored on length, turns, and
   above all on not passing through other shapes or back through its own two. */
function autoRoute(bTo: string | null, eTo: string | null, b: Pt, e: Pt, beginSide: string | null, endSide: string | null): Pt[] {
    const A = boxOf(bTo, b), B = boxOf(eTo, e), skip = [bTo, eTo].filter((id): id is string => !!id),
        boxes = obstacles(skip);
    const sides = (id: string | null, r: Box, p: Pt, forced: string | null): { p: Pt, out: Pt }[] => {
        if (!id) return [{p, out: p}];
        const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, at = forced != null ? sidePoint(r, forced) : null;
        if (forced != null && at) {   // a side the text fixes, perhaps at a point along it (e@0.3)
            const d = CARD_DIR[endSpec(forced).side];
            return [{p: cardinalPoint(id, forced), out: [at[0] + d[0] * STUB, at[1] + d[1] * STUB]}];
        }
        const all: [Pt, Pt][] = [[[r.x0, cy], [-1, 0]], [[r.x1, cy], [1, 0]], [[cx, r.y0], [0, -1]], [[cx, r.y1], [0, 1]]];
        return all.map(([q, d]) => {
            const out: Pt = [q[0] + d[0] * STUB, q[1] + d[1] * STUB];
            return {p: landOn(id, out), out};
        });
    };
    const lo = [Math.min(A.x0, B.x0) - 200, Math.min(A.y0, B.y0) - 200],
        hi = [Math.max(A.x1, B.x1) + 200, Math.max(A.y1, B.y1) + 200];
    const near = [...boxes.filter(r => r.x1 > lo[0] && r.x0 < hi[0] && r.y1 > lo[1] && r.y0 < hi[1]), ...(bTo ? [A] : []), ...(eTo ? [B] : [])];
    const xs = near.flatMap(r => [r.x0 - CLEAR, r.x1 + CLEAR]), ys = near.flatMap(r => [r.y0 - CLEAR, r.y1 + CLEAR]);
    const own = [...(bTo ? [A] : []), ...(eTo ? [B] : [])];
    let best: Pt[] | null = null, bestScore = Infinity;
    for (const sa of sides(bTo, A, b, beginSide)) for (const sb of sides(eTo, B, e, endSide)) {
        const p = sa.out, q = sb.out, mids: Pt[][] = [[]];
        if (!level(p, q)) mids.push([[q[0], p[1]]], [[p[0], q[1]]]);
        for (const x of [(p[0] + q[0]) / 2, ...xs]) mids.push([[x, p[1]], [x, q[1]]]);
        for (const y of [(p[1] + q[1]) / 2, ...ys]) mids.push([[p[0], y], [q[0], y]]);
        for (const m of mids) {
            const pts = simplify([sa.p, p, ...m, q, sb.p]);
            if (!pts.slice(1).every((c, i) => level(c, pts[i]))) continue;   // only right angles
            let len = 0, hit = 0, back = 0;
            for (let i = 1; i < pts.length; i++) {
                const s0 = pts[i - 1], s1 = pts[i];
                len += Math.abs(s1[0] - s0[0]) + Math.abs(s1[1] - s0[1]);
                hit += crossings(s0, s1, boxes);
                if (i > 1 && i < pts.length - 1) back += crossings(s0, s1, own, 1);
            }
            const score = len + 25 * (pts.length - 2) + 2000 * hit + 3000 * back;
            if (score < bestScore) {
                bestScore = score;
                best = pts;
            }
        }
    }
    return best || [b, e];
}
