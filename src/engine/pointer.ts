/* ---------- pointer interaction ---------- */
import {$, distToPolyline, PX, S, setCell, snapIn, stage, svg, svgEl, toast, type Pt} from './core';
import {is1D, num, shapeCtx} from './visio-package';
import {applyView, drawOverlay, pageCtx, render, zoomAt} from './render';
import {
    bendsAround,
    cardinalPoint,
    centreOf,
    clearBends,
    refreshConnector,
    refreshFor,
    refreshForMany,
    routePoints,
    setBends,
    setGlue,
    SNAP_SIDES,
    type Side
} from './connectors';
import {addConnector, applySize, roleOf} from '../shapes';
import {HIT_TOL_PX, isConnector, selIds, select, toggleSelection, topLevelIds} from './selection';
import {commitText, editText} from './text-editor';
import {notify} from './store';
import {commit, pushUndo, rebuild, selMemo, snapshot} from './document';
import {delUser, setUser, userV} from './flow/model';
import {containerAt, growToFit, movedRoots, setContainer, withMembers} from './containers';
import {inMindMap, withMaps} from './mindmap';

/* Where the pointer is on the page: page pixels from the top left (px, py), and page inches from the bottom left
   (x, y), which is how Visio cells measure */
export type PagePoint = { px: number, py: number, x: number, y: number };

/* ---------- the gesture in progress ----------
   One drag at a time, and its kind says which: TypeScript narrows on `drag.kind`, so after
   `if (drag.kind === 'move')` only a move's fields are there. snap is the document before the gesture began,
   for undo; moved turns true once the pointer has gone a few pixels. */
type Started = { p0: PagePoint, moved: boolean };
type PanDrag = { kind: 'pan', cx: number, cy: number, px: number, py: number };
type MarqueeDrag = Started & { kind: 'marquee', add: boolean, base: Set<string> };
type SegmentDrag = Started & { kind: 'segment', id: string, i: number, pts: Pt[], snap: string };
type ResizeDrag = Started & { kind: 'resize', h: string, id: string, orig: Element, snap: string };
type EndDrag = Started & {
    kind: 'end', h: string, id: string, orig: Element, snap: string,
    unglued?: boolean, snapTarget?: string | null, snapSide?: Side | null
};
type ConnectDrag = Started & {
    kind: 'connect', from: string, beginSide: Side | null, endSide: Side | null, endTarget: string | null
};
/* A press on an object: a click unless it moves. pick is what was pressed, prev the selection before it. */
type Press = Started & {
    pick: string, prev: string | null, stack: string[], alt: boolean, again: boolean, collapse: boolean
};
type MoveDrag = Press & {
    kind: 'move', ids: string[], lead: string, bends: Map<string, Pt[]>, orig: Map<string, Element>, snap: string
};
type ClickDrag = Press & { kind: 'click' };
type Drag = PanDrag | MarqueeDrag | SegmentDrag | ResizeDrag | EndDrag | ConnectDrag | MoveDrag | ClickDrag;

/* ---------- connector snap points ---------- */
const SNAP_TOL_PX = 14;   // screen pixels: how close the pointer must be to a shape's snap point to stick to it
/* The shape's nearest of its four snap points (side midpoints) to a page-pixel point, and how far away it is */
function nearestSnap(id: string, p: PagePoint): { side: Side, dist: number } | null {
    let best: { side: Side, dist: number } | null = null;
    for (const side of SNAP_SIDES) {
        const q = cardinalPoint(id, side), d = Math.hypot(q[0] - p.px, q[1] - p.py);
        if (!best || d < best.dist) best = {side, dist: d};
    }
    return best;
}

function snapSideNear(id: string | null, p: PagePoint): Side | null {
    const near = id && nearestSnap(id, p);
    return near && near.dist <= SNAP_TOL_PX / S.zoom ? near.side : null;
}

function drawSnapPoints(id: string | null, activeSide: Side | null | undefined): void {
    if (!id || !S.boxes[id]) return;
    const ov = $('overlay'), r = 5 / S.zoom;
    for (const side of SNAP_SIDES) {
        const [x, y] = cardinalPoint(id, side), active = side === activeSide;
        ov.appendChild(svgEl('circle', {
            cx: x,
            cy: y,
            r: active ? r * 1.5 : r,
            class: 'snap-point' + (active ? ' snap-point--active' : '')
        }));
    }
}

let drag: Drag | null = null;

export function toPage(e: { clientX: number, clientY: number }): PagePoint {
    const r = svg.getBoundingClientRect(), pg = pageCtx();
    const px = (e.clientX - r.left - S.panX) / S.zoom, py = (e.clientY - r.top - S.panY) / S.zoom;
    return {px, py, x: px / PX, y: pg.h - py / PX};
}

/* The id of the drawn shape under the pointer (not a line, not the key), other than exclude */
function hitShape(e: MouseEvent, exclude: string | null): string | null {
    for (const n of document.elementsFromPoint(e.clientX, e.clientY)) {
        const id = n.closest<SVGElement>('#layer [data-id]')?.dataset.id;
        if (id && id !== exclude && !is1D(shapeCtx(S.elById[id], null)) && roleOf(S.elById[id]) !== 'key') return id;
    }
    return null;
}

/* ---------- hit testing ---------- */

/* Every top-level object under the pointer, best first: a connection the pointer is on, then shapes the
   pointer is inside (smallest first, so small shapes are not hidden by large ones), then shapes the
   pointer is only near. */
function stackAt(e: MouseEvent): string[] {
    const pt = toPage(e), tol = HIT_TOL_PX / S.zoom, seen = new Set<string>(),
        hits: { id: string, rank: number, area: number, z: number }[] = [];
    for (const n of document.elementsFromPoint(e.clientX, e.clientY)) {
        const id = n.closest<SVGElement>('#layer > [data-id]')?.dataset.id;
        if (!id || seen.has(id) || !S.elById[id]) continue;
        seen.add(id);
        let rank: number, area = 0;
        if (isConnector(id)) {
            if (userV(S.elById[id], 'FlowAuto')) continue;   // a mind map's branch line: its map draws it, nothing to pick
            if (!n.closest('text') && distToPolyline(S.lines[id], pt.px, pt.py) > tol) continue;
            rank = 0;
        } else {
            const b = S.boxes[id];
            if (!b) continue;
            rank = pt.px >= b.x0 && pt.px <= b.x1 && pt.py >= b.y0 && pt.py <= b.y1 ? 1 : 2;
            area = (b.x1 - b.x0) * (b.y1 - b.y0);
        }
        hits.push({id, rank, area, z: hits.length});
    }
    for (const h of hits) if (h.rank === 0 && hits.some(o => o.rank === 1 && o.z < h.z)) h.rank = 1.5;   // a shape painted over the line wins; one beneath it doesn't
    return hits.sort((a, b) => a.rank - b.rank || a.area - b.area || a.z - b.z).map(h => h.id);
}

/* The selected object, if it's in the stack, otherwise the top of the stack */
const selectedOrTop = (stack: string[]): string | null => (S.sel && stack.includes(S.sel) ? S.sel : stack[0]) ?? null;
/* With Alt held, a selected object under the pointer keeps priority, so a covered shape can be dragged */
const pickFrom = (stack: string[], alt: boolean): string | null => alt ? selectedOrTop(stack) : stack[0] ?? null;

/* ---------- hover feedback ---------- */
let hoverLayer: Element;
let hoverEvt: PointerEvent | null = null, hoverRaf = 0;

function setHover(id: string | null): void {
    if (S.hover === id) return;
    S.hover = id;
    drawHover();
}

export function drawHover(): void {
    hoverLayer.replaceChildren();
    const id = S.hover && S.elById[S.hover] ? S.hover : null, line = !!id && isConnector(id);
    stage.classList.toggle('over-shape', !!id && !line);
    stage.classList.toggle('over-line', line);
    if (!id || S.selection.has(id)) return;
    if (line) {
        for (const s of S.lines[id] || []) hoverLayer.appendChild(svgEl('path', {
            d: 'M' + s.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L'),
            class: 'hoverline'
        }));
        return;
    }
    const b = S.boxes[id];
    if (b) hoverLayer.appendChild(svgEl('rect', {
        x: b.x0,
        y: b.y0,
        width: Math.max(b.x1 - b.x0, 0.5),
        height: Math.max(b.y1 - b.y0, 0.5),
        class: 'hoverbox'
    }));
}

/* ---------- marquee and multi-move ---------- */
function updateMarquee(d: MarqueeDrag, p: PagePoint): void {
    const r = {
        x0: Math.min(d.p0.px, p.px),
        y0: Math.min(d.p0.py, p.py),
        x1: Math.max(d.p0.px, p.px),
        y1: Math.max(d.p0.py, p.py)
    };
    const inside = topLevelIds().filter(id => {
        const b = S.boxes[id];
        return b && b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1;
    });
    const ids = d.add ? [...new Set([...d.base, ...inside])] : inside;
    S.selection = new Set(ids);
    S.sel = selectedOrTop(ids);
    drawOverlay();
    $('overlay').appendChild(svgEl('rect', {
        x: r.x0,
        y: r.y0,
        width: r.x1 - r.x0,
        height: r.y1 - r.y0,
        class: 'marquee'
    }));
}

/* Snaps the lead shape to the grid and moves the rest by the same amount, so their spacing is kept */
function moveDrag(d: MoveDrag, dx: number, dy: number, free: boolean): void {
    const lead = shapeCtx(d.orig.get(d.lead)!, null), W = num(lead, 'Width', 0), H = num(lead, 'Height', 0);   // orig has every id
    const left = num(lead, 'PinX', 0) - num(lead, 'LocPinX', W / 2),
        bottom = num(lead, 'PinY', 0) - num(lead, 'LocPinY', H / 2);
    let L = left + dx, B = bottom + dy;
    if (!free) {
        L = snapIn(L);
        B = snapIn(B);
    }
    for (const [id, orig] of d.orig) {
        const el = S.elById[id], o = shapeCtx(orig, null);
        if (!el) continue;
        setCell(el, 'PinX', num(o, 'PinX', 0) + L - left);
        setCell(el, 'PinY', num(o, 'PinY', 0) + B - bottom);
    }
    render();
    refreshForMany(d.ids, {dx: L - left, dy: B - bottom, from: d.bends});
    render();
    const target = dropTarget(d);
    if (target) {
        const b = S.boxes[target.getAttribute('ID') ?? ''];
        if (b) $('overlay').appendChild(svgEl('rect', {
            x: b.x0,
            y: b.y0,
            width: b.x1 - b.x0,
            height: b.y1 - b.y0,
            class: 'droptarget'
        }));
    }
}

/* The container the lead shape of a drag would drop into: the innermost one under its centre, other than the
   shapes being dragged and anything inside them */
function dropTarget(d: MoveDrag): Element | null {
    const b = S.boxes[d.lead];
    return b ? containerAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, new Set(d.ids)) : null;
}

/* After a drag, each shape that was dragged itself (not carried inside a container) is in whichever container its
   centre is over now, or in none; a container it lands in grows to fit it */
function settleMembership(d: MoveDrag): void {
    const skip = new Set(d.ids), grown: string[] = [];
    for (const id of movedRoots(d.ids)) {
        const el = S.elById[id], b = S.boxes[id];
        if (!el || !b || inMindMap(el)) continue;   // a mind map stays out of containers: part of it in one would split it
        const c = containerAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, skip);
        setContainer(el, c);
        if (c) grown.push(...growToFit(el));
    }
    if (grown.length) {
        render();
        refreshForMany(grown);
    }
}

/* Drags one segment of a right-angled line sideways, as in Visio. Moving the first or last segment keeps the end
   where it meets its shape: a short stub out of the shape is added and the line turns onto the moved segment. */
const SEG_STUB = 12;   // px
const copy = (q: Pt): Pt => [q[0], q[1]];

function dragSegment(d: SegmentDrag, p: PagePoint, free: boolean): void {
    const pts = d.pts.map(copy);
    let i = d.i;
    const axis = Math.abs(pts[i][1] - pts[i + 1][1]) < 0.5 ? 1 : 0;   // a horizontal segment moves up or down, a vertical one sideways
    const stub = (from: Pt, to: Pt): Pt => {
        const q = copy(from);
        q[1 - axis] += (Math.sign(to[1 - axis] - from[1 - axis]) || 1) * SEG_STUB;
        return q;
    };
    if (i === pts.length - 2) {
        const q = stub(pts[i + 1], pts[i]);
        pts.splice(i + 1, 0, q, copy(q));
    }
    if (i === 0) {
        const q = stub(pts[0], pts[1]);
        pts.splice(1, 0, q, copy(q));
        i += 2;
    }
    let v = axis ? p.py : p.px;
    if (!free) v = snapIn(v / PX) * PX;
    pts[i][axis] = v;
    pts[i + 1][axis] = v;
    setBends(d.id, pts.slice(1, -1).map(([x, y]): Pt => [x / PX * 25.4, y / PX * 25.4]));
    refreshConnector(d.id);
    render();
}

/* ---------- pointer interaction ---------- */
let spaceHeld = false;

export function setSpaceHeld(v: boolean): void {
    spaceHeld = v;
    stage.classList.toggle('panning', v);
}

/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init(): void {
    hoverLayer = svgEl('g', {id: 'hover', class: 'hover-layer'});
    $('view').insertBefore(hoverLayer, $('overlay'));
    svg.addEventListener('pointermove', e => {
        if (drag) return;
        hoverEvt = e;
        if (!hoverRaf) hoverRaf = requestAnimationFrame(() => {
            hoverRaf = 0;
            if (!drag && hoverEvt) setHover(pickFrom(stackAt(hoverEvt), hoverEvt.altKey));
        });
    });
    svg.addEventListener('pointerleave', () => setHover(null));
    svg.addEventListener('mousedown', e => e.preventDefault());   // stops Shift+click on the page extending a text selection in the panels
    svg.addEventListener('pointerdown', e => {
        if (S.editing) commitText();
        /* the mousedown above stops the page taking focus, so a field half-edited in the properties panel would stay
           focused and only apply (its change event) when it next lost focus, to whatever was selected by then */
        const f = document.activeElement;
        if (f instanceof HTMLElement && f.closest('#props')) f.blur();
        if (e.button !== 0 && e.button !== 1) return;
        setHover(null);
        const p = toPage(e), additive = e.shiftKey || e.ctrlKey || e.metaKey,
            hEl = e.target instanceof Element ? e.target.closest<SVGElement>('[data-handle]') : null,
            handle = hEl?.dataset.handle ?? '', sel = S.sel;
        const stack = hEl ? [] : stackAt(e), pick = pickFrom(stack, e.altKey);
        const pan = (): PanDrag => ({kind: 'pan', cx: e.clientX, cy: e.clientY, px: S.panX, py: S.panY});
        if (e.button === 1 || spaceHeld) drag = pan();
        else if (hEl && S.selection.size === 1 && sel && handle.startsWith('seg-'))
            drag = {
                kind: 'segment',
                id: sel,
                i: +handle.slice(4),
                pts: routePoints(sel),
                snap: snapshot(),
                p0: p,
                moved: false
            };
        else if (hEl && S.selection.size === 1 && sel) {
            drag = {
                kind: handle.length > 2 ? 'end' : 'resize',   // begin and end; nw, ne, sw and se
                h: handle,
                id: sel,
                orig: S.elById[sel].cloneNode(true) as Element,
                snap: snapshot(),
                p0: p,
                moved: false
            };
        } else if (S.tool === 'connect') {
            if (!pick) {
                select(null);
                drag = pan();
            } else if (isConnector(pick)) return;
            else drag = {
                    kind: 'connect',
                    from: pick,
                    p0: p,
                    moved: false,
                    beginSide: snapSideNear(pick, p),
                    endSide: null,
                    endTarget: null
                };
        } else if (!pick) {
            if (!additive) select(null);
            drag = {kind: 'marquee', p0: p, add: additive, base: new Set(S.selection), moved: false};
        } else if (additive) {
            toggleSelection(pick);
            return;
        } else {
            const wasSelected = S.selection.has(pick), prev = S.sel;
            if (wasSelected) {
                S.sel = pick;
                drawOverlay();
                notify();
            } else select(pick);
            const ids = withMembers(withMaps(selIds().filter(id => !isConnector(id))));   // connections follow their shapes, members their container, topics their map
            const again = wasSelected && S.selection.size === 1;   // a second click on the only selected object edits its text
            const base = {
                pick,
                prev,
                stack,
                alt: e.altKey,
                again,
                collapse: wasSelected && S.selection.size > 1,
                p0: p,
                moved: false
            };
            drag = ids.length ? {
                ...base, kind: 'move', ids, lead: ids.includes(pick) ? pick : ids[0], bends: bendsAround(ids),
                orig: new Map(ids.map((id): [string, Element] => [id, S.elById[id].cloneNode(true) as Element])),
                snap: snapshot()
            } : {...base, kind: 'click'};
        }
        svg.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
        if (!drag) return;
        if (drag.kind === 'pan') {
            S.panX = drag.px + e.clientX - drag.cx;
            S.panY = drag.py + e.clientY - drag.cy;
            applyView();
            return;
        }
        const p = toPage(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
        if (!drag.moved && Math.hypot(dx, dy) * PX * S.zoom < 3) return;
        drag.moved = true;
        if (drag.kind === 'click') return;
        if (drag.kind === 'marquee') {
            updateMarquee(drag, p);
            return;
        }
        if (drag.kind === 'move') {
            moveDrag(drag, dx, dy, e.altKey);
            return;
        }
        if (drag.kind === 'segment') {
            dragSegment(drag, p, e.altKey);
            return;
        }
        if (drag.kind === 'connect') {
            drawOverlay();
            const b = drag.beginSide ? cardinalPoint(drag.from, drag.beginSide) : centreOf(drag.from);
            const tgt = hitShape(e, drag.from);
            drag.endTarget = tgt;
            drag.endSide = snapSideNear(tgt, p);
            if (tgt) drawSnapPoints(tgt, drag.endSide);
            const tip = tgt && drag.endSide ? cardinalPoint(tgt, drag.endSide) : [p.px, p.py];
            $('overlay').appendChild(svgEl('line', {x1: b[0], y1: b[1], x2: tip[0], y2: tip[1], class: 'ghost'}));
            return;
        }
        // only a resize or a line-end drag is left
        const el = S.elById[drag.id], o = shapeCtx(drag.orig, null);
        if (drag.kind === 'resize') {
            const fresh = drag.orig.cloneNode(true) as Element;
            el.parentNode?.replaceChild(fresh, el);
            S.elById[drag.id] = fresh;
            const W0 = num(o, 'Width', 1), H0 = num(o, 'Height', 1), lx = num(o, 'LocPinX', W0 / 2),
                ly = num(o, 'LocPinY', H0 / 2);
            let L = num(o, 'PinX', 0) - lx, B = num(o, 'PinY', 0) - ly, R = L + W0, T = B + H0;
            const min = 0.1;
            const x = e.altKey ? p.x : snapIn(p.x), y = e.altKey ? p.y : snapIn(p.y), h = drag.h;
            if (h.includes('w')) L = Math.min(x, R - min);
            if (h.includes('e')) R = Math.max(x, L + min);
            if (h.includes('n')) T = Math.max(y, B + min);
            if (h.includes('s')) B = Math.min(y, T - min);
            applySize(fresh, R - L, T - B, W0, H0, lx, ly);
            setCell(fresh, 'PinX', L + lx / W0 * (R - L));
            setCell(fresh, 'PinY', B + ly / H0 * (T - B));
            render();
            refreshFor(drag.id);
        } else {
            const end = drag.h === 'begin' ? 'Begin' : 'End';
            if (!drag.unglued) {
                setGlue(drag.id, end, null);
                clearBends(drag.id);
                drag.unglued = true;
            }
            setCell(el, end + 'X', p.x);
            setCell(el, end + 'Y', p.y);
            render();
            refreshConnector(drag.id);
            const tgt = hitShape(e, drag.id);
            drag.snapTarget = tgt;
            drag.snapSide = snapSideNear(tgt, p);
        }
        render();
        if (drag.kind === 'end' && drag.snapTarget) drawSnapPoints(drag.snapTarget, drag.snapSide);
    });
    svg.addEventListener('pointerup', e => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
        if (d.kind === 'marquee') {
            if (d.moved) {
                drawOverlay();
                notify();
            }
            return;
        }
        if ((d.kind === 'move' || d.kind === 'click') && !d.moved) {
            if (d.alt && d.stack.length > 1) {
                const next = d.stack[(d.stack.indexOf(d.prev ?? '') + 1) % d.stack.length];
                select(next);
            }   // Alt+click: the object underneath
            else if (d.collapse) select(d.pick);   // a plain click inside a multi-selection keeps only that object
            else if (d.again && !d.alt) editText(d.pick, undefined, toPage(e));
            return;
        }
        if (d.kind === 'connect') {
            drawOverlay();
            if (!d.moved) return;
            const p = toPage(e), tgt = d.endTarget || hitShape(e, d.from);
            if (!tgt) {
                toast('Drop the end of the connection on a shape.');
                return;
            }
            commit(() => {
                S.sel = addConnector(d.from, tgt, [p.x, p.y], d.beginSide ?? undefined, d.endSide ?? undefined);
            });
            return;
        }
        if (d.kind === 'end' && d.moved) {
            const tgt = hitShape(e, d.id);
            if (!tgt) {
                toast('Both ends of a connection need to be on a shape.');
                rebuild(selMemo());
                return;
            }
            const end = d.h === 'begin' ? 'Begin' : 'End', el = S.elById[d.id],
                cell = end === 'Begin' ? 'FlowBeginPt' : 'FlowEndPt';
            setGlue(d.id, end, tgt);
            if (d.snapSide) setUser(el, cell, d.snapSide); else delUser(el, cell);
            render();
            refreshConnector(d.id);
        }
        if (d.kind === 'move' && d.moved) settleMembership(d);
        if ('snap' in d && d.moved && d.snap) {
            pushUndo(d.snap);
            render();
        }
    });
    /* A cancelled gesture (a touch taken over by the system, say) puts the drawing back as the text has it */
    svg.addEventListener('pointercancel', () => {
        const d = drag;
        drag = null;
        if (!d) return;
        if ('snap' in d && d.moved && d.snap) {
            console.warn('Pointer gesture cancelled; reverting', d.kind);
            rebuild(selMemo());
        } else drawOverlay();
    });
    svg.addEventListener('dblclick', e => {
        const id = selectedOrTop(stackAt(e));
        if (!id) return;
        select(id);
        editText(id, undefined, toPage(e));
    });
    stage.addEventListener('wheel', e => {
        e.preventDefault();
        const r = svg.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        else {
            if (S.editing) commitText();
            S.panX -= e.deltaX;
            S.panY -= e.deltaY;
            applyView();
        }
    }, {passive: false});
}
