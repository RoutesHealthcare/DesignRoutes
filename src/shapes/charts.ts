/* BI charts: a frame with the title in a band at the top, and the values drawn below it.
   The values come from the text ({ 3, 5, 2 }), or a sample when there are none, so a chart dropped from the palette
   is a ready placeholder. Like the progress ring, the canvas is rebuilt from the text, so new values redraw it.
   Coordinates are absolute (inches): a resize is written to the text, and the rebuild draws the chart afresh. */
import type {ChartValues, GeoFn, Point, PointSection, ShapeDef} from './types'
import {RECT, absGeo, arcPts, boxPts, fracGeo, linePts} from './geometry'
import {TABLE} from './database'
import {ringPct, segmentsOf} from './wireframe'
import {chordLayout, sankeyLayout, tilemapLayout, treemapLayout, wordcloudLayout} from './labelled'
import {geomapLayout} from './geomap'
import WORLD from './maps/world'
import UK from './maps/uk'
import FRANCE from './maps/france'
import YORKSHIRE from './maps/yorkshire'
import CHESHIRE from './maps/cheshire'
import CUMBRIA from './maps/cumbria'
import GREATER_MANCHESTER from './maps/greatermanchester'
import LANCASHIRE from './maps/lancashire'
import MERSEYSIDE from './maps/merseyside'
import type {MapData} from './geomap'

type ChartKind =
    'bar'
    | 'hbar'
    | 'stackedbar'
    | 'stackedhbar'
    | 'percentbar'
    | 'percenthbar'
    | 'histogram'
    | 'waterfall'
    | 'funnel'
    | 'line'
    | 'area'
    | 'stackedarea'
    | 'percentarea'
    | 'radar'
    | 'radararea'
    | 'polar'
    | 'spiral'
    | 'pie'
    | 'donut'
    | 'scatter'
    | 'bubble'
    | 'candlestick'
    | 'boxplot'
    | 'heatmap'
    | 'gantt'

/* The maps a country map or route map can show ([map=]), by the name the setting uses; the first is the one with no
   setting. Each starts with all its parts named (its sample), in the order of its data (alphabetical) unless it says.
   Another map is its data (scripts/build-maps.mjs) and a line here. */
type MapChoice = { name: string, data: MapData, sample: string }
const mapChoice = (name: string, data: MapData, sample = data.regions.map(r => r.name).join(' | ')): MapChoice =>
    ({name, data, sample})
export const COUNTRY_MAPS: Record<string, MapChoice> = {
    uk: mapChoice('United Kingdom', UK, 'East Midlands | East of England | London | North East | North West | ' +
        'Northern Ireland | Scotland | South East | South West | Wales | West Midlands | Yorkshire'),
    france: mapChoice('France', FRANCE),
}
export const ROUTE_MAPS: Record<string, MapChoice> = {
    yorkshire: mapChoice('Yorkshire', YORKSHIRE),
    cheshire: mapChoice('Cheshire', CHESHIRE),
    cumbria: mapChoice('Cumbria', CUMBRIA),
    greatermanchester: mapChoice('Greater Manchester', GREATER_MANCHESTER),
    lancashire: mapChoice('Lancashire', LANCASHIRE),
    merseyside: mapChoice('Merseyside', MERSEYSIDE),
}

/* A geographic map shape that shows one of several maps: the choices for its ShapeDef, and its geo and parts, the map
   chosen by [map=]. With no values of its own it shows its kind's sample, repeated so every part is shaded. */
function mapShape(kind: 'countrymap' | 'routemap', maps: Record<string, MapChoice>) {
    const of = (key: string | null | undefined) => maps[key ?? ''] ?? Object.values(maps)[0]
    const layout = (W: number, H: number, label: string | undefined, values: ChartValues | undefined, key: string | null | undefined) => {
        const m = of(key), sample = CHART_SAMPLES[kind][0],
            vals = values && values.length && values[0].length ? chartValues(kind, values)[0]
                : m.data.regions.map((_, i) => sample[i % sample.length])
        return geomapLayout(m.data, W, H, label, vals)
    }
    return {
        text: Object.values(maps)[0].sample,
        maps: Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, {name: m.name, sample: m.sample}])),
        geo: ((W, H, label, values, attrs) => absGeo(layout(W, H, label, values, attrs?.map).sections)) satisfies GeoFn,
        parts: (W: number, H: number, label?: string, values?: ChartValues, attrs?: Parameters<GeoFn>[4]) =>
            layout(W, H, label, values, attrs?.map).places,
    }
}

/* Charts drawn without a frame, beside their label */
type BareChartKind =
    'sparkline'
    | 'bullet'
    | 'treemap'
    | 'wordcloud'
    | 'sankey'
    | 'chord'
    | 'tilemap'
    | 'worldmap'
    | 'countrymap'
    | 'routemap'

/* Sample values, drawn when a chart has none of its own: one row per series. A scatter chart's come in pairs (x, y),
   a bubble chart's in threes (x, y, size), a candlestick chart's in fours (open, high, low, close), a box plot's in
   fives (min, q1, median, q3, max). Charts that show
   several series have three, so a chart dropped from the palette shows what it is for. */
const SERIES_SAMPLE = [[4, 7, 5, 9], [3, 5, 6, 4], [2, 3, 2, 5]]
export const CHART_SAMPLES: Record<ChartKind | BareChartKind, ChartValues> = {
    bar: [[4, 7, 5, 9, 6]],
    hbar: [[4, 7, 5, 9, 6]],
    line: [[3, 5, 4, 7, 6, 9]],
    area: [[3, 5, 4, 7, 6, 9]],
    pie: [[40, 25, 20, 15]],
    donut: [[40, 25, 20, 15]],
    histogram: [[1, 3, 6, 9, 7, 4, 2]],
    waterfall: [[10, 4, -3, 5, -2]],
    funnel: [[100, 70, 45, 25]],
    radar: [[8, 5, 7, 4, 9, 6]],
    radararea: [[8, 5, 7, 4, 9, 6]],
    polar: [[9, 6, 8, 4, 7, 5, 3, 6]],
    spiral: [[3, 4, 6, 8, 9, 10, 9, 8, 6, 5, 4, 3, 4, 5, 7, 9, 10, 10, 9, 7, 6, 5, 4, 4]],
    scatter: [[1, 2, 2, 4, 3, 3, 4, 6, 5, 5, 6, 8, 7, 7]],
    bubble: [[2, 3, 4, 4, 7, 9, 6, 4, 2, 8, 8, 6]],
    sparkline: [[4, 6, 5, 8, 7, 9, 8, 11]],
    bullet: [[60, 80]],
    treemap: [[40, 25, 15, 12, 8]],
    wordcloud: [[10, 7, 6, 5, 4, 3, 3, 2]],
    sankey: [[1, 2, 60, 1, 3, 40, 2, 4, 25, 2, 5, 35]],
    chord: [[0, 5, 3, 2], [4, 0, 6, 1], [2, 3, 0, 4], [1, 2, 3, 0]],
    tilemap: [[8, 5, 3, 9, 6, 2, 4, 7, 1]],
    worldmap: [[9, 6, 4, 7, 8, 3]],
    countrymap: [[3, 6, 5, 4, 5, 6, 9, 8, 5, 3, 4, 2]],
    routemap: [[4, 9, 6, 7]],
    candlestick: [[5, 8, 4, 7, 7, 9, 6, 8, 8, 9, 5, 6, 6, 7, 3, 4, 4, 8, 4, 7]],
    boxplot: [[2, 4, 5, 7, 9, 4, 6, 8, 9, 11, 1, 2, 4, 5, 8]],
    heatmap: [[1, 3, 5, 8, 6, 2], [2, 5, 8, 9, 7, 3], [1, 4, 6, 7, 4, 2], [0, 1, 3, 4, 2, 1]],
    gantt: [[0, 3, 2, 4, 5, 3, 7, 2]],
    stackedbar: SERIES_SAMPLE,
    stackedhbar: SERIES_SAMPLE,
    percentbar: SERIES_SAMPLE,
    percenthbar: SERIES_SAMPLE,
    stackedarea: SERIES_SAMPLE,
    percentarea: SERIES_SAMPLE,
}

/* Charts whose values come in groups, one group per point: how many numbers make a point, what a point is called,
   and an example for error messages. The values are kept in one row everywhere (the text, the FlowValues cell, the
   properties panel), whether ; was typed between points or not; this says how to group them. */
const POINTS: Partial<Record<string, { n: number, name: string, parts: string, example: string }>> = {
    scatter: {n: 2, name: 'dot', parts: 'x, y', example: '{ 1, 2; 3, 5 }'},
    bubble: {n: 3, name: 'bubble', parts: 'x, y, size', example: '{ 2, 3, 4; 4, 7, 9 }'},
    candlestick: {n: 4, name: 'candle', parts: 'open, high, low, close', example: '{ 5, 8, 4, 7; 7, 9, 3, 4 }'},
    boxplot: {n: 5, name: 'box', parts: 'min, q1, median, q3, max', example: '{ 2, 4, 5, 7, 9; 4, 6, 8, 9, 11 }'},
    gantt: {n: 2, name: 'task', parts: 'start, length', example: '{ 0, 3; 2, 4 }'},
    sankey: {n: 3, name: 'flow', parts: 'from, to, amount', example: '{ 1, 2, 60; 1, 3, 40 }'},
}
/* Grouped charts whose numbers in a group can't go down: a box plot's min, quartiles and max */
const RISING = new Set(['boxplot'])
/* Charts that take a set number of values, each with its own meaning */
const EXACT: Partial<Record<string, { n: number, parts: string, example: string }>> = {
    bullet: {n: 2, parts: 'value, target', example: '{ 60, 80 }'},
}
/* Grouped charts whose first two numbers name parts of the label, counting from 1: a Sankey's from and to */
const LINKS = new Set(['sankey'])
/* Charts whose values may be below 0: a waterfall's falls */
const SIGNED = new Set(['waterfall'])
/* Charts that can show several series, a row of values each ({ 3, 5, 2; 4, 1, 6 }): bars side by side, a line or
   area each, or stacked. A heatmap's rows are its rows of cells. The rest take one. */
const SERIES = new Set(['bar', 'hbar', 'line', 'area', 'radar', 'radararea', 'stackedbar', 'stackedhbar', 'percentbar', 'percenthbar', 'stackedarea', 'percentarea', 'heatmap', 'chord'])
const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five']
export const valuesPerPoint = (kind: string | null | undefined) => POINTS[kind ?? '']?.n ?? 1
/* What the properties panel says instead of the plain message below, which shows the values in { } as in the text */
export const PLAIN_VALUES_PROBLEM = "A chart's values are numbers of 0 or more, like { 3, 5, 2, 7 }."

/* Values as typed in the text or the properties panel: one row per series, split on ;, the numbers in a row split on
   commas or spaces. Grouped and fixed-count charts use ; between points, so theirs are all one row. */
export function parseValues(kind: string | null | undefined, s: string): ChartValues {
    const nums = (t: string) => t.split(/[\s,]+/).filter(Boolean).map(Number)
    if (valuesPerPoint(kind) > 1 || EXACT[kind ?? '']) return [nums(s.replace(/;/g, ','))]
    return s.split(';').map(nums).filter(r => r.length)
}

/* The FlowValues cell keeps the rows the same way, without the spaces: "3,5,2;4,1,6" */
export const valuesCell = (rows: ChartValues) => rows.map(r => r.join(',')).join(';')
export const cellValues = (cell: string): ChartValues => cell.split(';').map(r => r.split(',').map(Number))

/* Values as written in the text and the properties panel: "3, 5, 2", "3, 5, 2; 4, 1, 6" for several series, or
   "2, 3, 4; 4, 7, 9" in groups */
export function formatValues(kind: string | null | undefined, rows: ChartValues): string {
    const n = valuesPerPoint(kind)
    if (n === 1) return rows.map(r => r.join(', ')).join('; ')
    const values = rows.flat(), groups: string[] = []
    for (let i = 0; i < values.length; i += n) groups.push(values.slice(i, i + n).join(', '))
    return groups.join('; ')
}

/* Why a chart's values don't fit it, or null when they do */
export function valuesProblem(kind: string | null | undefined, rows: ChartValues): string | null {
    const pt = POINTS[kind ?? ''], ex = EXACT[kind ?? ''], signed = SIGNED.has(kind ?? ''), values = rows.flat()
    if (ex && (values.length !== ex.n || values.some(v => !Number.isFinite(v) || v < 0)))
        return `A ${kind} chart takes ${NUMBER_WORDS[ex.n]} numbers of 0 or more (${ex.parts}), like ${ex.example}.`
    if (rows.length > 1 && !SERIES.has(kind ?? ''))
        return `A ${kind} chart shows one series: its values with commas between them, like { 3, 5, 2, 7 }.`
    if (signed && (!values.length || values.some(v => !Number.isFinite(v))))
        return `A ${kind} chart's values are numbers, with falls below 0, like { 10, 4, -3, 5 }.`
    if (!values.length || values.some(v => !Number.isFinite(v) || (!signed && v < 0)))
        return pt ? `A ${kind} chart's values are numbers of 0 or more, ${NUMBER_WORDS[pt.n]} per ${pt.name} (${pt.parts}), like ${pt.example}.`
            : PLAIN_VALUES_PROBLEM
    if (pt && values.length % pt.n) return `A ${kind} chart needs ${NUMBER_WORDS[pt.n]} numbers per ${pt.name} (${pt.parts}), like ${pt.example}.`
    if (pt && LINKS.has(kind ?? '') && values.some((v, i) => i % pt.n < 2 && (v < 1 || !Number.isInteger(v))))
        return `A ${kind} chart's from and to are names' places in the label, counting from 1, like ${pt.example}.`
    if (pt && LINKS.has(kind ?? '') && values.some((v, i) => i % pt.n === 0 && v === values[i + 1]))
        return `A ${kind} chart's flows go from one name to another, not back to the same one.`
    if (pt && RISING.has(kind ?? '') && values.some((v, i) => i % pt.n && v < values[i - 1]))
        return `A ${kind} chart's numbers for each ${pt.name} go from smallest to largest (${pt.parts}), like ${pt.example}.`
    if (kind === 'chord' && rows.some(r => r.length !== rows.length))
        return `A chord diagram's values are a square table, a row per group with a value for every group: these ${rows.length} rows have ${rows.map(r => r.length).join(', ')}.`
    if (kind === 'heatmap' && rows.some(r => r.length !== rows[0].length))
        return `Each row of a heatmap needs the same number of cells; these have ${rows.map(r => r.length).join(', ')}.`
    if (rows.some(r => r.length !== rows[0].length))
        return `Each series needs a value for every category, so every row the same length; these have ${rows.map(r => r.length).join(', ')}.`
    return null
}

/* Dots placed by x and y, from 0 at the axes to the largest value at the far edge, each with its own radius.
   pad keeps the biggest dot inside the plot. Every dot is filled; the biggest are drawn first so smaller ones stay
   visible on top. */
type Dot = { x: number, y: number, r: number }

function dotSections(dots: Dot[], pad: number, x0: number, y0: number, pw: number, ph: number): PointSection[] {
    const mx = Math.max(...dots.map(d => d.x), 0) || 1, my = Math.max(...dots.map(d => d.y), 0) || 1
    return [...dots].sort((a, b) => b.r - a.r).map(d => {
        const cx = x0 + pad + (pw - 2 * pad) * d.x / mx, cy = y0 + pad + (ph - 2 * pad) * d.y / my
        return {pts: arcPts(cx, cy, d.r, d.r, 0, 360, d.r < 0.06 ? 12 : 24)}
    })
}

/* A scatter chart: one small dot per x, y pair */
function scatterSections(vals: number[], x0: number, y0: number, pw: number, ph: number): PointSection[] {
    const r = Math.max(0.025, Math.min(pw, ph) * 0.035), dots: Dot[] = []
    for (let i = 0; i + 1 < vals.length; i += 2) dots.push({x: vals[i], y: vals[i + 1], r})
    return dotSections(dots, r, x0, y0, pw, ph)
}

/* A bubble chart: each bubble's area follows its size; a size of 0 draws nothing */
function bubbleSections(vals: number[], x0: number, y0: number, pw: number, ph: number): PointSection[] {
    const rMax = Math.min(pw, ph) * 0.14, sized: { x: number, y: number, s: number }[] = []
    for (let i = 0; i + 2 < vals.length; i += 3) if (vals[i + 2] > 0) sized.push({
        x: vals[i],
        y: vals[i + 1],
        s: vals[i + 2]
    })
    const ms = Math.max(...sized.map(p => p.s), 0) || 1
    return dotSections(sized.map(p => ({
        x: p.x,
        y: p.y,
        r: Math.max(0.03, rMax * Math.sqrt(p.s / ms))
    })), rMax, x0, y0, pw, ph)
}

/* Where a framed chart draws: the whole shape (W, H), the title band's height, and the plot area under it */
type Plot = {
    W: number,
    H: number,
    band: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    pw: number,
    ph: number
}
/* Draws one kind of chart's values inside its plot. The frame is drawn for it; the axes are its own choice. A chart
   that shows one series reads the first row (one), one that shows several reads them all. */
type Drawer = (rows: ChartValues, p: Plot) => PointSection[]
const one = (draw: (vals: number[], p: Plot) => PointSection[]): Drawer => (rows, p) => draw(rows[0], p)

const axesOf = (p: Plot): PointSection => ({noFill: 1, pts: [[p.x0, p.y1], [p.x0, p.y0], [p.x1, p.y0]]})

/* A box from a to b along a bar chart's value axis and from c to d across it, as fractions of the plot, upright or
   lying down (from the top); every bar chart's boxes go through here */
const barBox = (lying: boolean, p: Plot, a: number, b: number, c: number, d: number): Point[] =>
    lying ? boxPts(p.x0 + p.pw * a, p.y1 - p.ph * d, p.x0 + p.pw * b, p.y1 - p.ph * c)
        : boxPts(p.x0 + p.pw * c, p.y0 + p.ph * a, p.x0 + p.pw * d, p.y0 + p.ph * b)

/* Bars, a slot per category (upright left to right, or lying down top to bottom), the series side by side in it, a
   colour each; gap is the fraction of the slot left empty, half each side. One series is a plain bar chart. */
const bars = (lying: boolean, gap: number): Drawer => (rows, p) => {
    const n = rows[0].length, k = rows.length, top = Math.max(...rows.flat(), 0) || 1, w = (1 - gap) / n / k,
        secs: PointSection[] = []
    rows.forEach((vals, s) => vals.forEach((v, i) => {
        const c = (i + gap / 2) / n + w * s
        if (v > 0) secs.push({series: s, pts: barBox(lying, p, 0, v / top, c, c + w)})
    }))
    return [...secs, axesOf(p)]
}

/* Where each series starts and ends in each category when they're stacked, as fractions of the plot: up to the
   largest total, or each category to 1 for a 100% chart (whole) */
function stacks(rows: ChartValues, whole: boolean): [number, number][][] {
    const sums = rows[0].map((_, i) => rows.reduce((t, r) => t + r[i], 0)), top = Math.max(...sums, 0) || 1,
        run = sums.map(() => 0)
    return rows.map(r => r.map((v, i): [number, number] => [run[i], run[i] += v / (whole ? sums[i] || 1 : top)]))
}

/* Bars with the series stacked, the first at the base, a colour each */
const stackedBars = (lying: boolean, whole: boolean): Drawer => (rows, p) => {
    const n = rows[0].length, secs: PointSection[] = []
    stacks(rows, whole).forEach((r, s) => r.forEach(([a, b], i) => {
        if (b > a) secs.push({series: s, pts: barBox(lying, p, a, b, (i + 0.2) / n, (i + 0.8) / n)})
    }))
    return [...secs, axesOf(p)]
}

/* Evenly spaced across the plot, from its left edge to its right */
const spread = (i: number, n: number, p: Plot) => n > 1 ? p.x0 + p.pw * i / (n - 1) : p.x0 + p.pw / 2

/* Overlapping series, each filled in its own colour: the biggest total at the back so smaller ones stay in front,
   then every series' outline on top in its colour, so where one hides part of another its edge still shows. One
   series is just its fill. (Fills are opaque: Visio has one fill per shape, so see-through ones wouldn't survive.) */
function overlapping(rows: ChartValues, shape: (vals: number[]) => Point[]): PointSection[] {
    const fills = rows.map((vals, s): PointSection => ({series: s, pts: shape(vals)}))
    if (rows.length < 2) return fills
    const total = (s: number) => rows[s].reduce((a, b) => a + b, 0)
    return [...[...fills].sort((a, b) => total(b.series!) - total(a.series!)),
        ...fills.map((f): PointSection => ({...f, noFill: 1}))]
}

/* A line through each series' values, evenly spaced, a colour each; area fills each down to the axis */
const lineOrArea = (area: boolean): Drawer => (rows, p) => {
    const top = Math.max(...rows.flat(), 0) || 1
    const line = (vals: number[]) => vals.map((v, i): Point => [spread(i, vals.length, p), p.y0 + p.ph * 0.92 * v / top])
    const secs = area ? overlapping(rows, vals => {
        const pts = line(vals)
        return [[p.x0, p.y0], ...pts, [pts[pts.length - 1][0], p.y0], [p.x0, p.y0]]
    }) : rows.map((vals, s): PointSection => ({noFill: 1, series: s, pts: line(vals)}))
    return [...secs, axesOf(p)]
}

/* Stacked areas: each series a band on top of the ones before it, a colour each */
const stackedArea = (whole: boolean): Drawer => (rows, p) => {
    const n = rows[0].length, y = (f: number) => p.y0 + p.ph * (whole ? f : 0.92 * f)
    const bands = stacks(rows, whole).map((r, s): PointSection => {
        const tops = r.map(([, b], i): Point => [spread(i, n, p), y(b)])
        const bases = r.map(([a], i): Point => [spread(i, n, p), y(a)]).reverse()
        return {series: s, pts: [...tops, ...bases, tops[0]]}
    })
    return [...bands, axesOf(p)]
}

/* The biggest circle that fits under the title band, for round charts */
const roundPlot = (p: Plot) => ({
    cx: p.W / 2,
    cy: (p.H - p.band) / 2,
    r: Math.max(0.1, Math.min(p.W / 2 - 0.12, (p.H - p.band) / 2 - 0.08))
})

/* Pie or donut: slices clockwise from the top, each value its own series colour */
const pieOrDonut = (hole: number): Drawer => one((vals, p) => {
    const {cx, cy, r} = roundPlot(p)
    const ri = r * hole, sum = vals.reduce((a, b) => a + b, 0) || 1, secs: PointSection[] = []
    let a = 90
    vals.forEach((v, i) => {
        if (v <= 0) return
        const a1 = a - 360 * v / sum, k = Math.max(2, Math.ceil(48 * v / sum)), outer = arcPts(cx, cy, r, r, a, a1, k)
        const inner: Point[] = ri ? arcPts(cx, cy, ri, ri, a1, a, k) : [[cx, cy]]
        secs.push({series: i, pts: [...outer, ...inner, outer[0]]})
        a = a1
    })
    return secs
})

/* Radar: one spoke per value, clockwise from the top, with each series' values joined round them (filled for area,
   overlapping like an area chart's), a colour each. The outer ring is the largest value; a ring at half way helps
   read the rest. Drawn first so the guides show on top. The guides share the first series' line, so the line version
   marks each value with a dot, in its series' colour, to stand out from them. */
const radar = (area: boolean): Drawer => (rows, p) => {
    const {cx, cy, r} = roundPlot(p), n = rows[0].length, top = Math.max(...rows.flat(), 0) || 1
    const at = (i: number, k: number): [number, number] => {
        const t = (90 - 360 * i / n) * Math.PI / 180
        return [cx + r * k * Math.cos(t), cy + r * k * Math.sin(t)]
    }
    const ring = (k: number): Point[] => [...rows[0].map((_, i) => at(i, k)), at(0, k)]
    const joined = (vals: number[]): Point[] => [...vals.map((v, i) => at(i, v / top)), at(0, vals[0] / top)]
    const values = area ? overlapping(rows, joined) : rows.map((vals, s): PointSection => ({
        noFill: 1,
        series: s,
        pts: joined(vals)
    }))
    const dots: PointSection[] = area ? [] : rows.flatMap((vals, s) => joined(vals).slice(0, -1)
        .map(([x, y]): PointSection => ({series: s, pts: arcPts(x, y, r * 0.05, r * 0.05, 0, 360, 12)})))
    return [...values, {noFill: 1, pts: ring(1)}, {noFill: 1, pts: ring(0.5)},
        {
            noFill: 1,
            pts: linePts(...rows[0].map((_, i): [number, number, number, number] => [cx, cy, ...at(i, 1)]))
        }, ...dots]
}

/* Polar (rose) chart: equal wedges clockwise from the top, each reaching out by its value. The radius follows the
   square root, so a wedge's area, which is what the eye compares, follows the value. A series colour each, like a
   pie's slices, inside a ring at the largest value. */
const polar: Drawer = one((vals, p) => {
    const {cx, cy, r} = roundPlot(p), n = vals.length, top = Math.max(...vals, 0) || 1, step = 360 / n
    const secs: PointSection[] = [{noFill: 1, pts: arcPts(cx, cy, r, r, 0, 360, 48)}]
    vals.forEach((v, i) => {
        if (v <= 0) return
        const rv = r * Math.sqrt(v / top), a = 90 - step * i
        secs.push({
            series: i,
            pts: [[cx, cy], ...arcPts(cx, cy, rv, rv, a, a - step, Math.max(2, Math.ceil(48 / n))), [cx, cy]]
        })
    })
    return secs
})

/* Candlestick: per candle, a wick from low to high and a body from open to close, filled when the price rose and
   outlined when it fell. The scale runs from the lowest low to the highest high, not from 0. */
const candlestick: Drawer = one((vals, p) => {
    const lo = Math.min(...vals), span = Math.max(...vals) - lo || 1,
        y = (v: number) => p.y0 + p.ph * (0.05 + 0.9 * (v - lo) / span)
    const n = Math.floor(vals.length / 4), slot = p.pw / Math.max(1, n), secs: PointSection[] = []
    for (let i = 0; i < n; i++) {
        const [open, high, low, close] = vals.slice(i * 4, i * 4 + 4), cx = p.x0 + slot * (i + 0.5)
        const bottom = Math.min(open, close), top = Math.max(open, close)
        secs.push({noFill: 1, pts: linePts([cx, y(low), cx, y(bottom)], [cx, y(top), cx, y(high)])},
            {noFill: close < open ? 1 : 0, pts: boxPts(cx - slot * 0.25, y(bottom), cx + slot * 0.25, y(top))})
    }
    return [...secs, axesOf(p)]
})

/* Gantt: a bar per task, the first at the top, from its start along a time axis to its start plus its length, each in
   its own series colour so a legend can name them. Thin lines mark each unit of time while there are few enough to
   read. The axis runs from 0 (or the earliest start, if that's later) to the latest end. */
const gantt: Drawer = one((vals, p) => {
    const n = Math.floor(vals.length / 2), tasks = Array.from({length: n}, (_, i) => [vals[i * 2], vals[i * 2 + 1]])
    const lo = Math.min(0, ...tasks.map(t => t[0])), hi = Math.max(1, ...tasks.map(t => t[0] + t[1])),
        span = hi - lo || 1
    const x = (v: number) => p.x0 + p.pw * (v - lo) / span, row = p.ph / Math.max(1, n), secs: PointSection[] = []
    if (span <= 24) for (let t = Math.ceil(lo) + 1; t < hi; t++) secs.push({
        noFill: 1,
        pts: [[x(t), p.y0], [x(t), p.y0 + p.ph * 0.02]]
    })
    tasks.forEach(([start, len], i) => {
        const top = p.y1 - row * (i + 0.2), bottom = p.y1 - row * (i + 0.8)
        if (len > 0) secs.push({series: i, pts: boxPts(x(start), bottom, x(start + len), top)})
    })
    return [...secs, axesOf(p)]
})

/* Box plot: per box, a box from the lower quartile to the upper with a line across at the median, and whiskers out
   to the min and max, each ending in a cap. Like a candlestick, the scale runs from the lowest min to the highest max. */
const boxplot: Drawer = one((vals, p) => {
    const lo = Math.min(...vals), span = Math.max(...vals) - lo || 1,
        y = (v: number) => p.y0 + p.ph * (0.05 + 0.9 * (v - lo) / span)
    const n = Math.floor(vals.length / 5), slot = p.pw / Math.max(1, n), secs: PointSection[] = []
    for (let i = 0; i < n; i++) {
        const [min, q1, median, q3, max] = vals.slice(i * 5, i * 5 + 5), cx = p.x0 + slot * (i + 0.5),
            half = slot * 0.25, cap = slot * 0.12
        secs.push({pts: boxPts(cx - half, y(q1), cx + half, y(q3))},
            {
                noFill: 1, pts: linePts([cx, y(min), cx, y(q1)], [cx, y(q3), cx, y(max)],
                    [cx - cap, y(min), cx + cap, y(min)], [cx - cap, y(max), cx + cap, y(max)],
                    [cx - half, y(median), cx + half, y(median)])
            })
    }
    return [...secs, axesOf(p)]
})

/* Heatmap: a cell per value, its rows top down as in the text, each shaded from pale (the lowest value) to the
   chart's fill (the highest). The lowest is still tinted, so an empty-looking cell means no cell. No axes. */
const heatmap: Drawer = (rows, p) => {
    const lo = Math.min(...rows.flat()), span = Math.max(...rows.flat()) - lo,
        x0 = p.x0 - 0.13, w = (p.x1 - x0) / rows[0].length, h = p.ph / rows.length
    return rows.flatMap((vals, r) => vals.map((v, c): PointSection => ({
        series: 0,
        shade: span ? Math.round((0.12 + 0.88 * (v - lo) / span) * 100) / 100 : 1,
        pts: boxPts(x0 + w * c, p.y1 - h * (r + 1), x0 + w * (c + 1), p.y1 - h * r)
    })))
}

/* Spiral chart, for a long series with a cycle (months, hours): twelve values a turn, clockwise from the top and
   winding outwards, each a band whose depth follows its value, alternately filled. One turn's band can't reach the
   next turn, so values a year apart sit side by side. */
const SPIRAL_TURN = 12
const spiral: Drawer = one((vals, p) => {
    const {cx, cy, r} = roundPlot(p), top = Math.max(...vals, 0) || 1, step = 360 / SPIRAL_TURN
    const turns = Math.ceil(vals.length / SPIRAL_TURN), inner = r * 0.3, pitch = (r - inner) / (turns + 0.9)
    const at = (deg: number, out: number): Point => {   // deg clockwise from the top, out beyond the spiral's line there
        const rr = inner + pitch * deg / 360 + out, t = (90 - deg) * Math.PI / 180
        return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)]
    }
    const secs: PointSection[] = []
    vals.forEach((v, i) => {
        if (v <= 0) return
        const d = pitch * 0.9 * v / top, k = 6, ds = Array.from({length: k + 1}, (_, j) => step * (i + j / k))
        secs.push({noFill: i % 2, pts: [...ds.map(a => at(a, d)), ...ds.reverse().map(a => at(a, 0)), at(step * i, d)]})
    })
    return secs
})

const DRAW: Record<ChartKind, Drawer> = {
    bar: bars(false, 0.4),
    hbar: bars(true, 0.4),
    stackedbar: stackedBars(false, false),
    stackedhbar: stackedBars(true, false),
    percentbar: stackedBars(false, true),
    percenthbar: stackedBars(true, true),
    histogram: one((vals, p) => bars(false, 0)([vals], p)),   // like a bar chart, but each bar fills its slot, so neighbours touch
    waterfall: one((vals, p) => {   // the first bar from 0, then each a step up (filled) or down (outlined) from the last
        let run = 0
        const steps = vals.map(v => [run, run += v]), ends = steps.flat()
        const lo = Math.min(0, ...ends), span = Math.max(0, ...ends) - lo || 1,
            y = (v: number) => p.y0 + p.ph * (v - lo) / span
        const slot = p.pw / vals.length, secs: PointSection[] = []
        steps.forEach(([a, b], i) => {
            const left = p.x0 + slot * (i + 0.2), right = p.x0 + slot * (i + 0.8)
            if (a !== b) secs.push({
                noFill: b < a ? 1 : 0,
                pts: boxPts(left, y(Math.min(a, b)), right, y(Math.max(a, b)))
            })
            else secs.push({noFill: 1, pts: [[left, y(b)], [right, y(b)]]})   // no change: the level carries on through
            if (i + 1 < steps.length) secs.push({noFill: 1, pts: [[right, y(b)], [right + slot * 0.4, y(b)]]})   // on to the next bar
        })
        if (lo < 0) secs.push({noFill: 1, pts: [[p.x0, y(0)], [p.x1, y(0)]]})   // the 0 line, when the total dips below it
        return [...secs, axesOf(p)]
    }),
    funnel: one((vals, p) => {   // bands top down, each as wide as its value, narrowing to the next; a series colour each
        const top = Math.max(...vals, 0) || 1, cx = p.W / 2, half = (v: number) => (p.W / 2 - 0.15) * v / top
        const h = (p.y1 - p.y0) / vals.length, secs: PointSection[] = []
        vals.forEach((v, i) => {
            const a = half(v), b = half(i + 1 < vals.length ? vals[i + 1] : v), yt = p.y1 - h * i, yb = yt - h
            if (a || b) secs.push({
                series: i,
                pts: [[cx - a, yt], [cx + a, yt], [cx + b, yb], [cx - b, yb], [cx - a, yt]]
            })
        })
        return secs
    }),
    scatter: one((vals, p) => [...scatterSections(vals, p.x0, p.y0, p.pw, p.ph), axesOf(p)]),
    bubble: one((vals, p) => [...bubbleSections(vals, p.x0, p.y0, p.pw, p.ph), axesOf(p)]),
    candlestick,
    boxplot,
    heatmap,
    gantt,
    line: lineOrArea(false),
    area: lineOrArea(true),
    stackedarea: stackedArea(false),
    percentarea: stackedArea(true),
    radar: radar(false),
    radararea: radar(true),
    polar,
    spiral,
    pie: pieOrDonut(0),
    donut: pieOrDonut(0.55),
}

/* A chart's own values, or its sample when it has none; below 0 only where the chart allows it */
const chartValues = (kind: ChartKind | BareChartKind, values?: ChartValues): ChartValues =>
    (values && values.length && values[0].length ? values : CHART_SAMPLES[kind])
        .map(r => r.map(v => SIGNED.has(kind) ? +v || 0 : Math.max(0, +v || 0)))

/* A framed chart: the frame, then the values (or the sample) drawn by the kind's drawer */
function chartGeo(kind: ChartKind): GeoFn {
    return (W, H, _label, values, attrs) => {
        const rows = chartValues(kind, values)
        const band = H * 0.2, x0 = 0.25, x1 = W - 0.12, y0 = 0.15, y1 = H - band - 0.06
        const plot: Plot = {W, H, band, x0, y0, x1, y1, pw: x1 - x0, ph: y1 - y0}
        return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, 0, W, H)}, ...DRAW[kind](rows, plot)])
    }
}

/* A sparkline: a small line with no frame or axes, scaled from its lowest value to its highest so the trend's shape
   shows, with a dot on the latest value. Its label sits to its right, like a progress bar's. */
const sparklineGeo: GeoFn = (W, H, _label, values) => {
    const [vals] = chartValues('sparkline', values), n = vals.length, lo = Math.min(...vals),
        span = Math.max(...vals) - lo || 1
    const r = H * 0.08, x1 = W * 0.7 - r
    const pts = vals.map((v, i): Point => [n > 1 ? r + (x1 - r) * i / (n - 1) : x1 / 2, H * (0.15 + 0.7 * (v - lo) / span)])
    const [lx, ly] = pts[n - 1]
    return absGeo([{noFill: 1, pts}, {pts: arcPts(lx, ly, r, r, 0, 360, 12)}])
}

/* A bullet chart: a progress bar against a target. The value is the filled bar, the target a mark across the track,
   and the track runs a quarter past the larger of the two. Its label sits to its right, like a progress bar's. */
const bulletGeo: GeoFn = (W, H, _label, values) => {
    const [[value, target]] = chartValues('bullet', values),
        x = (v: number) => W * 0.7 * v * 0.8 / (Math.max(value, target) || 1)
    const secs: PointSection[] = [{noFill: 1, pts: boxPts(0, H * 0.2, W * 0.7, H * 0.8)}]
    if (value > 0) secs.push({pts: boxPts(0, H * 0.35, x(value), H * 0.65)})
    const mark = Math.min(W * 0.015, H * 0.08)
    return absGeo([...secs, {pts: boxPts(x(target) - mark, H * 0.08, x(target) + mark, H * 0.92)}])
}

/* A gauge: a half dial filled clockwise from the left to the percentage in its label ("72%"), like the progress ring.
   Inches rather than fractions, so the dial stays round however the shape is sized. */
const DIAL_IN = 0.62
const dialGeo: GeoFn = (W, H, label) => {
    const p = ringPct(label) / 100, r = Math.min(W / 2, H * 0.9), ri = r * DIAL_IN, cx = W / 2, cy = (H - r) / 2
    const band = (a1: number, k: number): Point[] => {
        const outer = arcPts(cx, cy, r, r, 180, a1, k);
        return [...outer, ...arcPts(cx, cy, ri, ri, a1, 180, k), outer[0]]
    }
    return absGeo([...(p > 0 ? [{pts: band(180 - 180 * p, Math.max(2, Math.ceil(24 * p)))}] : []), {
        noFill: 1,
        pts: band(0, 24)
    }])
}

/* A legend: the series' names in the label, separated by | ("North | South | East"), one row each, top down, with a
   square before each in that series' colour, so the first takes the shape's fill like a chart's first series. No
   frame: it sits beside a chart. Inches, so the squares stay square however it's sized, and the names start just past
   them (LEGEND_TEXT) however wide it is. */
const LEGEND_TEXT = 0.24
const legendGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, row = H / n, s = Math.min(0.12, row * 0.5)
    return absGeo(Array.from({length: n}, (_, i): PointSection => {
        const y = H - row * (i + 0.5)
        return {series: i, pts: boxPts(0.06, y - s / 2, 0.06 + s, y + s / 2)}
    }))
}

/* A legend in a row, to go under a chart: the names side by side, each centred in its own slot (a segmented row)
   with its square just before it. The renderer centres each name, so the square goes where the name's text starts,
   worked out from the average width of a character at the label's size; a little off for very wide or narrow
   letters, never outside the slot. */
const CHAR_W = 0.075   // inches, at 11 pt: the same average layout.ts sizes labels with
const legendrowGeo: GeoFn = (W, H, label) => {
    const parts = segmentsOf(label), n = parts.length, slot = W / n, s = Math.min(0.12, H * 0.5), gap = 0.06
    return absGeo(parts.map((p, i): PointSection => {
        const mid = slot * (i + 0.5), x = Math.max(slot * i + 0.02, mid - p.length * CHAR_W / 2 - gap - s)
        return {series: i, pts: boxPts(x, H / 2 - s / 2, x + s, H / 2 + s / 2)}
    }))
}

/* What every chart has in common */
const chart: ShapeDef = {
    w: 2,
    h: 1.5,
    align: 0,
    txt: {x: 0.5, y: 0.9, w: 0.92, h: 0.18},
    textOnPaper: true,
    chart: true,
    bg: true,
    colours: true
}

export const chartShapes = {

    bar: {
        ...chart, text: 'Bar chart', fill: TABLE.headerFill, geo: chartGeo('bar'),
        palette: {
            label: 'Bar chart',
            icon: '<path d="M6 3V24H40"/><path d="M10 15H15V24H10ZM19 8H24V24H19ZM28 12H33V24H28Z"/>'
        }
    },

    hbar: {
        ...chart, text: 'Bar chart', fill: TABLE.headerFill, geo: chartGeo('hbar'),
        palette: {
            label: 'Horizontal bars', title: 'Horizontal bar chart',
            icon: '<path d="M6 3V24H40"/><path d="M6 6H30V10H6ZM6 12H38V16H6ZM6 18H22V22H6Z"/>'
        }
    },

    stackedbar: {
        ...chart, text: 'Stacked bars', fill: TABLE.headerFill, geo: chartGeo('stackedbar'),
        palette: {
            label: 'Stacked bars', title: 'Stacked bar chart: a row of values per series, stacked',
            icon: '<path d="M6 3V24H40"/><path d="M10 17H15V24H10ZM19 13H24V24H19ZM28 15H33V24H28Z"/><path d="M10 11H15V17H10ZM19 5H24V13H19ZM28 9H33V15H28Z"/>'
        }
    },

    stackedhbar: {
        ...chart, text: 'Stacked bars', fill: TABLE.headerFill, geo: chartGeo('stackedhbar'),
        palette: {
            label: 'Stacked h-bars', title: 'Horizontal stacked bar chart: a row of values per series, stacked',
            icon: '<path d="M6 3V24H40"/><path d="M6 6H20V10H6ZM6 12H26V16H6ZM6 18H14V22H6Z"/><path d="M20 6H30V10H20ZM26 12H38V16H26ZM14 18H24V22H14Z"/>'
        }
    },

    percentbar: {
        ...chart, text: '100% bars', fill: TABLE.headerFill, geo: chartGeo('percentbar'),
        palette: {
            label: '100% bars', title: '100% stacked bar chart: each bar the whole, split by series',
            icon: '<path d="M6 3V24H40"/><path d="M10 14H15V24H10ZM19 11H24V24H19ZM28 17H33V24H28Z"/><path d="M10 4H15V14H10ZM19 4H24V11H19ZM28 4H33V17H28Z"/>'
        }
    },

    percenthbar: {
        ...chart, text: '100% bars', fill: TABLE.headerFill, geo: chartGeo('percenthbar'),
        palette: {
            label: '100% h-bars', title: 'Horizontal 100% stacked bar chart: each bar the whole, split by series',
            icon: '<path d="M6 3V24H40"/><path d="M6 6H22V10H6ZM6 12H16V16H6ZM6 18H28V22H6Z"/><path d="M22 6H38V10H22ZM16 12H38V16H16ZM28 18H38V22H28Z"/>'
        }
    },

    histogram: {
        ...chart, text: 'Histogram', fill: TABLE.headerFill, geo: chartGeo('histogram'),
        palette: {
            label: 'Histogram', title: 'Histogram: how many fall in each range, bars touching',
            icon: '<path d="M6 3V24H40"/><path d="M9 18H15V24H9ZM15 10H21V24H15ZM21 6H27V24H21ZM27 13H33V24H27ZM33 19H38V24H33Z"/>'
        }
    },

    waterfall: {
        ...chart, text: 'Waterfall', fill: TABLE.headerFill, geo: chartGeo('waterfall'),
        palette: {
            label: 'Waterfall', title: 'Waterfall: a start, then steps up and down, falls outlined',
            icon: '<path d="M6 3V24H40"/><path d="M9 14H14V24H9ZM16 7H21V14H16ZM30 5H35V12H30Z"/><path d="M23 7H28V10H23Z"/>'
        }
    },

    funnel: {
        ...chart, text: 'Funnel', fill: TABLE.headerFill, geo: chartGeo('funnel'),
        palette: {
            label: 'Funnel', title: 'Funnel: stages, each band as wide as its value',
            icon: '<path d="M6 4H38L33 11H11ZM11 11H33L28 18H16ZM16 18H28L25 25H19Z"/>'
        }
    },

    line: {
        ...chart, text: 'Line chart', geo: chartGeo('line'),
        palette: {
            label: 'Line chart',
            icon: '<path d="M6 3V24H40"/><path d="M9 19 17 12 24 16 32 7 38 10"/>'
        }
    },

    area: {
        ...chart, text: 'Area chart', fill: TABLE.headerFill, geo: chartGeo('area'),
        palette: {
            label: 'Area chart',
            icon: '<path d="M6 3V24H40"/><path d="M6 24V19L15 11 24 15 32 7 40 10V24Z"/>'
        }
    },

    stackedarea: {
        ...chart, text: 'Stacked areas', fill: TABLE.headerFill, geo: chartGeo('stackedarea'),
        palette: {
            label: 'Stacked areas', title: 'Stacked area chart: a row of values per series, each band on the last',
            icon: '<path d="M6 3V24H40"/><path d="M6 24V18L15 15 24 19 32 13 40 15V24Z"/><path d="M6 18V12L15 8 24 12 32 5 40 8V15L32 13 24 19 15 15Z"/>'
        }
    },

    percentarea: {
        ...chart, text: '100% areas', fill: TABLE.headerFill, geo: chartGeo('percentarea'),
        palette: {
            label: '100% areas', title: '100% stacked area chart: the whole at every point, split by series',
            icon: '<path d="M6 3V24H40"/><path d="M6 24V16L15 13 24 17 32 11 40 14V24Z"/><path d="M6 16V4H40V14L32 11 24 17 15 13Z"/>'
        }
    },

    radar: {
        ...chart, text: 'Radar chart', fill: TABLE.headerFill, geo: chartGeo('radar'),
        palette: {
            label: 'Radar chart', title: 'Radar chart: a spoke per value, joined by a line',
            icon: '<path d="M22 2 34 10 30 25H14L10 10Z"/><path d="M22 7 30 11 27 21H18L13 11Z"/>'
        }
    },

    radararea: {
        ...chart, text: 'Radar chart', fill: TABLE.headerFill, geo: chartGeo('radararea'),
        palette: {
            label: 'Radar area', title: 'Radar area chart: a spoke per value, the shape between them filled',
            icon: '<path d="M22 2 34 10 30 25H14L10 10Z"/><path d="M22 5 31 11 26 21H19L12 11Z"/>'
        }
    },

    polar: {
        ...chart, text: 'Polar chart', fill: TABLE.headerFill, geo: chartGeo('polar'),
        palette: {
            label: 'Polar chart', title: 'Polar (rose) chart: equal wedges, each reaching out by its value',
            icon: '<circle cx="22" cy="14" r="12"/><path d="M22 14V2A12 12 0 0 1 32 8ZM22 14 29 18A8 8 0 0 1 22 22ZM22 14 13 17A9 9 0 0 1 15 8Z"/>'
        }
    },

    spiral: {
        ...chart, text: 'Spiral chart', fill: TABLE.headerFill, geo: chartGeo('spiral'),
        palette: {
            label: 'Spiral chart', title: 'Spiral chart: a long series wound outwards, twelve values a turn',
            icon: '<path d="M22 12A2 2 0 0 1 24 14A4 4 0 0 1 20 18A6 6 0 0 1 16 12A8 8 0 0 1 26 6A10 10 0 0 1 32 16A12 12 0 0 1 18 25"/>'
        }
    },

    pie: {
        ...chart, text: 'Pie chart', fill: TABLE.headerFill, geo: chartGeo('pie'),
        palette: {
            label: 'Pie chart',
            icon: '<circle cx="22" cy="14" r="11"/><path d="M22 14V3A11 11 0 0 1 32 18Z"/>'
        }
    },

    donut: {
        ...chart, text: 'Donut chart', fill: TABLE.headerFill, geo: chartGeo('donut'),
        palette: {
            label: 'Donut chart',
            icon: '<circle cx="22" cy="14" r="11"/><circle cx="22" cy="14" r="6"/><path d="M22 3A11 11 0 0 1 32 18L27 16A6 6 0 0 0 22 8Z"/>'
        }
    },

    scatter: {
        ...chart, text: 'Scatter chart', fill: TABLE.headerFill, geo: chartGeo('scatter'),
        palette: {
            label: 'Scatter chart', title: 'Scatter chart: x and y for each dot',
            icon: '<path d="M6 3V24H40"/><circle cx="12" cy="19" r="1.6"/><circle cx="18" cy="14" r="1.6"/><circle cx="23" cy="16" r="1.6"/><circle cx="28" cy="9" r="1.6"/><circle cx="35" cy="7" r="1.6"/>'
        }
    },

    bubble: {
        ...chart, text: 'Bubble chart', fill: TABLE.headerFill, geo: chartGeo('bubble'),
        palette: {
            label: 'Bubble chart', title: 'Bubble chart: x, y and size for each bubble',
            icon: '<path d="M6 3V24H40"/><circle cx="14" cy="17" r="3"/><circle cx="25" cy="10" r="6"/><circle cx="35" cy="18" r="2"/>'
        }
    },

    candlestick: {
        ...chart, text: 'Candlestick chart', fill: TABLE.headerFill, geo: chartGeo('candlestick'),
        palette: {
            label: 'Candlestick',
            title: 'Candlestick chart: open, high, low and close for each candle; rises filled, falls outlined',
            icon: '<path d="M6 3V24H40"/><path d="M13 6V21M23 4V18M33 9V22"/><path d="M11 9H15V18H11ZM21 7H25V14H21ZM31 12H35V19H31Z"/>'
        }
    },

    boxplot: {
        ...chart, text: 'Box plot', fill: TABLE.headerFill, geo: chartGeo('boxplot'),
        palette: {
            label: 'Box plot',
            title: 'Box plot: min, lower quartile, median, upper quartile and max for each box',
            icon: '<path d="M6 3V24H40"/><path d="M16 4V9M16 18V22M14 4H18M14 22H18M29 7V12M29 19V23M27 7H31M27 23H31"/><path d="M12 9H20V18H12ZM25 12H33V19H25Z"/><path d="M12 14H20M25 16H33"/>'
        }
    },

    heatmap: {
        ...chart, text: 'Heatmap', fill: TABLE.headerFill, geo: chartGeo('heatmap'),
        palette: {
            label: 'Heatmap', title: 'Heatmap: a row of values per row of cells, each shaded by its value',
            icon: '<path d="M6 4H38V24H6ZM6 11H38M6 17H38M14 4V24M22 4V24M30 4V24"/><path d="M14 4 22 11M18 4 22 7.5M14 7.5 17.5 11M30 11 38 17M34 11 38 14.5M30 14.5 33.5 17M6 17 14 24M10 17 14 20.5M6 20.5 9.5 24"/>'
        }
    },

    gantt: {
        ...chart, w: 2.4, text: 'Project plan', fill: TABLE.headerFill, geo: chartGeo('gantt'),
        palette: {
            label: 'Gantt chart',
            title: 'Gantt chart: a start and a length for each task, one bar per task down the chart',
            icon: '<path d="M6 3V24H40"/><path d="M9 6H19V9H9ZM15 11H27V14H15ZM23 16H33V19H23ZM31 20H38V22H31Z"/>'
        }
    },

    treemap: {
        w: 2.4, h: 1.6, text: 'Rent | Food | Travel | Fun | Other', fill: TABLE.headerFill, chart: true, colours: true,
        geo: (W, H, label, values) => absGeo(treemapLayout(W, H, label, chartValues('treemap', values)[0]).sections),
        parts: (W, H, label, values) => treemapLayout(W, H, label, chartValues('treemap', values)[0]).places,
        palette: {
            label: 'Treemap',
            title: 'Treemap: a tile per value, as big as its share; name the tiles in the label, separated by |',
            icon: '<path d="M4 3H24V25H4ZM24 3H40V15H24ZM24 15H33V25H24ZM33 15H40V25H33Z"/>'
        }
    },

    wordcloud: {
        w: 2.6,
        h: 1.4,
        text: 'Fast | Simple | Friendly | Cheap | Secure | Reliable | Modern | Quiet',
        fill: TABLE.headerFill,
        bare: true,
        chart: true,
        colours: true,
        geo: () => [],
        parts: (W, H, label, values) => wordcloudLayout(W, H, label, chartValues('wordcloud', values)[0]),
        palette: {
            label: 'Word cloud', title: 'Word cloud: words in the label separated by |, sized by their values',
            icon: '<path d="M14 12H30M6 18H18M22 18H38M10 24H22M26 24H34M18 6H26"/><path d="M14 12H30" stroke-width="3"/>'
        }
    },

    sankey: {
        w: 3,
        h: 1.6,
        text: 'Visits | Signed up | Left | Paid | Free',
        fill: TABLE.headerFill,
        chart: true,
        colours: true,
        geo: (W, H, label, values) => absGeo(sankeyLayout(W, H, label, chartValues('sankey', values)[0]).sections),
        parts: (W, H, label, values) => sankeyLayout(W, H, label, chartValues('sankey', values)[0]).places,
        palette: {
            label: 'Sankey',
            title: 'Sankey: name the nodes in the label; each flow is from, to (their places, from 1) and amount',
            icon: '<path d="M4 4H7V24H4ZM20 4H23V15H20ZM20 18H23V24H20ZM37 4H40V10H37ZM37 12H40V20H37Z"/><path d="M7 4C14 4 13 4 20 4M7 15C14 15 13 18 20 18M23 4C30 4 30 4 37 4M23 12C30 12 30 12 37 12"/>'
        }
    },

    chord: {
        w: 2.2, h: 2.2, text: 'UK | France | Spain | Italy', fill: TABLE.headerFill, chart: true, colours: true,
        geo: (W, H, label, values) => absGeo(chordLayout(W, H, label, chartValues('chord', values)).sections),
        parts: (W, H, label, values) => chordLayout(W, H, label, chartValues('chord', values)).places,
        palette: {
            label: 'Chord diagram',
            title: 'Chord diagram: a row of values per group, what it sends to each group; name the groups in the label',
            icon: '<path d="M22 3A11 11 0 0 1 33 14M33 16A11 11 0 0 1 23 25M21 25A11 11 0 0 1 11 14M11 12A11 11 0 0 1 20 3"/><path d="M29 8Q22 14 15 21M31 18Q22 14 14 9"/>'
        }
    },

    tilemap: {
        w: 2.2, h: 2.2, text: 'North | Midlands | East | Wales | South | London | West | Scotland | Ireland',
        fill: TABLE.headerFill, chart: true,
        geo: (W, H, label, values) => absGeo(tilemapLayout(W, H, label, chartValues('tilemap', values)[0]).sections),
        parts: (W, H, label, values) => tilemapLayout(W, H, label, chartValues('tilemap', values)[0]).places,
        palette: {
            label: 'Tile map',
            title: 'Tile map (choropleth): a tile per region named in the label, shaded by its value',
            icon: '<path d="M8 3H17V12H8ZM18 3H27V12H18ZM28 3H37V12H28ZM8 13H17V22H8ZM18 13H27V22H18ZM28 13H37V22H28Z"/><path d="M19 4 26 11M29 14 36 21M23 4 26 7M33 14 36 17"/>'
        }
    },

    worldmap: {
        w: 3.2, h: 1.4, text: 'USA | Brazil | France | India | China | Australia',
        fill: TABLE.headerFill, chart: true,
        geo: (W, H, label, values) => absGeo(geomapLayout(WORLD, W, H, label, chartValues('worldmap', values)[0]).sections),
        parts: (W, H, label, values) => geomapLayout(WORLD, W, H, label, chartValues('worldmap', values)[0]).places,
        palette: {
            label: 'World map',
            title: 'World map (choropleth): the countries named in the label, separated by |, shaded by their values',
            icon: '<path d="M4 8C7 5 11 5 14 7L16 11 13 14 15 19 12 23 10 17 6 14ZM19 7C22 5 26 6 28 8L25 11 27 14 23 21 20 15 21 11ZM28 6C33 4 38 6 41 9L37 14 32 12 29 10ZM33 18 39 18 38 22 33 22Z"/>'
        }
    },

    countrymap: {
        w: 1.5, h: 2.6, fill: TABLE.headerFill, chart: true, ...mapShape('countrymap', COUNTRY_MAPS),
        palette: {
            label: 'Country map',
            title: "Country map (choropleth): a country's regions (the UK's, or France's with map=france); name them in the label, separated by |, shaded by their values",
            icon: '<path d="M20 2 25 3 23 7 26 9 24 12 27 16 30 20 28 23 22 25 16 26 19 22 17 19 20 16 18 12 19 8 17 5ZM10 12 14 11 15 15 11 16Z"/>'
        }
    },

    routemap: {
        w: 2.6, h: 2.0, fill: TABLE.headerFill, chart: true, ...mapShape('routemap', ROUTE_MAPS),
        palette: {
            label: 'Route map',
            title: "Route map: an area's parts with its motorways (blue) and main A roads (green) over them (Yorkshire, as the example); name the parts in the label, separated by |, shaded by their values",
            icon: '<path d="M6 6 18 3 30 5 39 9 37 18 30 24 16 25 7 20Z"/><path d="M8 19 17 12 24 10 37 12M19 4 20 13 18 24" stroke-width="2"/>'
        }
    },

    sparkline: {
        w: 1.6,
        h: 0.4,
        text: 'Trend',
        align: 0,
        txt: {x: 0.86, w: 0.28},
        fill: TABLE.headerFill,
        textOnPaper: true,
        chart: true,
        geo: sparklineGeo,
        palette: {
            label: 'Sparkline', title: 'Sparkline: a small trend line with no frame, for cards and tables',
            icon: '<path d="M4 18 9 14 14 16 19 10 24 13 29 7 33 9"/><circle cx="33" cy="9" r="1.6"/><path d="M37 14H42"/>'
        }
    },

    bullet: {
        w: 2,
        h: 0.4,
        text: 'Sales vs target',
        align: 0,
        txt: {x: 0.86, w: 0.28},
        fill: TABLE.headerFill,
        textOnPaper: true,
        chart: true,
        geo: bulletGeo,
        palette: {
            label: 'Bullet chart', title: 'Bullet chart: a value against a target',
            icon: '<path d="M4 9H32V19H4Z"/><path d="M4 12H20V16H4Z"/><path d="M25 6V22"/><path d="M36 14H42"/>'
        }
    },

    dial: {
        w: 1.4,
        h: 0.8,
        text: '72%',
        fill: TABLE.headerFill,
        txt: {y: 0.25, w: 0.5, h: 0.3},
        textOnPaper: true,
        geo: dialGeo,
        palette: {
            label: 'Gauge', title: 'Gauge: a half dial filled to the percentage in its label',
            icon: '<path d="M8 24A14 14 0 0 1 36 24H29A7 7 0 0 0 15 24Z"/><path d="M8 24A14 14 0 0 1 30 12.5L26 18A7 7 0 0 0 15 24Z"/>'
        }
    },

    kpi: {
        w: 1.6,
        h: 0.9,
        text: '£12.4k\nRevenue',
        align: 0,
        txt: {x: 0.56, w: 0.8},
        fill: TABLE.headerFill,
        textOnPaper: true,
        headline: true,
        bg: true,
        geo: (W, H, _label, _values, attrs) => fracGeo(
            {noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: RECT},
            {pts: boxPts(0, 0, 0.04, 1)}
        )(W, H),
        palette: {
            label: 'KPI card', title: 'KPI card: a figure with a caption',
            icon: '<path d="M4 4H40V24H4Z"/><path d="M4 4H7V24H4Z"/><path d="M11 9H30M11 13H30M11 19H24"/>'
        }
    },

    legend: {
        w: 1.2,
        h: 0.75,
        text: 'Series 1 | Series 2 | Series 3',
        fill: TABLE.headerFill,
        align: 0,
        txtInset: LEGEND_TEXT,
        textOnPaper: true,
        colours: true,
        segments: 'column',
        geo: legendGeo,
        palette: {
            label: 'Legend', title: "Legend: the series' names in the label, separated by |, each with its colour",
            icon: '<path d="M8 5H13V10H8ZM8 12H13V17H8ZM8 19H13V24H8Z"/><path d="M17 7.5H36M17 14.5H32M17 21.5H34"/>'
        }
    },

    legendrow: {
        w: 3.3,
        h: 0.3,
        text: 'Series 1 | Series 2 | Series 3',
        fill: TABLE.headerFill,
        textOnPaper: true,
        colours: true,
        segments: 'row',
        geo: legendrowGeo,
        palette: {
            label: 'Legend row', title: "Legend in a row, for under a chart: the series' names separated by |",
            icon: '<path d="M3 12H7V16H3ZM17 12H21V16H17ZM31 12H35V16H31Z"/><path d="M9 14H15M23 14H29M37 14H42"/>'
        }
    },
} satisfies Record<string, ShapeDef>
