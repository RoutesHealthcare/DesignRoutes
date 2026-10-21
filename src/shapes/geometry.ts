/* Helpers that build shape outlines. Pure functions: no page, no document, so they're safe to import from anywhere. */
import type {GeoFn, GeoSection, Point, PointSection} from './types'

const rowsFrom = (pts: Point[]) => pts.map((p, i) => ({t: p[2] || (i ? 'LineTo' : 'MoveTo'), fx: p[0], fy: p[1]}))

/* Points as fractions of the width and height */
export const fracGeo = (...sections: PointSection[]): GeoFn => (W, H) => sections.map(sec => ({
    noFill: sec.noFill,
    noLine: sec.noLine,
    series: sec.series,
    shade: sec.shade,
    rows: rowsFrom(sec.pts).map(r => ({
        t: r.t,
        c: [['X', W * r.fx, `Width*${r.fx}`], ['Y', H * r.fy, `Height*${r.fy}`]]
    })),
}))

/* Like fracGeo, but x is a fraction of the height too, so the outline keeps its proportions however wide the shape is */
export const squareGeo = (...sections: PointSection[]): GeoFn => (_W, H) => sections.map(sec => ({
    noFill: sec.noFill,
    noLine: sec.noLine,
    series: sec.series,
    shade: sec.shade,
    rows: rowsFrom(sec.pts).map(r => ({
        t: r.t,
        c: [['X', H * r.fx, `Height*${r.fx}`], ['Y', H * r.fy, `Height*${r.fy}`]]
    })),
}))

/* Points in inches, with no formulas: the chart is redrawn from the text after every resize */
export const absGeo = (sections: PointSection[]): GeoSection[] => sections.map(sec => ({
    noFill: sec.noFill,
    noLine: sec.noLine,
    series: sec.series,
    shade: sec.shade,
    rows: sec.pts.map((p, i) => ({t: p[2] || (i ? 'LineTo' : 'MoveTo'), c: [['X', r4(p[0])], ['Y', r4(p[1])]]})),
}))

export const RECT: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]

/* Curved outlines are sampled into LineTo rows with Width and Height formulas so they resize in Visio as well as here */
export const r4 = (v: number) => Math.round(v * 1e4) / 1e4

export const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Point[] =>
    Array.from({length: n + 1}, (_, i) => {
        const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180
        return [r4(cx + rx * Math.cos(t)), r4(cy + ry * Math.sin(t))]
    })

export const wavePts = (x0: number, x1: number, y: number, amp: number, n = 24): Point[] =>
    Array.from({length: n + 1}, (_, i) => {
        const t = i / n
        return [r4(x1 - (x1 - x0) * t), r4(y + amp * Math.sin(2 * Math.PI * t))]
    })

/* Corners rounded by r, as one closed outline */
export const roundedBox = (W: number, H: number, r: number): Point[] => [...arcPts(W - r, r, r, r, -90, 0, 6), ...arcPts(W - r, H - r, r, r, 0, 90, 6),
    ...arcPts(r, H - r, r, r, 90, 180, 6), ...arcPts(r, r, r, r, 180, 270, 6), [W - r, 0]]

export const boxPts = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]

export const linePts = (...segs: [number, number, number, number][]): Point[] =>
    segs.flatMap(([x0, y0, x1, y1]): Point[] => [[x0, y0, 'MoveTo'], [x1, y1]])

/* A rectangle with semicircle ends (terminator, button) */
export const roundedEnds: GeoFn = (W, H) => {
    const r = H / 2
    return [{
        rows: [
            {t: 'MoveTo', c: [['X', r, 'Height*0.5'], ['Y', 0, 'Height*0']]},
            {t: 'LineTo', c: [['X', W - r, 'Width-Height*0.5'], ['Y', 0, 'Height*0']]},
            {t: 'ArcTo', c: [['X', W - r, 'Width-Height*0.5'], ['Y', H, 'Height*1'], ['A', r, 'Height*0.5']]},
            {t: 'LineTo', c: [['X', r, 'Height*0.5'], ['Y', H, 'Height*1']]},
            {t: 'ArcTo', c: [['X', r, 'Height*0.5'], ['Y', 0, 'Height*0'], ['A', r, 'Height*0.5']]},
        ]
    }]
}