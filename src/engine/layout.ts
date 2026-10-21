/* =====================================================================
   Automatic layout for formats without positions: layered, top to bottom (or as the source asks)
   ===================================================================== */
import {GRID, gridHeight, isShapeKind, segmentsOf, SHAPES, TABLE, tableHeight} from '../shapes';
import {clampN, fullLabel} from './formats/export';
import type {LayoutNode} from "./layoutNode";
import type {LayoutGraph} from "./layoutGraph";

/* What sizeFor reads: a layout node, or a shape from the .flow text (language.ts's autoSizeMM) */
type SizeInput = { kind: string, label?: string, columns?: unknown[] | null, cells?: string[][] | null };

export function sizeFor(n: SizeInput) {
    const T = isShapeKind(n.kind) ? SHAPES[n.kind] : SHAPES.process, text: string[] = fullLabel(n).split('\n'),
        CH = 0.075;   // average character width in inches at 11 pt
    const longest = Math.max(1, ...text.map(l => l.length));
    if (n.kind === 'table') return {
        w: Math.max(TABLE.w, longest * CH + 0.3),
        h: tableHeight(Math.max(1, (n.columns || []).length))
    };
    if (n.kind === 'grid') {
        const cells = n.cells && n.cells.length ? n.cells : GRID.cells, nc = Math.max(1, ...cells.map(r => r.length)),
            widest = Math.max(1, ...cells.flat().map(c => c.length));
        return {w: nc * Math.max(GRID.colW, Math.min(3, widest * CH + 0.4)), h: gridHeight(cells.length)};
    }
    if (n.kind === 'user' || n.kind === 'server' || n.kind === 'progress' || n.kind === 'dial' || T.chart || T.headline) return {
        w: T.w,
        h: T.h
    };
    if ((n.kind === 'checkbox' || n.kind === 'radio') && text.length === 1) return {
        w: Math.max(T.w, Math.min(3, longest * CH + 0.6)),
        h: T.h
    };
    if (n.kind === 'switch' && text.length === 1) return {w: Math.max(T.w, Math.min(3.5, longest * CH + 0.9)), h: T.h};
    if (n.kind === 'progressbar' || n.kind === 'slider' || n.kind === 'rangeslider' || n.kind === 'rating' || n.kind === 'avatar' || n.kind === 'glyph' || n.kind === 'spinner' || n.kind === 'skeleton' || n.kind === 'fab' || n.kind === 'divider' || n.kind === 'scrollbar' || n.kind === 'bell' || n.kind === 'video' || T.fixedSize) return {
        w: T.w,
        h: T.h
    };   // a set size, whatever the label
    if (n.kind === 'badge') return {w: Math.max(T.w, Math.min(2, longest * CH + 0.3)), h: T.h};   // one short line
    if (T.segments) {   // sized from the widest part: every slot is as wide (a row) or as tall (a column) as the others
        const parts = segmentsOf(fullLabel(n)), slot = Math.max(...parts.map(p => p.length)) * CH + 0.4;
        return T.segments === 'row' ? {
            w: Math.max(T.w, Math.min(8, parts.length * slot)),
            h: T.h
        } : {w: Math.max(T.w, Math.min(3, slot)), h: Math.max(T.h, parts.length * T.h / segmentsOf(T.text).length)};
    }
    let w = Math.max(T.w, Math.min(3, longest * CH + 0.4));
    const rows = text.reduce((s, l) => s + Math.max(1, Math.ceil(l.length * CH / Math.max(w - 0.3, 0.5))), 0);
    let h = Math.max(T.h, rows * 0.22 + 0.3);
    if (n.kind === 'text') return {w: Math.min(3, longest * CH + 0.3), h: rows * 0.22 + 0.1};
    if (n.kind === 'decision') {
        w = Math.max(w * 1.35, 1.5);
        h = Math.max(h * 1.4, 1);
    }
    return {w, h};
}

/* A mind map: when a central topic is among the shapes to place, its tree (followed along connections either way, from
   the topic outwards) goes out to both sides of it, the topic's branches shared between left and right by size, and
   each side stacked outward like a tree lying on its side. Shapes not joined to the topic go in a row underneath.
   Returns false when there's no central topic, for the layered layout to do instead. */
function layoutMindMap(g: LayoutGraph): boolean {
    const root = g.nodes.find(n => n.kind === 'centraltopic')
    if (!root) return false
    for (const n of g.nodes) if (n.w == null || n.h == null) Object.assign(n, sizeFor(n));
    const byId = new Map(g.nodes.map(n => [n.id, n])), near = new Map<string, string[]>(g.nodes.map(n => [n.id, []]))
    for (const e of g.edges) if (e.from !== e.to && byId.has(e.from) && byId.has(e.to)) {
        near.get(e.from)!.push(e.to)
        near.get(e.to)!.push(e.from)
    }
    const kids = new Map<string, string[]>(), seen = new Set([root.id]), q = [root.id]
    while (q.length) {   // breadth first, so each shape hangs off the branch nearest the topic
        const v = q.shift()!, ks: string[] = []
        for (const w of near.get(v)!) if (!seen.has(w)) {
            seen.add(w)
            ks.push(w)
            q.push(w)
        }
        kids.set(v, ks)
    }
    const GAP_OUT = 0.6, GAP_DOWN = 0.2
    const span = new Map<string, number>()   // how tall each subtree is
    const measure = (v: string): number => {
        const ks = kids.get(v)!, n = byId.get(v)!,
            s = Math.max(n.h, ks.reduce((t, k) => t + measure(k), 0) + GAP_DOWN * Math.max(0, ks.length - 1))
        span.set(v, s)
        return s
    }
    measure(root.id)
    /* side: 1 right, -1 left. x0 is the edge nearest the topic; the subtree is centred on cy */
    const place = (v: string, side: number, x0: number, cy: number) => {
        const n = byId.get(v)!, ks = kids.get(v)!
        n.x = side > 0 ? x0 : x0 - n.w
        n.y = cy - n.h / 2
        const total = ks.reduce((t, k) => t + span.get(k)!, 0) + GAP_DOWN * Math.max(0, ks.length - 1)
        let y = cy - total / 2
        for (const k of ks) {
            place(k, side, side > 0 ? x0 + n.w + GAP_OUT : x0 - n.w - GAP_OUT, y + span.get(k)! / 2)
            y += span.get(k)! + GAP_DOWN
        }
    }
    root.x = -root.w / 2
    root.y = -root.h / 2
    const sides: [string[], string[]] = [[], []], tall = [0, 0]
    for (const k of kids.get(root.id)!) {   // each branch to the shorter side so far, right first
        const s = tall[0] <= tall[1] ? 0 : 1
        sides[s].push(k)
        tall[s] += span.get(k)! + GAP_DOWN
    }
    sides.forEach((ks, s) => {
        const side = s ? -1 : 1
        let y = -(tall[s] - GAP_DOWN) / 2
        for (const k of ks) {
            place(k, side, side * (root.w / 2 + GAP_OUT), y + span.get(k)! / 2)
            y += span.get(k)! + GAP_DOWN
        }
    })
    const loose = g.nodes.filter(n => !seen.has(n.id))
    if (loose.length) {
        const placed = g.nodes.filter(n => seen.has(n.id))
        let x = Math.min(...placed.map(n => n.x))
        const y = Math.max(...placed.map(n => n.y + n.h)) + GAP_OUT
        for (const n of loose) {
            n.x = x
            n.y = y
            x += n.w + GAP_DOWN * 2
        }
    }
    return true
}

export function layoutGraph(g: LayoutGraph) {
    if (!g.positioned && layoutMindMap(g)) {
        toOrigin(g)
        return
    }
    if (g.positioned) {
        for (const n of g.nodes) {
            n.w = clampN(n.w, 0.1, 20, 1.5);
            n.h = clampN(n.h, 0.1, 20, 0.75);
            n.x = clampN(n.x, -1e4, 1e4, 0);
            n.y = clampN(n.y, -1e4, 1e4, 0);
            if (n.kind === 'table') n.h = tableHeight(Math.max(1, (n.columns || []).length));
            if (n.kind === 'grid' && n.cells) n.h = gridHeight(n.cells.length);
        }
    } else {
        const N = g.nodes.length, idx = new Map(g.nodes.map((n, i) => [n.id, i])),
            outs: [to: number, edge: number][][] = g.nodes.map(() => []), linked = new Array(N).fill(false);
        for (const n of g.nodes) if (n.w == null || n.h == null) Object.assign(n, sizeFor(n));
        g.edges.forEach((e, k) => {
            const a = idx.get(e.from), b = idx.get(e.to);
            if (a == null || b == null || a === b) return;
            outs[a].push([b, k]);
            linked[a] = linked[b] = true;
        });
        // break cycles: an edge into a node still on the DFS stack points backwards
        const state = new Array(N).fill(0), back = new Set<number>(), indeg = new Array(N).fill(0);
        for (const o of outs) for (const [b] of o) indeg[b]++;
        const dfs = (s: number) => {
            const st = [[s, 0]];
            state[s] = 1;
            while (st.length) {
                const top = st[st.length - 1], [v, i] = top;
                if (i < outs[v].length) {
                    top[1]++;
                    const [w, k] = outs[v][i];
                    if (state[w] === 1) back.add(k); else if (!state[w]) {
                        state[w] = 1;
                        st.push([w, 0]);
                    }
                } else {
                    state[v] = 2;
                    st.pop();
                }
            }
        };
        for (let i = 0; i < N; i++) if (!indeg[i] && !state[i]) dfs(i);
        for (let i = 0; i < N; i++) if (!state[i]) dfs(i);
        const succ: number[][] = g.nodes.map(() => []), pred: number[][] = g.nodes.map(() => []);
        for (let a = 0; a < N; a++) for (const [b, k] of outs[a]) if (!back.has(k)) {
            succ[a].push(b);
            pred[b].push(a);
        }
        // longest-path ranks
        const rank = new Array(N).fill(0), deg = pred.map(x => x.length), q: number[] = [];
        for (let i = 0; i < N; i++) if (!deg[i]) q.push(i);
        while (q.length) {
            const v = q.shift()!;
            for (const w of succ[v]) {
                rank[w] = Math.max(rank[w], rank[v] + 1);
                if (--deg[w] === 0) q.push(w);
            }
        }
        const maxR = Math.max(0, ...rank.filter((_, i) => linked[i])), anyLinked = linked.some(Boolean);
        for (let i = 0; i < N; i++) if (!linked[i]) rank[i] = anyLinked ? maxR + 1 : 0;   // unconnected shapes get a row of their own
        const layers: number[][] = [];
        for (let i = 0; i < N; i++) (layers[rank[i]] = layers[rank[i]] || []).push(i);
        const pos: number[] = new Array(N);
        layers.forEach(Lr => Lr && Lr.forEach((v, j) => pos[v] = j));
        const bary = (v: number, nb: number[][]) => nb[v].length ? nb[v].reduce((s, u) => s + pos[u], 0) / nb[v].length : pos[v];
        for (let it = 0; it < 8; it++) {   // barycentre sweeps reduce crossings
            const down = it % 2 === 0, nb = down ? pred : succ;
            for (let r0 = 0; r0 < layers.length; r0++) {
                const r = down ? r0 : layers.length - 1 - r0, Lr = layers[r];
                if (!Lr) continue;
                Lr.sort((a, b) => bary(a, nb) - bary(b, nb));
                Lr.forEach((v, j) => pos[v] = j);
            }
        }
        const horiz = g.direction === 'LR' || g.direction === 'RL', GAP_MAIN = 0.6, GAP_CROSS = 0.45;
        const main = (v: number) => horiz ? g.nodes[v].w : g.nodes[v].h,
            cross = (v: number) => horiz ? g.nodes[v].h : g.nodes[v].w;
        let offset = 0;
        for (const Lr of layers) {
            if (!Lr) continue;
            const size = Math.max(...Lr.map(main)),
                total = Lr.reduce((s, v) => s + cross(v), 0) + GAP_CROSS * (Lr.length - 1);
            let c = -total / 2;
            for (const v of Lr) {
                const n = g.nodes[v], m = offset + (size - main(v)) / 2;
                if (horiz) {
                    n.x = m;
                    n.y = c;
                } else {
                    n.x = c;
                    n.y = m;
                }
                c += cross(v) + GAP_CROSS;
            }
            offset += size + GAP_MAIN;
        }
        /* straighten edges: pull each shape towards the mean of its neighbours, then remove overlaps by sweeping the
           layer from both ends and averaging (both sweeps keep the gaps, so their average does too) */
        const ctr = (v: number) => horiz ? g.nodes[v].y + g.nodes[v].h / 2 : g.nodes[v].x + g.nodes[v].w / 2;
        const setCtr = (v: number, c: number) => {
            const n = g.nodes[v];
            if (horiz) n.y = c - n.h / 2; else n.x = c - n.w / 2;
        };
        for (const nb of [pred, succ, pred, succ]) {
            const order = nb === pred ? layers : [...layers].reverse();
            for (const Lr of order) {
                if (!Lr) continue;
                const want = Lr.map(v => nb[v].length ? nb[v].reduce((s, u) => s + ctr(u), 0) / nb[v].length : ctr(v)),
                    a: number[] = [], b: number[] = [];
                let edge = -Infinity;
                Lr.forEach((v, i) => {
                    a[i] = Math.max(want[i], edge + GAP_CROSS + cross(v) / 2);
                    edge = a[i] + cross(v) / 2;
                });
                edge = Infinity;
                for (let i = Lr.length - 1; i >= 0; i--) {
                    const v = Lr[i];
                    b[i] = Math.min(want[i], edge - GAP_CROSS - cross(v) / 2);
                    edge = b[i] - cross(v) / 2;
                }
                Lr.forEach((v, i) => setCtr(v, (a[i] + b[i]) / 2));
            }
        }
        if (g.direction === 'BT' || g.direction === 'RL') for (const n of g.nodes) {
            if (horiz) n.x = offset - n.x - n.w; else n.y = offset - n.y - n.h;
        }
    }
    toOrigin(g);
}

/* Moves the laid-out shapes so the top-left one is at 0,0 */
function toOrigin(g: LayoutGraph) {
    const mx = Math.min(...g.nodes.map(n => n.x)), my = Math.min(...g.nodes.map(n => n.y));
    for (const n of g.nodes) {
        n.x -= mx;
        n.y -= my;
    }
}
