/* Layouts for charts with a label per part (a treemap's tiles, a word cloud's words, a Sankey's nodes): each works out
   the outline and where every part of the label goes in one go, so the shape's geo (drawn when it's built) and its
   parts (placed when it's drawn) always agree. Pure functions: sizes in inches, y up, like the geometry helpers. */
import type {PartPlace, Point, PointSection} from './types'
import {boxPts, r4} from './geometry'
import {segmentsOf} from './wireframe'

export type Layout = { sections: PointSection[], places: PartPlace[] }

export const CHAR_W = 0.075, LINE_H = 0.19   // inches at the label's size: an average character, and a line's height

/* How big a name can be to fit a w by h box without breaking a word: no bigger than the label's size, no smaller
   than half of it. Capitals and wide letters run past the average width, hence the fifth to spare */
export const fitSize = (name: string | undefined, w: number, h: number) => {
    const longest = Math.max(1, ...String(name ?? '').split(/\s+/).map(x => x.length))
    return Math.max(0.5, Math.min(1, (w - 0.04) / (longest * CHAR_W * 1.2), (h - 0.04) / LINE_H))
}

/* ---------- treemap: the area shared out as rectangles, each as near square as it can be (squarified) ---------- */

type Tile = { i: number, v: number }
type Rect = { x: number, y: number, w: number, h: number }

/* The worst (longest) side ratio in a row of tiles laid along a side of length s, sum being their total area */
const worst = (row: number[], s: number) => {
    const sum = row.reduce((t, v) => t + v, 0)
    return Math.max(...row.map(v => Math.max(s * s * v / (sum * sum), sum * sum / (s * s * v))))
}

/* Rectangles for values, largest first, filling the box; each keeps its value's index */
export function squarify(values: number[], box: Rect): (Rect & { i: number })[] {
    const total = values.reduce((t, v) => t + Math.max(0, v), 0)
    if (!total) return []
    const scale = box.w * box.h / total
    const tiles: Tile[] = values.map((v, i) => ({
        i,
        v: Math.max(0, v) * scale
    })).filter(t => t.v > 0).sort((a, b) => b.v - a.v)
    const out: (Rect & { i: number })[] = []
    let r = {...box}, row: Tile[] = []
    const lay = () => {   // the row along the shorter side, then the rest of the box beyond it
        const sum = row.reduce((t, x) => t + x.v, 0)
        if (r.w >= r.h) {   // a column at the left
            const cw = sum / r.h
            let y = r.y + r.h
            for (const t of row) {
                const th = t.v / cw
                out.push({i: t.i, x: r.x, y: y - th, w: cw, h: th})
                y -= th
            }
            r = {x: r.x + cw, y: r.y, w: r.w - cw, h: r.h}
        } else {   // a row along the top
            const rh = sum / r.w
            let x = r.x
            for (const t of row) {
                const tw = t.v / rh
                out.push({i: t.i, x, y: r.y + r.h - rh, w: tw, h: rh})
                x += tw
            }
            r = {x: r.x, y: r.y, w: r.w, h: r.h - rh}
        }
        row = []
    }
    for (const t of tiles) {
        const s = Math.min(r.w, r.h)
        if (row.length && worst([...row, t].map(x => x.v), s) > worst(row.map(x => x.v), s)) lay()
        row.push(t)
    }
    if (row.length) lay()
    return out
}

/* A treemap: a tile per value in its series colour, a small gap between, each name centred on its tile, smaller in a
   small tile rather than broken mid-word */
export function treemapLayout(W: number, H: number, label: string | undefined, values: number[]): Layout {
    const gap = 0.02, names = segmentsOf(label), places: PartPlace[] = [], sections: PointSection[] = []
    for (const t of squarify(values, {x: 0, y: 0, w: W, h: H})) {
        sections.push({series: t.i, pts: boxPts(t.x + gap, t.y + gap, t.x + t.w - gap, t.y + t.h - gap)})
        places[t.i] = {
            x: t.x + t.w / 2, y: t.y + t.h / 2, w: Math.max(0.2, t.w - 0.03), on: t.i,
            size: fitSize(names[t.i], t.w, t.h)
        }
    }
    return {sections, places}
}

/* ---------- word cloud: words sized by weight, packed outward from the middle along a spiral ---------- */

const clouds = new Map<string, PartPlace[]>()   // packing is the slow part and the page redraws often: kept by input

/* Each word as big as the square root of its weight allows (a weight of its own, or the smallest, when there are more
   words than weights), all scaled down together when the shape is too small for them, biggest first, at the first spot along a spiral out from the middle where its box (from its
   length and an average character width) fits inside the shape and clear of the words already down. A word with no
   room left isn't placed. Colours go round the series. */
export function wordcloudLayout(W: number, H: number, label: string | undefined, weights: number[]): PartPlace[] {
    const key = [W, H, label, weights.join(',')].join('|'), kept = clouds.get(key)
    if (kept) return kept
    const words = segmentsOf(label).map((w, i) => ({w, i, v: Math.max(0, weights[i] ?? Math.min(...weights, 1))}))
    const top = Math.max(...words.map(w => w.v), 0) || 1, pad = 0.03, boxes: Rect[] = [], places: PartPlace[] = []
    const grow = (v: number) => 0.9 + 1.7 * Math.sqrt(v / top),
        // all the words' boxes at full size, against the room there is: packing leaves gaps, so aim for under half
        need = words.reduce((t, w) => t + w.w.length * CHAR_W * LINE_H * grow(w.v) ** 2, 0),
        fit = Math.max(0.45, Math.min(1, Math.sqrt(W * H * 0.4 / (need || 1))))
    for (const word of [...words].sort((a, b) => b.v - a.v)) {
        if (!word.w) continue
        const size = grow(word.v) * fit, bw = word.w.length * CHAR_W * size + pad * 2,
            bh = LINE_H * size + pad * 2
        for (let t = 0; t < 600; t += 0.15) {   // an Archimedean spiral, stretched to the shape's proportions
            const r = 0.012 * t, cx = W / 2 + r * Math.cos(t) * W / H, cy = H / 2 + r * Math.sin(t)
            const b = {x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh}
            if (b.x < 0 || b.y < 0 || b.x + bw > W || b.y + bh > H) {
                if (r > Math.max(W, H)) break   // past every edge: no room for it
                continue
            }
            if (boxes.some(o => b.x < o.x + o.w && o.x < b.x + bw && b.y < o.y + o.h && o.y < b.y + bh)) continue
            boxes.push(b)
            places[word.i] = {x: cx, y: cy, w: bw + 0.3, size, series: word.i}
            break
        }
    }
    if (clouds.size > 200) clouds.clear()
    clouds.set(key, places)
    return places
}

/* ---------- Sankey: nodes in columns, joined by bands as wide as what flows between them ---------- */

/* A cubic curve from a to b leaving and arriving level, sampled (y up) */
const level = (x0: number, y0: number, x1: number, y1: number, n = 12): Point[] =>
    Array.from({length: n + 1}, (_, i) => {
        const t = i / n, mx = (x0 + x1) / 2, u = 1 - t
        return [r4(u * u * u * x0 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x1),
            r4(u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1)]
    })

/* Flows come as from, to, amount: the from and to are the names' places in the label, counting from 1. A flow naming
   a place past the last name, itself, or nothing, is left out. Each node sits in the column after the furthest node
   that flows into it, as tall as the larger of what comes in and what goes out, every column scaled alike; the bands
   leave and arrive stacked top down in the order of the nodes at their other end. A node with no flows isn't drawn.
   Bands take their source's series colour, lightened; names go right of their node, the last column's in the room
   kept at the right. */
export function sankeyLayout(W: number, H: number, label: string | undefined, vals: number[]): Layout {
    const names = segmentsOf(label), N = names.length, links: { a: number, b: number, v: number }[] = []
    for (let i = 0; i + 2 < vals.length; i += 3) {
        const a = Math.round(vals[i]) - 1, b = Math.round(vals[i + 1]) - 1, v = vals[i + 2]
        if (a >= 0 && b >= 0 && a < N && b < N && a !== b && v > 0) links.push({a, b, v})
    }
    const used = new Set(links.flatMap(l => [l.a, l.b])), col = new Array(N).fill(0)
    for (let k = 0; k < N; k++) for (const l of links) col[l.b] = Math.min(N - 1, Math.max(col[l.b], col[l.a] + 1))   // a loop stops at N - 1
    const inOf = (n: number) => links.filter(l => l.b === n).reduce((t, l) => t + l.v, 0),
        outOf = (n: number) => links.filter(l => l.a === n).reduce((t, l) => t + l.v, 0),
        size = (n: number) => Math.max(inOf(n), outOf(n))
    const cols = [...new Set([...used].map(n => col[n]))].sort((a, b) => a - b), C = cols.length
    const nodeW = Math.min(0.14, W * 0.05), gap = Math.min(0.12, H * 0.08), labelRoom = Math.min(W * 0.25, 1)
    const xOf = (n: number) => C > 1 ? cols.indexOf(col[n]) * (W - nodeW - labelRoom) / (C - 1) : (W - nodeW) / 2
    const inCol = cols.map(c => [...used].filter(n => col[n] === c))
    const k = Math.min(...inCol.map(ns => (H - gap * (ns.length - 1)) / (ns.reduce((t, n) => t + size(n), 0) || 1)))
    const top = new Array(N).fill(0)   // each node's top edge
    for (const ns of inCol) {
        let y = H / 2 + (ns.reduce((t, n) => t + size(n) * k, 0) + gap * (ns.length - 1)) / 2
        for (const n of ns) {
            top[n] = y
            y -= size(n) * k + gap
        }
    }
    const outAt = [...top], inAt = [...top], bands: PointSection[] = []
    for (const l of [...links].sort((p, q) => top[q.b] - top[p.b] || top[q.a] - top[p.a])) {
        const h = l.v * k, x0 = xOf(l.a) + nodeW, x1 = xOf(l.b), y0 = outAt[l.a], y1 = inAt[l.b]
        outAt[l.a] -= h
        inAt[l.b] -= h
        const upper = level(x0, y0, x1, y1), lower = level(x1, y1 - h, x0, y0 - h)
        bands.push({series: l.a, shade: 0.45, pts: [...upper, ...lower, upper[0]]})
    }
    const sections: PointSection[] = [...bands], places: PartPlace[] = []
    for (const n of used) {
        const x = xOf(n), h = size(n) * k, tw = names[n].length * CHAR_W
        sections.push({series: n, pts: boxPts(x, top[n] - h, x + nodeW, top[n])})
        places[n] = {x: x + nodeW + 0.06 + tw / 2, y: top[n] - h / 2, w: tw + 0.3}
    }
    return {sections, places}
}

/* ---------- chord diagram: groups round a circle, a ribbon between each pair as wide as what passes ---------- */

/* rows[i][j] is what group i sends to group j, so the table is square, a row per group (the names in the label, in the
   same order). Each group has an arc round the outside as long as everything it sends; inside, a ribbon joins the
   part of i's arc for what it sends j to the part of j's arc for what it sends back, curving through the middle. A
   group that sends nothing isn't drawn. Angles run clockwise from the top. */
export function chordLayout(W: number, H: number, label: string | undefined, rows: number[][]): Layout {
    const names = segmentsOf(label), n = rows.length, cx = W / 2, cy = H / 2,
        r = Math.max(0.2, Math.min(W, H) / 2 - 0.3), ring = Math.min(0.1, r * 0.12)
    const sends = rows.map(row => row.reduce((t, v) => t + Math.max(0, v), 0)),
        total = sends.reduce((t, v) => t + v, 0) || 1
    const live = sends.filter(v => v > 0).length, pad = live > 1 ? 0.06 : 0, unit = (2 * Math.PI - pad * live) / total
    const at = (rad: number, t: number): Point => [r4(cx + rad * Math.sin(t)), r4(cy + rad * Math.cos(t))]
    const arc = (rad: number, t0: number, t1: number): Point[] => {
        const k = Math.max(1, Math.ceil(Math.abs(t1 - t0) / 0.08))
        return Array.from({length: k + 1}, (_, i) => at(rad, t0 + (t1 - t0) * i / k))
    }
    const through = (p: Point, q: Point): Point[] =>   // a curve from p to q bowed through the middle
        Array.from({length: 11}, (_, i) => {
            const t = i / 10, u = 1 - t
            return [r4(u * u * p[0] + 2 * u * t * cx + t * t * q[0]), r4(u * u * p[1] + 2 * u * t * cy + t * t * q[1])]
        })
    const start: number[] = [], seg: [number, number][][] = rows.map(() => [])
    let t = 0
    rows.forEach((row, i) => {
        start[i] = t
        let u = t
        row.forEach((v, j) => {
            seg[i][j] = [u, u + Math.max(0, v) * unit]
            u += Math.max(0, v) * unit
        })
        t = u + (sends[i] > 0 ? pad : 0)
    })
    const ribbons: PointSection[] = [], groups: PointSection[] = [], places: PartPlace[] = []
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
        const [a0, a1] = seg[i][j], [b0, b1] = seg[j][i]
        if (a1 - a0 <= 0 && b1 - b0 <= 0) continue
        const from = arc(r, a0, a1), to = i === j ? [] : arc(r, b0, b1),
            pts: Point[] = i === j ? [...from, ...through(from[from.length - 1], from[0]).slice(1)]
                : [...from, ...through(from[from.length - 1], to[0]).slice(1), ...to.slice(1), ...through(to[to.length - 1], from[0]).slice(1)]
        ribbons.push({series: (rows[i][j] ?? 0) >= (rows[j]?.[i] ?? 0) ? i : j, shade: 0.5, pts})
    }
    for (let i = 0; i < n; i++) {
        if (sends[i] <= 0) continue
        const t0 = start[i], t1 = start[i] + sends[i] * unit, mid = (t0 + t1) / 2, outer = arc(r + ring, t0, t1)
        groups.push({series: i, pts: [...arc(r, t1, t0), ...outer, at(r, t1)]})
        if (names[i]) {
            const tw = names[i].length * CHAR_W, [x, y] = at(r + ring + 0.12, mid), side = Math.sin(mid)
            places[i] = {x: x + side * tw / 2, y: y + Math.cos(mid) * 0.06, w: tw + 0.3}
        }
    }
    return {sections: [...ribbons, ...groups], places}
}

/* ---------- tile map: a choropleth without the geography, a tile per region shaded by its value ---------- */

/* The regions named in the label get an equal tile each, in a grid about as wide as the shape is, filled in reading
   order and centred. Each is shaded from pale (the lowest value) to the shape's fill (the highest), like a heatmap's
   cells; a region with no value is left nearly white. Its name sits on it in whichever text reads better. */
export function tilemapLayout(W: number, H: number, label: string | undefined, values: number[]): Layout {
    const names = segmentsOf(label), n = Math.max(1, names.filter(Boolean).length || values.length)
    const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * W / H)))), rows = Math.ceil(n / cols)
    const tile = Math.min(W / cols, H / rows), gap = Math.min(0.03, tile * 0.05), x0 = (W - tile * cols) / 2,
        y0 = H - (H - tile * rows) / 2
    const lo = Math.min(...values), span = Math.max(...values) - lo || 1, sections: PointSection[] = [],
        places: PartPlace[] = []
    for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols), x = x0 + c * tile, y = y0 - (r + 1) * tile,
            shade = Number.isFinite(values[i]) ? 0.15 + 0.85 * (values[i] - lo) / span : 0.04
        sections.push({series: 0, shade, pts: boxPts(x + gap, y + gap, x + tile - gap, y + tile - gap)})
        places[i] = {
            x: x + tile / 2, y: y + tile / 2, w: Math.max(0.2, tile - 0.03), on: 0, onShade: shade,
            size: fitSize(names[i], tile, tile)
        }
    }
    return {sections, places}
}
