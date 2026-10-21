/* ---------- containers on the page ----------
   A container (container, pool, lane: SHAPES[kind].container) is an ordinary top-level shape. Its members are
   top-level shapes too, each naming it by FlowId in its FlowIn user cell ([in=id] in the text), so every shape
   keeps its own line and its own connections. This module answers who is inside what, and changes it. */
import {PX, S, kid, kids, setCell} from './core';
import {num, shapeCtx} from './visio-package';
import {pageCtx} from './render';
import {delUser, setUser, userV} from './flow/model';
import {CONTAINER, SHAPES, applySize, isContainerKind, isShapeKind, roleOf} from '../shapes';

const topShapes = (): Element[] => kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape');
export const isContainer = (el: Element | null | undefined): el is Element => !!el && isContainerKind(roleOf(el));

/* The container a shape is inside, if it names one that is on the page */
export function containerOf(el: Element, top: Element[] = topShapes()): Element | null {
    const fid = userV(el, 'FlowIn');
    return fid ? top.find(t => t !== el && isContainer(t) && userV(t, 'FlowId') === fid) || null : null;
}

export const isScroll = (el: Element | null | undefined): boolean => {
    const role = roleOf(el ?? null);
    return isShapeKind(role) && !!SHAPES[role].scroll;
};

/* The nearest scroll area a shape is inside, through any containers in between */
export function scrollOf(el: Element, top: Element[] = topShapes()): Element | null {
    for (let c = containerOf(el, top), n = 0; c && n < 50; c = containerOf(c, top), n++) if (isScroll(c)) return c;
    return null;
}

/* How many containers a shape is inside, counting outwards (0 for a shape in none). The walk stops on a loop. */
export function depthOf(el: Element, top: Element[] = topShapes()): number {
    let n = 0;
    for (let c = containerOf(el, top), seen = new Set<Element>([el]); c && !seen.has(c); c = containerOf(c, top)) {
        seen.add(c);
        n++;
    }
    return n;
}

/* The ids, with every member of any container among them, and their members in turn */
export function withMembers(ids: Iterable<string>): string[] {
    const top = topShapes(), out = new Set<string>(), queue = [...ids];
    while (queue.length) {
        const id = queue.shift()!, el = S.elById[id];
        if (!el || out.has(id)) continue;
        out.add(id);
        const fid = isContainer(el) && userV(el, 'FlowId');
        if (fid) for (const t of top) if (userV(t, 'FlowIn') === fid) queue.push(t.getAttribute('ID') ?? '');
    }
    return [...out];
}

/* The ids of the shapes that were moved directly, not carried along inside a container that moved with them */
export function movedRoots(ids: string[]): string[] {
    const set = new Set(ids), top = topShapes();
    return ids.filter(id => {
        for (let c = S.elById[id] && containerOf(S.elById[id], top), n = 0; c && n < 50; c = containerOf(c, top), n++)
            if (set.has(c.getAttribute('ID') ?? '')) return false;
        return true;
    });
}

/* The innermost container whose drawn box holds the point (page pixels), leaving out the shapes in skip */
export function containerAt(px: number, py: number, skip: Set<string>): Element | null {
    let best: Element | null = null, area = Infinity;
    for (const el of topShapes()) {
        const id = el.getAttribute('ID') ?? '', b = S.boxes[id];
        if (!isContainer(el) || skip.has(id) || !b || px < b.x0 || px > b.x1 || py < b.y0 || py > b.y1) continue;
        const a = (b.x1 - b.x0) * (b.y1 - b.y0);
        if (a < area) {
            area = a;
            best = el;
        }
    }
    return best;
}

/* Puts a shape inside a container, or takes it out of the one it is in (container null). The container must be
   named already (a FlowId), which every shape built from the text is. Returns whether anything changed. */
export function setContainer(el: Element, container: Element | null): boolean {
    const fid = container ? userV(container, 'FlowId') : null, was = userV(el, 'FlowIn');
    if (container && !fid) return false;
    if ((fid || null) === (was || null)) return false;
    if (fid) setUser(el, 'FlowIn', fid); else delUser(el, 'FlowIn');
    return true;
}

/* Grows a container, and the ones it is inside, so the shape's drawn box fits within it with a little room.
   Never shrinks, and leaves flexi containers to their layout. Returns the ids of the containers that changed size. */
export function growToFit(member: Element): string[] {
    const pg = pageCtx(), top = topShapes(), grown: string[] = [], pad = CONTAINER.pad / 2;
    let inner = member;
    for (let c = containerOf(member, top), n = 0; c && n < 50; inner = c, c = containerOf(c, top), n++) {
        const b = S.boxes[inner.getAttribute('ID') ?? ''];
        if (!b || userV(c, 'FlowDir') || isScroll(c)) break;   // sized by its layout, or kept to its size (a scroll area)
        const sh = shapeCtx(c, null), W = num(sh, 'Width', 0), H = num(sh, 'Height', 0),
            lx = num(sh, 'LocPinX', W / 2), ly = num(sh, 'LocPinY', H / 2),
            L = num(sh, 'PinX', 0) - lx, B = num(sh, 'PinY', 0) - ly;
        const role = roleOf(c), side = isShapeKind(role) && SHAPES[role].container === 'side', head = CONTAINER.header;
        // the member's box in page inches, and the room a container keeps round it, the header included
        const mL = b.x0 / PX - pad - (side ? head : 0), mR = b.x1 / PX + pad,
            mB = pg.h - b.y1 / PX - pad, mT = pg.h - b.y0 / PX + pad + (side ? 0 : head);
        const nL = Math.min(L, mL), nB = Math.min(B, mB), nR = Math.max(L + W, mR), nT = Math.max(B + H, mT);
        if (nL >= L - 1e-6 && nB >= B - 1e-6 && nR <= L + W + 1e-6 && nT <= B + H + 1e-6) break;
        const nW = nR - nL, nH = nT - nB;
        applySize(c, nW, nH, W, H, lx, ly);
        setCell(c, 'PinX', nL + lx / W * nW);
        setCell(c, 'PinY', nB + ly / H * nH);
        const id = c.getAttribute('ID') ?? '';
        grown.push(id);
        // the next container out is measured against this one's new box
        S.boxes[id] = {x0: nL * PX, x1: nR * PX, y0: (pg.h - nT) * PX, y1: (pg.h - nB) * PX};
    }
    return grown;
}
