import type {GeoFn, Point, PointSection, ShapeDef} from './types'
import {
    RECT,
    absGeo,
    arcPts,
    boxPts,
    fracGeo,
    linePts,
    r4,
    roundedBox,
    roundedEnds,
    squareGeo,
    wavePts
} from './geometry'
import {TABLE} from './database'
import {DEF, ERROR, PALE} from '../engine/colours'

/* A wireframe grid: rows of cells, the first row a header. cells is an array of rows, each an array of strings. */
export const GRID = {
    colW: 0.9, rowH: 0.3, headerFill: PALE,
    cells: [['Name', 'Status', 'Date'], ['Item 1', 'Open', '01/02'], ['Item 2', 'Done', '03/04']]
}
export const gridHeight = (rows: number) => GRID.rowH * Math.max(1, rows)

/* The parts of a segmented label ("Home | Profile | Settings"); a shape with segments draws one slot for each */
export const segmentsOf = (label?: string) => String(label ?? '').split(/\s*\|\s*/)

/* A rating in a label ("4/5", "3.5 / 10"): the score and how many stars, at most 10; five empty stars when there is none */
export const ratingOf = (label?: string) => {
    const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/)
    const stars = m ? Math.max(1, Math.min(10, +m[2])) : 5
    return {score: m ? Math.min(stars, +m[1]) : 0, stars}
}

/* The percentage in a label ("40%"), 0 to 100; 0 when there is none */
export const ringPct = (label?: string) => {
    const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*%/)
    return m ? Math.min(100, +m[1]) : 0
}

/* A progress ring: the track is two circles, and the part done, read from the label ("40%"), is a filled band
   running clockwise from the top. The canvas is rebuilt from the text, so editing the label redraws the band. */
const RING_IN = 0.36
const ringGeo: GeoFn = (W, H, label) => {
    const p = ringPct(label) / 100, secs: PointSection[] = []
    if (p > 0) {
        const a1 = 90 - 360 * p, n = Math.max(2, Math.ceil(48 * p)), outer = arcPts(0.5, 0.5, 0.5, 0.5, 90, a1, n)
        secs.push({pts: [...outer, ...arcPts(0.5, 0.5, RING_IN, RING_IN, a1, 90, n), outer[0]]})
    }
    secs.push({noFill: 1, pts: arcPts(0.5, 0.5, 0.5, 0.5, 0, 360, 48)}, {
        noFill: 1,
        pts: arcPts(0.5, 0.5, RING_IN, RING_IN, 0, 360, 40)
    })
    return fracGeo(...secs)(W, H)
}

/* A progress bar: an outlined track with the part done filled, read from the label ("60%") like the ring */
const barGeo: GeoFn = (W, H, label) => {
    const p = ringPct(label) / 100, secs: PointSection[] = []
    if (p > 0) secs.push({pts: boxPts(0, 0.25, 0.78 * p, 0.75)})
    secs.push({noFill: 1, pts: boxPts(0, 0.25, 0.78, 0.75)})
    return fracGeo(...secs)(W, H)
}

/* A switch: a rounded track with a knob, sized from the height like the checkbox. On ([state=on] in the text) fills
   the track and outlines the knob at the right; off, the default, outlines the track and fills the knob at the left. */
const switchGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const on = !!attrs && attrs.state === 'on'
    const track: Point[] = [...arcPts(0.3, 0.5, 0.3, 0.3, 90, 270, 12), ...arcPts(1.5, 0.5, 0.3, 0.3, 270, 450, 12), [0.3, 0.8]]
    return squareGeo({noFill: on ? 0 : 1, pts: track}, {
        noFill: on ? 1 : 0,
        pts: arcPts(on ? 1.5 : 0.3, 0.5, 0.21, 0.21, 0, 360, 20)
    })(W, H)
}

/* Tabs: a slot per tab, the first one the open tab, marked by a filled bar along its foot; a line runs under the rest */
const tabsGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, secs: PointSection[] = []
    for (let i = 0; i < n; i++) secs.push({
        noFill: 1,
        pts: [[i / n, 0, 'MoveTo'], [i / n, 1], [(i + 1) / n, 1], [(i + 1) / n, 0]]
    })
    secs.push({noFill: 1, pts: linePts([0, 0, 1, 0])}, {pts: boxPts(0, 0, 1 / n, 0.1)})
    return fracGeo(...secs)(W, H)
}

/* Breadcrumb: the parts of the path with a chevron between each */
const breadcrumbGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, c = Math.min(0.04, H * 0.15)
    return absGeo(Array.from({length: n - 1}, (_, i): PointSection => {
        const x = W * (i + 1) / n
        return {noFill: 1, pts: [[x - c / 2, H * 0.68], [x + c / 2, H / 2], [x - c / 2, H * 0.32]]}
    }))
}

/* Pagination: a box per part ("‹ | 1 | 2 | 3 | ›"), the current page (the first number) marked by a bar along its foot */
const paginationGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, gap = Math.min(0.04, W / n * 0.1), cur = n > 2 ? 1 : 0,
        secs: PointSection[] = []
    for (let i = 0; i < n; i++) secs.push({noFill: 1, pts: boxPts(W * i / n + gap, 0, W * (i + 1) / n - gap, H)})
    secs.push({pts: boxPts(W * cur / n + gap, 0, W * (cur + 1) / n - gap, H * 0.12)})
    return absGeo(secs)
}

/* Stepper: a circle per step joined by a line, the first (the current step) filled, with the names underneath */
const stepperGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, r = H * 0.16, y = H * 0.75, x = (i: number) => W * (i + 0.5) / n
    const secs: PointSection[] = []
    for (let i = 0; i + 1 < n; i++) secs.push({noFill: 1, pts: linePts([x(i) + r, y, x(i + 1) - r, y])})
    for (let i = 0; i < n; i++) secs.push({noFill: i ? 1 : 0, pts: arcPts(x(i), y, r, r, 0, 360, 20)})
    return absGeo(secs)
}

/* Filter pills: a rounded pill per filter, spaced along the row */
const pillsGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, gap = Math.min(0.06, W / n * 0.1), r = H / 2
    return absGeo(Array.from({length: n}, (_, i): PointSection => {
        const x0 = W * i / n + gap + r, x1 = W * (i + 1) / n - gap - r
        return {noFill: 1, pts: [...arcPts(x0, r, r, r, 90, 270, 10), ...arcPts(x1, r, r, r, -90, 90, 10), [x0, H]]}
    }))
}

/* A column of rows, the top one first: its outline, and a line between each row. row(i, y0, y1, W, H, part) adds a
   row's marks, part being that row's text. */
const rowsGeo = (row: (i: number, y0: number, y1: number, W: number, H: number, part: string) => PointSection[]): GeoFn => (W, H, label) => {
    const parts = segmentsOf(label), n = parts.length, secs: PointSection[] = [{noFill: 1, pts: boxPts(0, 0, W, H)}]
    for (let i = 0; i < n; i++) {
        const y1 = H * (1 - i / n), y0 = H * (1 - (i + 1) / n)
        if (i) secs.push({noFill: 1, pts: linePts([0, y1, W, y1])})
        secs.push(...row(i, y0, y1, W, H, parts[i]))
    }
    return absGeo(secs)
}

/* List: a bullet before each item */
const listGeo = rowsGeo((_i, y0, y1) => {
    const r = Math.min(0.03, (y1 - y0) * 0.12);
    return [{pts: arcPts(0.12, (y0 + y1) / 2, r, r, 0, 360, 12)}]
})

/* Sidebar menu: the first item is the current page, marked by a filled bar down its left edge */
const sidebarGeo = rowsGeo((i, y0, y1) => i ? [] : [{pts: boxPts(0, y0, 0.05, y1)}])

/* Accordion: a chevron at the right of each section, pointing down on the first (open) one and right on the rest */
const accordionGeo = rowsGeo((i, y0, y1, W) => {
    const c = Math.min(0.06, (y1 - y0) * 0.2), x = W - 0.15, y = (y0 + y1) / 2
    return [{
        noFill: 1,
        pts: i ? [[x - c / 2, y + c], [x + c / 2, y], [x - c / 2, y - c]] : [[x - c, y + c / 2], [x, y - c / 2], [x + c, y + c / 2]]
    }]
})

/* A checkbox: a square sized from the height, ticked when on ([state=on]). Outlined, so only a radio's dot takes the fill. */
const checkboxGeo: GeoFn = (W, H, _label, _values, attrs) => squareGeo({noFill: 1, pts: boxPts(0, 0.17, 0.667, 0.83)},
    ...(attrs?.state === 'on' ? [{noFill: 1, pts: [[0.15, 0.5], [0.29, 0.33], [0.53, 0.68]] as Point[]}] : []))(W, H)

/* A radio button: a circle sized from the height, with a dot in it when selected ([state=on]) */
const radioGeo: GeoFn = (W, H, _label, _values, attrs) => squareGeo({
        noFill: 1,
        pts: arcPts(1 / 3, 0.5, 1 / 3, 1 / 3, 0, 360, 24)
    },
    ...(attrs?.state === 'on' ? [{pts: arcPts(1 / 3, 0.5, 0.15, 0.15, 0, 360, 16)}] : []))(W, H)

/* A slider: a thin track, filled up to the percentage in the label ("40%"), with a round knob there */
const sliderGeo: GeoFn = (W, H, label) => {
    const p = ringPct(label) / 100, r = H * 0.3, x0 = r, x1 = W * 0.78 - r, x = x0 + (x1 - x0) * p, t = H * 0.06
    const secs: PointSection[] = [{noFill: 1, pts: boxPts(x0, H / 2 - t, x1, H / 2 + t)}]
    if (p > 0) secs.push({pts: boxPts(x0, H / 2 - t, x, H / 2 + t)})
    return absGeo([...secs, {pts: arcPts(x, H / 2, r, r, 0, 360, 20)}])
}

/* A search box: a field with a magnifying glass at its left */
const searchGeo: GeoFn = (W, H) => [...fracGeo({pts: RECT})(W, H),
    ...squareGeo({noFill: 1, pts: arcPts(0.45, 0.56, 0.17, 0.17, 0, 360, 16)}, {
        noFill: 1,
        pts: linePts([0.57, 0.44, 0.7, 0.3])
    })(W, H)]

/* A text area: a box for several lines, with a resize grip in the bottom right corner */
const textareaGeo: GeoFn = (W, H) => {
    const g = Math.min(0.12, H * 0.2)
    return absGeo([{pts: boxPts(0, 0, W, H)}, {
        noFill: 1,
        pts: linePts([W - g, 0.03, W - 0.03, g], [W - g / 2, 0.03, W - 0.03, g / 2])
    }])
}

/* A date picker: a field with a calendar at its right */
const datepickerGeo: GeoFn = (W, H) => {
    const s = H * 0.5, x1 = W - H * 0.25, x0 = x1 - s, y0 = H * 0.22, y1 = y0 + s
    return absGeo([{pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: boxPts(x0, y0, x1, y1)},
        {
            noFill: 1,
            pts: linePts([x0, y1 - s * 0.3, x1, y1 - s * 0.3], [x0 + s * 0.3, y1 + s * 0.15, x0 + s * 0.3, y1 - s * 0.1], [x1 - s * 0.3, y1 + s * 0.15, x1 - s * 0.3, y1 - s * 0.1])
        }])
}

/* A header / nav bar: a logo at the left, then the label's parts (brand and links) spaced along the bar */
const navbarGeo: GeoFn = (W, H, _label, _values, attrs) => [...fracGeo({
    noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: RECT
})(W, H), ...squareGeo({pts: boxPts(0.25, 0.2, 0.85, 0.8)})(W, H)]

/* A modal dialog: a box with a close cross in its top right corner and two buttons along the bottom right */
const modalGeo: GeoFn = (W, H) => {
    const c = 0.07, bw = Math.min(0.8, W * 0.28), bh = Math.min(0.3, H * 0.18), m = 0.12
    return absGeo([{pts: boxPts(0, 0, W, H)}, {
        noFill: 1,
        pts: linePts([W - m - 2 * c, H - m, W - m, H - m - 2 * c], [W - m - 2 * c, H - m - 2 * c, W - m, H - m])
    },
        {noFill: 1, pts: boxPts(W - m - bw, m, W - m, m + bh)}, {
            noFill: 1,
            pts: boxPts(W - 2 * m - 2 * bw, m, W - 2 * m - bw, m + bh)
        }])
}

/* A card: rounded corners, a picture placeholder across the top and its text underneath */
const cardGeo: GeoFn = (W, H) => {
    const m = 0.1, y0 = H * 0.5
    return absGeo([{pts: roundedBox(W, H, 0.08)}, {noFill: 1, pts: boxPts(m, y0, W - m, H - m)}, {
        noFill: 1,
        pts: linePts([m, y0, W - m, H - m], [m, H - m, W - m, y0])
    }])
}

/* An alert banner: a filled bar down its left edge and an information mark, the message beside them */
const alertGeo: GeoFn = (W, H) => {
    const r = Math.min(0.11, H * 0.3), cx = 0.12 + r, cy = H / 2
    return absGeo([{noFill: 1, pts: boxPts(0, 0, W, H)}, {pts: boxPts(0, 0, 0.05, H)}, {
        noFill: 1,
        pts: arcPts(cx, cy, r, r, 0, 360, 20)
    },
        {noFill: 1, pts: linePts([cx, cy - r * 0.55, cx, cy + r * 0.15], [cx, cy + r * 0.4, cx, cy + r * 0.5])}])
}

/* A five-pointed star centred on cx, cy */
const starPts = (cx: number, cy: number, r: number): Point[] =>
    Array.from({length: 11}, (_, i): Point => {
        const t = (90 + 36 * i) * Math.PI / 180, k = i % 2 ? r * 0.42 : r
        return [cx + k * Math.cos(t), cy + k * Math.sin(t)]
    })

/* A star rating: a star for each point of the total, filled up to the score (rounded to the nearest whole star) */
const ratingGeo: GeoFn = (W, H, label) => {
    const {score, stars} = ratingOf(label), s = Math.min(H, W * 0.78 / stars), on = Math.round(score)
    return absGeo(Array.from({length: stars}, (_, i): PointSection => ({
        noFill: i < on ? 0 : 1,
        pts: starPts(s * (i + 0.5), H / 2, s * 0.46)
    })))
}

/* A video player: a play button in a circle in the middle, and a seek bar along the bottom, a third played.
   The play button is section 2: flow-editor.css finds it by that number to animate it on hover, so keep it third */
const videoGeo: GeoFn = (W, H) => {
    const r = Math.min(W, H) * 0.17, cx = W / 2, cy = H * 0.55, m = Math.min(0.12, W * 0.08),
        by = Math.min(0.14, H * 0.12)
    const played = m + (W - 2 * m) / 3, dot = Math.min(0.04, H * 0.04)
    return absGeo([{noFill: 1, pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: arcPts(cx, cy, r, r, 0, 360, 32)},
        {pts: [[cx - r * 0.35, cy - r * 0.5], [cx + r * 0.55, cy], [cx - r * 0.35, cy + r * 0.5], [cx - r * 0.35, cy - r * 0.5]]},
        {noFill: 1, pts: linePts([m, by, W - m, by])}, {pts: boxPts(m, by - 0.012, played, by + 0.012)},
        {pts: arcPts(played, by, dot, dot, 0, 360, 16)}])
}

/* Two percentages in a label ("20–70%", "20% to 70%"), smallest first, 0 to 100; both ends when there are none */
export const rangePct = (label?: string): [number, number] => {
    const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*%/)
    if (!m) return [0, 100]
    const a = Math.min(100, +m[1]), b = Math.min(100, +m[2])
    return [Math.min(a, b), Math.max(a, b)]
}

/* A part of a segmented label that is turned on: it starts with a tick ("✓ Parking") */
export const isTicked = (part: string) => /^[✓✔]/.test(part)

/* A pill from x0 to x1, h high, its ends round */
const pillPts = (x0: number, x1: number, h: number): Point[] => {
    const r = h / 2
    return [...arcPts(x0 + r, r, r, r, 90, 270, 10), ...arcPts(x1 - r, r, r, r, -90, 90, 10), [x0 + r, h]]
}

/* A password field: the label is the hidden text ("••••••••"), with a show / hide eye at the right */
const passwordGeo: GeoFn = (W, H) => {
    const cx = W - H * 0.55, cy = H / 2
    return absGeo([{pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: arcPts(cx, cy, H * 0.3, H * 0.17, 0, 360, 24)},
        {noFill: 1, pts: arcPts(cx, cy, H * 0.08, H * 0.08, 0, 360, 12)}])
}

/* A number input: the number in the middle, a − button at the left and a + at the right, each a square */
const numberGeo: GeoFn = (W, H) => {
    const s = Math.min(H, W / 3), c = s * 0.22
    return absGeo([{pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: linePts([s, 0, s, H], [W - s, 0, W - s, H])},
        {
            noFill: 1,
            pts: linePts([s / 2 - c, H / 2, s / 2 + c, H / 2], [W - s / 2 - c, H / 2, W - s / 2 + c, H / 2], [W - s / 2, H / 2 - c, W - s / 2, H / 2 + c])
        }])
}

/* A segmented control (button group): a slot per option, joined, the first one chosen and filled */
const segmentedGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length
    const secs: PointSection[] = [{pts: boxPts(0, 0, W / n, H)}, {noFill: 1, pts: boxPts(0, 0, W, H)}]
    if (n > 1) secs.push({
        noFill: 1,
        pts: linePts(...Array.from({length: n - 1}, (_, i): [number, number, number, number] => [W * (i + 1) / n, 0, W * (i + 1) / n, H]))
    })
    return absGeo(secs)
}

/* A time picker: a field with a clock at its right, its hands at ten past ten */
const timepickerGeo: GeoFn = (W, H) => {
    const r = H * 0.26, cx = W - H * 0.5, cy = H / 2
    return absGeo([{pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: arcPts(cx, cy, r, r, 0, 360, 24)},
        {noFill: 1, pts: [[cx - r * 0.45, cy + r * 0.3], [cx, cy], [cx + r * 0.55, cy + r * 0.4]]}])
}

/* A colour picker: a swatch in the shape's fill at the left, the colour's name beside it, a chevron at the right */
const colourpickerGeo: GeoFn = (W, H) => {
    const m = H * 0.2, c = H * 0.12
    return absGeo([{noFill: 1, pts: boxPts(0, 0, W, H)}, {pts: boxPts(m, m, H - m, H - m)},
        {
            noFill: 1,
            pts: [[W - H * 0.5 - c, H / 2 + c / 2], [W - H * 0.5, H / 2 - c / 2], [W - H * 0.5 + c, H / 2 + c / 2]]
        }])
}

/* A file drop zone: a dashed outline (drawn as dashes, since the line pattern is the whole shape's), an upload arrow
   over a tray in the upper half, and the label underneath */
const uploadGeo: GeoFn = (W, H) => {
    const dash = 0.08, gap = 0.05, dashes: [number, number, number, number][] = []
    const side = (x0: number, y0: number, x1: number, y1: number) => {
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round((len + gap) / (dash + gap))),
            step = (len + gap) / n, d = step - gap
        for (let i = 0; i < n; i++) {
            const a = i * step / len, b = Math.min(1, (i * step + d) / len)
            dashes.push([x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b])
        }
    }
    side(0, 0, W, 0)
    side(W, 0, W, H)
    side(W, H, 0, H)
    side(0, H, 0, 0)
    const s = Math.min(H * 0.18, W * 0.12), cx = W / 2, y0 = H * 0.5, y1 = y0 + s * 1.4
    return absGeo([{noFill: 1, pts: linePts(...dashes)},
        {
            noFill: 1,
            pts: linePts([cx, y0, cx, y1], [cx - s * 0.5, y1 - s * 0.5, cx, y1], [cx, y1, cx + s * 0.5, y1 - s * 0.5])
        },
        {
            noFill: 1,
            pts: [[cx - s, y0 + s * 0.3], [cx - s, y0 - s * 0.25], [cx + s, y0 - s * 0.25], [cx + s, y0 + s * 0.3]]
        }])
}

/* One-time code: a box per character of the code, with a gap between each */
const otpGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, gap = Math.min(0.08, W / n * 0.15)
    return absGeo(Array.from({length: n}, (_, i): PointSection => ({
        noFill: 1,
        pts: boxPts(W * i / n + gap / 2, 0, W * (i + 1) / n - gap / 2, H)
    })))
}

/* Toggle chips: a pill per option, filled when its name starts with a tick ("✓ Parking"), outlined when it doesn't */
const togglechipsGeo: GeoFn = (W, H, label) => {
    const parts = segmentsOf(label), n = parts.length, gap = Math.min(0.06, W / n * 0.1)
    return absGeo(parts.map((p, i): PointSection => ({
        noFill: isTicked(p) ? 0 : 1,
        pts: pillPts(W * i / n + gap, W * (i + 1) / n - gap, H)
    })))
}

/* A range slider: a thin track, filled between the two percentages in the label ("20–70%"), with a knob at each */
const rangesliderGeo: GeoFn = (W, H, label) => {
    const [a, b] = rangePct(label).map(v => v / 100), r = H * 0.3, x0 = r, x1 = W * 0.55 - r, t = H * 0.06,
        x = (p: number) => x0 + (x1 - x0) * p
    const secs: PointSection[] = [{noFill: 1, pts: boxPts(x0, H / 2 - t, x1, H / 2 + t)}]
    if (b > a) secs.push({pts: boxPts(x(a), H / 2 - t, x(b), H / 2 + t)})
    return absGeo([...secs, {pts: arcPts(x(a), H / 2, r, r, 0, 360, 20)}, {pts: arcPts(x(b), H / 2, r, r, 0, 360, 20)}])
}

/* A form field: three parts in the label, top down: the field's name, what's typed in it, and a message under it.
   The box goes round the middle one. */
const formfieldGeo: GeoFn = (W, H) => {
    const third = H / 3, m = third * 0.08
    return absGeo([{pts: boxPts(0, third + m, W, 2 * third - m)}])
}

/* A spinner: eight dots round a circle, the one at the top in the full fill and each after it, clockwise, paler */
const spinnerGeo: GeoFn = (W, H) => absGeo(Array.from({length: 8}, (_, i): PointSection => {
    const s = Math.min(W, H), t = (90 - 45 * i) * Math.PI / 180, cx = W / 2 + s * 0.36 * Math.cos(t),
        cy = H / 2 + s * 0.36 * Math.sin(t), r = s * 0.1
    return {series: 0, shade: Math.round((1 - i * 0.11) * 100) / 100, pts: arcPts(cx, cy, r, r, 0, 360, 12)}
}))

/* A skeleton loader: grey blocks where content will be, a round picture at the left and three lines of text */
const skeletonGeo: GeoFn = (W, H) => {
    const r = Math.min(H * 0.3, W * 0.15), x = 2 * r + 0.15, row = H / 4, t = Math.min(0.06, row * 0.3)
    return absGeo([{pts: arcPts(r, H - r - row * 0.3, r, r, 0, 360, 24)},
        ...[0.95, 0.8, 0.55].map((k, i): PointSection => {
            const y = H - row * (i + 0.8)
            return {pts: boxPts(x, y - t, x + (W - x) * k, y + t)}
        })])
}

/* A toast: a white card with a shadow under it in a pale tint of the fill, a tick in the fill at its left and a close
   cross at its right. The card and shadow are shades of the one fill (white is shade 0), so Visio fills all of it. */
const toastGeo: GeoFn = (W, H) => {
    const o = Math.min(0.04, H * 0.08), r = Math.min(0.11, H * 0.25), cx = 0.12 + r, cy = H / 2,
        c = Math.min(0.06, H * 0.12)
    return absGeo([{series: 0, shade: 0.25, pts: roundedBox(W, H, 0.06).map(([x, y]): Point => [x + o, y - o])},
        {series: 0, shade: 0, pts: roundedBox(W, H, 0.06)},
        {series: 0, pts: arcPts(cx, cy, r, r, 0, 360, 20)},
        {
            series: 0,
            shade: 0,
            noFill: 1,
            pts: [[cx - r * 0.45, cy], [cx - r * 0.1, cy - r * 0.35], [cx + r * 0.45, cy + r * 0.3]]
        },
        {
            noFill: 1,
            pts: linePts([W - 0.12 - c, cy - c, W - 0.12 + c, cy + c], [W - 0.12 - c, cy + c, W - 0.12 + c, cy - c])
        }])
}

/* An empty state: a picture of an empty tray above the message, and a button under it */
const emptystateGeo: GeoFn = (W, H) => {
    const s = Math.min(H * 0.16, W * 0.12), cx = W / 2, y = H * 0.68, bw = Math.min(1, W * 0.4),
        bh = Math.min(0.3, H * 0.18)
    return absGeo([{noFill: 1, pts: boxPts(0, 0, W, H)},
        {
            noFill: 1,
            pts: [[cx - s * 1.4, y + s * 0.6], [cx - s, y + s * 1.6], [cx + s, y + s * 1.6], [cx + s * 1.4, y + s * 0.6]]
        },
        {
            noFill: 1,
            pts: [[cx - s * 1.4, y + s * 0.6], [cx - s * 1.4, y], [cx + s * 1.4, y], [cx + s * 1.4, y + s * 0.6],
                [cx + s * 0.5, y + s * 0.6], [cx + s * 0.4, y + s * 0.35], [cx - s * 0.4, y + s * 0.35], [cx - s * 0.5, y + s * 0.6], [cx - s * 1.4, y + s * 0.6]]
        },
        {noFill: 1, pts: roundedBox(bw, bh, bh / 2).map(([x, yy]): Point => [x + cx - bw / 2, yy + H * 0.1])}])
}

/* An inline error: a round mark with a white ! in it, in the error colour, and the message beside it */
const inlineerrorGeo: GeoFn = (W, H) => {
    const r = H * 0.32, cx = r + 0.02, cy = H / 2, t = r * 0.13
    return absGeo([{series: 0, pts: arcPts(cx, cy, r, r, 0, 360, 20)},
        {series: 0, shade: 0, pts: boxPts(cx - t, cy - r * 0.1, cx + t, cy + r * 0.6)},
        {series: 0, shade: 0, pts: boxPts(cx - t, cy - r * 0.6, cx + t, cy - r * 0.35)}])
}

/* A menu card: a shadow in a pale tint of the fill, a white card over it (shade 0) and the first item lit by a light
   tint, from y0 up to y1. n is how many items the card holds. */
const menuCard = (W: number, y0: number, y1: number, n: number): PointSection[] => {
    const o = Math.min(0.03, (y1 - y0) * 0.05), row = (y1 - y0) / n, m = Math.min(0.03, row * 0.12),
        card = roundedBox(W, y1 - y0, 0.04).map(([x, y]): Point => [x, y + y0])
    return [{series: 0, shade: 0.25, pts: card.map(([x, y]): Point => [x + o, y - o])}, {
        series: 0,
        shade: 0,
        pts: card
    },
        {series: 0, shade: 0.18, pts: boxPts(m, y1 - row + m, W - m, y1 - m)}]
}

/* An open dropdown menu: the field (the label's first part) with its chevron turned up, and under it the list of
   options, the rest of the parts, on a card with the first one lit */
const dropdownmenuGeo: GeoFn = (W, H, label, _values, attrs) => {
    const n = segmentsOf(label).length, s = H / n, g = Math.min(0.03, s * 0.1), cy = H - s / 2,
        c = Math.min(0.03, s * 0.12)
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, H - s + g, W, H)},
        {noFill: 1, pts: [[W - 0.2, cy - c / 2], [W - 0.15, cy + c / 2], [W - 0.1, cy - c / 2]]},
        ...menuCard(W, 0, H - s - g, Math.max(1, n - 1))])
}

/* A context menu: a card of commands, the first lit (under the pointer), with a line setting the last one apart */
const contextmenuGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, y = H / n, secs = menuCard(W, 0, H, n)
    if (n > 2) secs.push({noFill: 1, pts: linePts([0.06, y, W - 0.06, y])})
    return absGeo(secs)
}

/* A menu bar: a strip with the menus packed at its left, the first one open (lit). The text block is MENUBAR_TXT,
   so the lit box sits under the first part. */
const MENUBAR_TXT = {x: 0.3, w: 0.56}
const menubarGeo: GeoFn = (W, H, label, _values, attrs) => {
    const n = segmentsOf(label).length, x0 = W * (MENUBAR_TXT.x - MENUBAR_TXT.w / 2), m = H * 0.12
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, 0, W, H)},
        {series: 0, shade: 0.18, pts: boxPts(x0, m, x0 + W * MENUBAR_TXT.w / n, H - m)}])
}

/* A bottom tab bar: an icon over each tab's name, the first (the open tab) filled and the rest outlined */
const tabbarGeo: GeoFn = (W, H, label, _values, attrs) => {
    const n = segmentsOf(label).length, r = Math.min(H * 0.15, W / n * 0.2), y = H * 0.66
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, 0, W, H)},
        ...Array.from({length: n}, (_, i): PointSection => ({
            noFill: i ? 1 : 0,
            pts: arcPts(W * (i + 0.5) / n, y, r, r, 0, 360, 20)
        }))])
}

/* A floating action button: a round button in the fill with a white + (shade 0), over a pale shadow */
const fabGeo: GeoFn = (W, H) => {
    const s = Math.min(W, H), r = s * 0.46, cx = W / 2, cy = H / 2, o = s * 0.04, a = r * 0.42, t = r * 0.07
    return absGeo([{series: 0, shade: 0.25, pts: arcPts(cx + o, cy - o, r, r, 0, 360, 32)},
        {series: 0, pts: arcPts(cx, cy, r, r, 0, 360, 32)},
        {series: 0, shade: 0, pts: boxPts(cx - a, cy - t, cx + a, cy + t)},
        {series: 0, shade: 0, pts: boxPts(cx - t, cy - a, cx + t, cy + a)}])
}

/* A back header: a back chevron at the left, the title in the middle and a ⋮ menu at the right */
const backheaderGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const c = Math.min(0.06, H * 0.14), cy = H / 2, d = Math.min(0.022, H * 0.05)
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, 0, W, H)},
        {noFill: 1, pts: [[0.15 + c, cy + c * 1.6], [0.15, cy], [0.15 + c, cy - c * 1.6]]},
        ...[-1, 0, 1].map((k): PointSection => ({pts: arcPts(W - 0.15, cy + k * d * 3, d, d, 0, 360, 10)}))])
}

/* A divider: a line across, broken in the middle for a label ("or") when there is one */
const dividerGeo: GeoFn = (W, H, label) => {
    const t = String(label ?? '').trim(), g = t ? Math.min(W * 0.6, t.length * 0.075 + 0.2) / 2 : 0, y = H / 2
    return absGeo([{noFill: 1, pts: t ? linePts([0, y, W / 2 - g, y], [W / 2 + g, y, W, y]) : linePts([0, y, W, y])}])
}

/* A hero section: the headline and a line under it at the left, a filled button under them and a picture at the right */
const heroGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const m = Math.min(0.2, W * 0.05), x0 = W * 0.58, bw = Math.min(1.1, W * 0.25), bh = Math.min(0.32, H * 0.16)
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: boxPts(x0, m, W - m, H - m)},
        {noFill: 1, pts: linePts([x0, m, W - m, H - m], [x0, H - m, W - m, m])},
        {pts: roundedBox(bw, bh, bh / 2).map(([x, y]): Point => [x + m, y + H * 0.15])}])
}

/* A split pane: two panes side by side, a pane per part of the label, with a grip on the line between them */
const splitpaneGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const g = Math.min(0.05, W * 0.02), h = Math.min(0.3, H * 0.15)
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: linePts([W / 2, 0, W / 2, H])},
        {pts: pillPts(-h / 2, h / 2, 2 * g).map(([x, y]): Point => [W / 2 + y - g, H / 2 + x])}])
}

/* A scroll bar: a track with a filled thumb a third of the way along and an arrow at each end; it runs along the
   longer side, down when it is taller than wide */
const scrollbarGeo: GeoFn = (W, H) => {
    const down = H >= W, L = down ? H : W, T = down ? W : H, a = Math.min(T, L * 0.15), m = T * 0.2,
        p = (u: number, v: number): Point => down ? [v, H - u] : [u, v],
        across = (u: number): [number, number, number, number] => [...p(u, 0).slice(0, 2), ...p(u, T).slice(0, 2)] as [number, number, number, number]
    return absGeo([{noFill: 1, pts: [p(0, 0), p(L, 0), p(L, T), p(0, T), p(0, 0)]},
        {noFill: 1, pts: linePts(across(a), across(L - a))},
        {pts: [p(a * 0.3, T / 2), p(a * 0.7, T * 0.75), p(a * 0.7, T * 0.25), p(a * 0.3, T / 2)]},
        {pts: [p(L - a * 0.3, T / 2), p(L - a * 0.7, T * 0.75), p(L - a * 0.7, T * 0.25), p(L - a * 0.3, T / 2)]},
        {pts: [p(a + (L - 2 * a) * 0.1, m), p(a + (L - 2 * a) * 0.4, m), p(a + (L - 2 * a) * 0.4, T - m), p(a + (L - 2 * a) * 0.1, T - m), p(a + (L - 2 * a) * 0.1, m)]}])
}

/* An image carousel: a picture with a chevron either side to move between slides, and a dot per slide under it, the
   first (the slide showing) filled */
const carouselGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const a = Math.min(0.3, W * 0.12), y0 = Math.min(0.25, H * 0.18), c = Math.min(0.07, a * 0.3), cy = (y0 + H) / 2,
        r = Math.min(0.03, y0 * 0.2)
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(a, y0, W - a, H)}, {
        noFill: 1,
        pts: linePts([a, y0, W - a, H], [a, H, W - a, y0])
    },
        {noFill: 1, pts: [[a / 2 + c / 2, cy + c * 1.6], [a / 2 - c / 2, cy], [a / 2 + c / 2, cy - c * 1.6]]},
        {
            noFill: 1,
            pts: [[W - a / 2 - c / 2, cy + c * 1.6], [W - a / 2 + c / 2, cy], [W - a / 2 - c / 2, cy - c * 1.6]]
        },
        ...[0, 1, 2, 3].map((i): PointSection => ({
            noFill: i ? 1 : 0,
            pts: arcPts(W / 2 + (i - 1.5) * r * 4, y0 / 2, r, r, 0, 360, 12)
        }))])
}

/* A code block: a pale panel, a gutter down its left (where line numbers go) and a copy button in its top right
   corner. The code is its label, in the page's font: one font per shape. */
const CODE_GUTTER = 0.08
const codeblockGeo: GeoFn = (W, H) => {
    const g = W * CODE_GUTTER, s = Math.min(0.09, H * 0.12), x = W - 0.08 - 1.3 * s, y = H - 0.08 - 1.3 * s
    return absGeo([{pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: linePts([g, 0, g, H])},
        {noFill: 1, pts: boxPts(x, y, x + s, y + s)},
        {
            noFill: 1,
            pts: [[x + 0.3 * s, y + s], [x + 0.3 * s, y + 1.3 * s], [x + 1.3 * s, y + 1.3 * s], [x + 1.3 * s, y + 0.3 * s], [x + s, y + 0.3 * s]]
        }])
}

/* A chat bubble: the sender's avatar at the bottom left and a rounded bubble beside it, its tail pointing at the
   avatar. The bubble starts CHAT_X of the way across, where the text block starts. [side=right] (a message from me)
   mirrors it, avatar at the right; buildShape mirrors the text block to match. */
const CHAT_X = 0.2
const chatbubbleGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const x0 = W * CHAT_X, t = Math.min(0.1, x0 * 0.3), r = Math.min((x0 - t) * 0.42, H * 0.22, 0.16),
        br = Math.min(0.1, H * 0.25),
        side = (pts: Point[]): Point[] => attrs?.side === 'right' ? pts.map(([x, y]): Point => [W - x, y]) : pts
    return absGeo([{pts: side(arcPts(r, r, r, r, 0, 360, 24))},
        {
            pts: side([[x0 - t, 0], ...arcPts(W - br, br, br, br, -90, 0, 6), ...arcPts(W - br, H - br, br, br, 0, 90, 6),
                ...arcPts(x0 + br, H - br, br, br, 90, 180, 6), [x0, t * 1.5], [x0 - t, 0]])
        }])
}

/* A comment thread: every part of the label but the last is a comment, each with an avatar at its left, the avatars
   joined by the thread's line; the last part is a reply box under them */
const commentthreadGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, row = H / n, r = Math.min(row * 0.3, W * 0.05), cx = W * 0.07,
        m = Math.min(0.03, row * 0.1), secs: PointSection[] = []
    for (let i = 0; i + 1 < n; i++) secs.push({pts: arcPts(cx, H - row * (i + 0.5), r, r, 0, 360, 20)})
    if (n > 2) secs.push({noFill: 1, pts: linePts([cx, H - row * 0.5 - r, cx, H - row * (n - 1.5) + r])})
    return absGeo([...secs, {noFill: 1, pts: boxPts(W * 0.14, m, W, row - m)}])
}

/* A notification bell: a bell, and a badge at its top right holding the label (the count, "3"); no badge when the
   label is empty. Sized from the height, like the checkbox; the text block sits on the badge. */
const bellGeo: GeoFn = (W, H, label) => squareGeo(
    {
        noFill: 1,
        pts: [[0.12, 0.22], [0.22, 0.34], [0.22, 0.52], ...arcPts(0.45, 0.52, 0.23, 0.23, 180, 0, 12), [0.68, 0.34], [0.78, 0.22], [0.12, 0.22]]
    },
    {noFill: 1, pts: arcPts(0.45, 0.22, 0.07, 0.07, 180, 360, 8)},
    {noFill: 1, pts: arcPts(0.45, 0.79, 0.04, 0.04, 0, 360, 10)},
    ...(String(label ?? '').trim() ? [{pts: arcPts(0.74, 0.72, 0.22, 0.22, 0, 360, 24)}] : []))(W, H)

/* An open user menu: the button (the label's first part, the user's name) with an avatar at its left and its chevron
   turned up, and under it the menu, the rest of the parts, on a card with the first one lit */
const usermenuGeo: GeoFn = (W, H, label, _values, attrs) => {
    const n = segmentsOf(label).length, s = H / n, g = Math.min(0.03, s * 0.1), cy = H - s / 2,
        c = Math.min(0.03, s * 0.12), r = Math.min(s * 0.35, W * 0.08)
    return absGeo([{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, pts: boxPts(0, H - s + g, W, H)},
        {series: 0, shade: 0.3, pts: arcPts(0.04 + r, cy, r, r, 0, 360, 20)},
        {noFill: 1, pts: [[W - 0.2, cy - c / 2], [W - 0.15, cy + c / 2], [W - 0.1, cy - c / 2]]},
        ...menuCard(W, 0, H - s - g, Math.max(1, n - 1))])
}

/* A tablet: a rounded body, the screen inset by an even bezel, and a camera dot in the middle of the top bezel */
const tabletGeo: GeoFn = (W, H) => {
    const m = Math.min(0.14, W * 0.07, H * 0.07), r = Math.min(0.12, m * 1.2), d = m * 0.15
    return absGeo([{pts: roundedBox(W, H, r)}, {noFill: 1, pts: boxPts(m, m, W - m, H - m)},
        {noFill: 1, pts: arcPts(W / 2, H - m / 2, d, d, 0, 360, 10)}])
}

/* A smartwatch: a rounded face with its screen inset, a strap above and below, and the crown on its right side. The
   label (the time) sits on the face. */
const smartwatchGeo: GeoFn = (W, H) => {
    const c = Math.min(0.06, W * 0.06), fw = W - c, fh = Math.min(fw * 1.15, H * 0.6), y0 = (H - fh) / 2,
        s = fw * 0.16, r = fw * 0.22, m = fw * 0.08
    return absGeo([{noFill: 1, pts: [[s, y0], [s, 0], [fw - s, 0], [fw - s, y0]]},
        {noFill: 1, pts: [[s, y0 + fh], [s, H], [fw - s, H], [fw - s, y0 + fh]]},
        {pts: roundedBox(fw, fh, r).map(([x, y]): Point => [x, y + y0])},
        {noFill: 1, pts: roundedBox(fw - 2 * m, fh - 2 * m, r * 0.7).map(([x, y]): Point => [x + m, y + y0 + m])},
        {noFill: 1, pts: boxPts(fw, H / 2 - fh * 0.1, W, H / 2 + fh * 0.1)}])
}

/* A desktop app window: a title bar along the top, the title (the label) at its left and minimise, maximise and close
   buttons at its right, as on Windows */
const appwindowGeo: GeoFn = (W, H) => {
    const b = Math.min(0.3, H * 0.18), y = H - b / 2, k = b * 0.17, x = (i: number) => W - b * 1.5 * (i + 0.5)
    return absGeo([{pts: boxPts(0, 0, W, H)}, {noFill: 1, pts: linePts([0, H - b, W, H - b])},
        {noFill: 1, pts: linePts([x(0) - k, y - k, x(0) + k, y + k], [x(0) - k, y + k, x(0) + k, y - k])},
        {noFill: 1, pts: boxPts(x(1) - k, y - k, x(1) + k, y + k)},
        {noFill: 1, pts: linePts([x(2) - k, y, x(2) + k, y])}])
}

/* ---- maps (the app screen, not the data maps in charts.ts) and robot checks ---- */

/* A map pin: a teardrop, round head of radius r at (cx, cy) and its point straight under it, with a white dot in the
   head. series picks its colour: the shape's own fill (0) for a pin on its own, the error red (3) on a map. */
const pinSecs = (cx: number, cy: number, r: number, series: number): PointSection[] => {
    const head = arcPts(cx, cy, r, r, -50, 230, 20), d = r * 0.38
    return [{series, pts: [...head, [r4(cx), r4(cy - 2.3 * r)], head[0]]},
        {series, shade: 0, pts: arcPts(cx, cy, d, d, 0, 360, 12)}]
}

/* An arrow going round anticlockwise from a0 to a1 degrees, with its head at a1: a refresh button's */
const refreshSecs = (cx: number, cy: number, r: number, a0 = 40, a1 = 320, series?: number): PointSection[] => {
    const t = a1 * Math.PI / 180, ex = cx + r * Math.cos(t), ey = cy + r * Math.sin(t), h = r * 0.55,
        // the head's two barbs point back along the arc's direction at its end, (-sin, cos), turned 35° either way
        barb = (k: number): Point => {
            const a = t + Math.PI / 2 + Math.PI + k * 35 * Math.PI / 180
            return [r4(ex + h * Math.cos(a)), r4(ey + h * Math.sin(a))]
        }
    return [{noFill: 1, series, pts: arcPts(cx, cy, r, r, a0, a1, 16)},
        {noFill: 1, series, pts: [barb(-1), [r4(ex), r4(ey)], barb(1)]}]
}

/* The parts every map screen has: a search box along the top (MAP_BAR inches deep, the label in it), +/- zoom
   buttons in the bottom right corner and a pin in the middle. White is shade 0 of the fill, the pin the error red. */
const MAP_BAR = 0.3, MAP_M = 0.08
const mapChrome = (W: number, H: number): PointSection[] => {
    const b = Math.min(MAP_BAR, H * 0.16), x1 = W * 0.56, y0 = H - MAP_M - b, g = b * 0.22,
        gx = MAP_M + b / 2, gy = y0 + b / 2, z = Math.min(0.24, W * 0.09, H * 0.12), zx = W - MAP_M - z,
        k = z * 0.28, r = Math.min(0.1, W * 0.04, H * 0.06)
    return [{series: 0, shade: 0, pts: roundedBox(x1 - MAP_M, b, b * 0.2).map(([x, y]): Point => [x + MAP_M, y + y0])},
        {noFill: 1, pts: arcPts(gx - g * 0.2, gy + g * 0.2, g * 0.7, g * 0.7, 0, 360, 14)},
        {noFill: 1, pts: linePts([gx + g * 0.3, gy - g * 0.3, gx + g, gy - g])},
        {series: 0, shade: 0, pts: boxPts(zx, MAP_M, zx + z, MAP_M + 2 * z)},
        {
            noFill: 1,
            pts: linePts([zx, MAP_M + z, zx + z, MAP_M + z], [zx + z / 2 - k, MAP_M + 1.5 * z, zx + z / 2 + k, MAP_M + 1.5 * z],
                [zx + z / 2, MAP_M + 1.5 * z - k, zx + z / 2, MAP_M + 1.5 * z + k], [zx + z / 2 - k, MAP_M + z / 2, zx + z / 2 + k, MAP_M + z / 2])
        },
        ...pinSecs(W * 0.47, H * 0.42 + 2.3 * r, r, 3)]
}

/* A river: a band across the shape, wavy on both edges, its middle at y */
const riverPts = (W: number, y: number, t: number, amp: number): Point[] => {
    const top = wavePts(0, W, y + t / 2, amp, 24)
    return [...top, ...wavePts(0, W, y - t / 2, amp, 24).reverse(), top[0]]
}

/* A map view: city blocks in the fill with white streets between them (the gaps), one wider main road, a park in
   green and a river in blue across the lower part, then the search box, zoom buttons and a pin. The cuts are
   fractions of the size, so the streets stay where they are as it grows. */
const MAP_COLS = [0, 0.2, 0.47, 0.53, 0.76, 1], MAP_ROWS = [0, 0.36, 0.64, 1]
const mapviewGeo: GeoFn = (W, H) => {
    const g = Math.min(0.035, W * 0.012, H * 0.016), blocks: PointSection[] = []
    for (let i = 0; i + 1 < MAP_COLS.length; i++) {
        if (i === 2) continue                                        // the main road, between .47 and .53
        for (let j = 0; j + 1 < MAP_ROWS.length; j++) blocks.push({
            series: i === 0 && j === 1 ? 4 : 0, shade: i === 0 && j === 1 ? 0.45 : 1,   // the park, at the left
            pts: boxPts(W * MAP_COLS[i] + (i ? g : 0), H * MAP_ROWS[j] + (j ? g : 0),
                W * MAP_COLS[i + 1] - (i + 2 < MAP_COLS.length ? g : 0), H * MAP_ROWS[j + 1] - (j + 2 < MAP_ROWS.length ? g : 0))
        })
    }
    return absGeo([{series: 0, shade: 0, pts: boxPts(0, 0, W, H)}, ...blocks,
        {series: 2, shade: 0.45, pts: riverPts(W, H * 0.2, Math.min(0.14, H * 0.08), Math.min(0.06, H * 0.03))},
        ...mapChrome(W, H), {noFill: 1, pts: boxPts(0, 0, W, H)}])
}

/* A satellite view: dark ground in the fill, fields and roofs as paler and greener patches of it, roads as pale
   lines over them, and a small tile in the bottom left that switches back to the map. Same search box, zoom and pin. */
const SAT_PATCHES: [x0: number, y0: number, x1: number, y1: number, series: number, shade: number][] = [
    [0.04, 0.5, 0.3, 0.78, 4, 0.75], [0.33, 0.55, 0.45, 0.8, 0, 0.7], [0.6, 0.48, 0.92, 0.78, 1, 0.45],
    [0.04, 0.06, 0.26, 0.38, 1, 0.35], [0.5, 0.06, 0.7, 0.36, 4, 0.6], [0.74, 0.12, 0.86, 0.32, 0, 0.6]]
const satelliteGeo: GeoFn = (W, H) => {
    const t = Math.min(0.42, W * 0.14, H * 0.2), road = {series: 0, shade: 0.2, noFill: 1}
    return absGeo([{pts: boxPts(0, 0, W, H)},
        ...SAT_PATCHES.map(([x0, y0, x1, y1, series, shade]): PointSection => ({
            series,
            shade,
            pts: [[W * x0, H * y0], [W * x1, H * (y0 + 0.02)], [W * (x1 - 0.01), H * y1], [W * (x0 + 0.02), H * (y1 - 0.02)], [W * x0, H * y0]]
        })),
        {...road, pts: wavePts(0, W, H * 0.43, H * 0.04, 24)},
        {...road, pts: linePts([W * 0.48, 0, W * 0.56, H * 0.85])},
        {series: 2, shade: 0.7, pts: riverPts(W, H * 0.03, Math.min(0.08, H * 0.05), Math.min(0.03, H * 0.015))},
        ...mapChrome(W, H),
        {series: 0, shade: 0, pts: boxPts(MAP_M, MAP_M, MAP_M + t, MAP_M + t)},
        {series: 0, shade: 0.35, pts: boxPts(MAP_M + t * 0.12, MAP_M + t * 0.12, MAP_M + t * 0.88, MAP_M + t * 0.88)},
        {
            series: 0, shade: 0, noFill: 1,
            pts: linePts([MAP_M + t * 0.12, MAP_M + t * 0.5, MAP_M + t * 0.88, MAP_M + t * 0.5], [MAP_M + t * 0.4, MAP_M + t * 0.12, MAP_M + t * 0.6, MAP_M + t * 0.88])
        }])
}

/* Street view: sky over a road that runs away to a point on the horizon, pavements either side and a wall of
   buildings along each, split into fronts; dashes down the middle of the road and a white arrow to move along it.
   The street name (the label) is on a white card in the top left, a mini map in the bottom left and a compass with
   its red north in the bottom right. The fill is the road's grey; everything else is a tint of it or a series colour. */
const STREET_HY = 0.55, STREET_FRONTS = [0.33, 0.62]
const streetviewGeo: GeoFn = (W, H) => {
    const hy = H * STREET_HY, cx = W / 2, top = H * 0.95, far = hy + H * 0.12,
        // a wall from the near edge (x = 0, or W) to the far one (.42 or .58 of the way across); k is how far along
        wall = (k: number, right: boolean): [number, number, number] => {
            const x = W * 0.42 * k
            return [right ? W - x : x, hy * k, top + (far - top) * k]
        },
        walls = (right: boolean): PointSection[] => {
            const [nx, nb, nt] = wall(0, right), [fx, fb, ft] = wall(1, right)
            return [{series: 1, shade: right ? 0.25 : 0.35, pts: [[nx, nb], [fx, fb], [fx, ft], [nx, nt], [nx, nb]]},
                {
                    noFill: 1, pts: linePts(...STREET_FRONTS.map((k): [number, number, number, number] => {
                        const [x, b, t] = wall(k, right)
                        return [x, b, x, t]
                    }))
                }]
        },
        dash = (k0: number, k1: number): Point[] => {             // a dash from k0 to k1 of the way to the horizon
            const w0 = W * 0.012 * (1 - k0), w1 = W * 0.012 * (1 - k1)
            return [[cx - w0, hy * k0], [cx + w0, hy * k0], [cx + w1, hy * k1], [cx - w1, hy * k1], [cx - w0, hy * k0]]
        },
        a = Math.min(0.16, W * 0.06), ay = H * 0.08, at = a * 0.35,
        b = Math.min(0.28, H * 0.15),
        card = roundedBox(W * 0.45 - MAP_M, b, b * 0.2).map(([x, y]): Point => [x + MAP_M, y + H - MAP_M - b]),
        mw = Math.min(0.6, W * 0.2), mh = Math.min(0.42, H * 0.2), r = Math.min(0.14, H * 0.08),
        ox = W - MAP_M - r, oy = MAP_M + r
    return absGeo([{series: 2, shade: 0.25, pts: boxPts(0, hy, W, H)},
        {series: 0, shade: 0.5, pts: [[0, 0], [W, 0], [W * 0.58, hy], [W * 0.42, hy], [0, 0]]},
        {pts: [[W * 0.12, 0], [W * 0.88, 0], [W * 0.53, hy], [W * 0.47, hy], [W * 0.12, 0]]},
        ...walls(false), ...walls(true),
        ...[[0.3, 0.42], [0.52, 0.6], [0.68, 0.73], [0.79, 0.82]].map(([k0, k1]): PointSection => ({
            series: 0,
            shade: 0,
            pts: dash(k0, k1)
        })),
        {
            series: 0, shade: 0,
            pts: [[cx - a, ay], [cx, ay + a * 0.6], [cx + a, ay], [cx + a, ay + at], [cx, ay + a * 0.6 + at], [cx - a, ay + at], [cx - a, ay]]
        },
        {series: 0, shade: 0, pts: card},
        {series: 0, shade: 0, pts: boxPts(MAP_M, MAP_M, MAP_M + mw, MAP_M + mh)},
        {
            series: 0,
            shade: 0.35,
            noFill: 1,
            pts: linePts([MAP_M, MAP_M + mh * 0.4, MAP_M + mw, MAP_M + mh * 0.55], [MAP_M + mw * 0.6, MAP_M, MAP_M + mw * 0.45, MAP_M + mh])
        },
        {series: 2, pts: arcPts(MAP_M + mw * 0.52, MAP_M + mh * 0.47, mh * 0.09, mh * 0.09, 0, 360, 12)},
        {series: 0, shade: 0, pts: arcPts(ox, oy, r, r, 0, 360, 24)},
        {series: 3, pts: [[ox - r * 0.3, oy], [ox, oy + r * 0.8], [ox + r * 0.3, oy], [ox - r * 0.3, oy]]},
        {pts: [[ox - r * 0.3, oy], [ox, oy - r * 0.8], [ox + r * 0.3, oy], [ox - r * 0.3, oy]]},
        {noFill: 1, pts: boxPts(0, 0, W, H)}])
}

/* A map pin on its own, to drop on any map: the teardrop as big as the shape allows, its point at the bottom middle */
const mappinGeo: GeoFn = (W, H) => {
    const r = Math.min(W / 2, H / 3.3)
    return absGeo(pinSecs(W / 2, H - r, r, 0))
}

/* A directions panel: a row per part of the label. The first two are where from (a ring) and where to (a pin),
   joined by dots; every one after is a step, with an arrow that turns the way its text says (left, right) or goes
   straight on. */
const directionsGeo = rowsGeo((i, y0, y1, _W, _H, part) => {
    const s = Math.min(0.09, (y1 - y0) * 0.3), x = 0.17, y = (y0 + y1) / 2, step = String(part || '').toLowerCase()
    if (i === 0) return [{noFill: 1, pts: arcPts(x, y, s * 0.7, s * 0.7, 0, 360, 16)},
        ...[1, 2, 3].map((k): PointSection => ({pts: arcPts(x, y0 + (y1 - y0) * (0.5 - k * 0.25), s * 0.12, s * 0.12, 0, 360, 8)}))]
    if (i === 1) return pinSecs(x, y + s * 0.4, s * 0.55, 3)
    const turn = /\bleft\b/.test(step) ? -1 : /\bright\b/.test(step) ? 1 : 0, h = s * 0.45
    if (!turn) return [{noFill: 1, pts: linePts([x, y - s, x, y + s])}, {
        noFill: 1,
        pts: [[x - h, y + s - h], [x, y + s], [x + h, y + s - h]]
    }]
    const ex = x + turn * s
    return [{noFill: 1, pts: [[x - turn * s * 0.3, y - s], [x - turn * s * 0.3, y + s * 0.3], [ex, y + s * 0.3]]},
        {noFill: 1, pts: [[ex - turn * h, y + s * 0.3 + h], [ex, y + s * 0.3], [ex - turn * h, y + s * 0.3 - h]]}]
})

/* A robot check: a pale panel with a white box to tick at its left, ticked in green when on ([state=on]), the label
   ("I'm not a robot") beside it, and a round arrow logo in blue at its right */
const captchaGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const s = Math.min(0.32, H * 0.48), x = 0.15, y = (H - s) / 2, r = Math.min(0.13, H * 0.2)
    return absGeo([{pts: boxPts(0, 0, W, H)}, {series: 0, shade: 0, pts: boxPts(x, y, x + s, y + s)},
        ...(attrs?.state === 'on' ? [{
            series: 4, noFill: 1,
            pts: [[x + s * 0.2, y + s * 0.5], [x + s * 0.42, y + s * 0.25], [x + s * 0.82, y + s * 0.78]] as Point[]
        }] : []),
        ...refreshSecs(W - 0.3, H * 0.58, r, 100, 400, 2)])
}

/* A picture check: a band along the top in the fill with the instruction (the label) in white, a 3 by 3 grid of
   picture tiles, two of them picked (drawn smaller, with a tick badge), and a refresh arrow and a Verify button
   along the bottom */
const CAPTCHA_PICKED = [2, 4]
const imagecaptchaGeo: GeoFn = (W, H) => {
    const hb = Math.min(0.6, H * 0.22), fb = Math.min(0.45, H * 0.16), m = 0.08, g = 0.04,
        tw = (W - 2 * m - 2 * g) / 3, th = (H - hb - fb - m - 2 * g) / 3, bw = Math.min(0.8, W * 0.3), bh = fb * 0.62,
        tiles = Array.from({length: 9}, (_, i): PointSection[] => {
            const x0 = m + (i % 3) * (tw + g), y1 = H - hb - m / 2 - Math.floor(i / 3) * (th + g), y0 = y1 - th,
                p = CAPTCHA_PICKED.includes(i) ? Math.min(tw, th) * 0.1 : 0, br = Math.min(tw, th) * 0.12
            return [{series: 0, shade: p ? 0.35 : 0.18, pts: boxPts(x0 + p, y0 + p, x0 + tw - p, y1 - p)},
                ...(p ? [{series: 0, pts: arcPts(x0 + br, y1 - br, br, br, 0, 360, 14)}, {
                    series: 0, shade: 0, noFill: 1,
                    pts: [[x0 + br * 0.5, y1 - br], [x0 + br * 0.9, y1 - br * 1.4], [x0 + br * 1.5, y1 - br * 0.6]] as Point[]
                }] : [])]
        }).flat()
    return absGeo([{series: 0, shade: 0, pts: boxPts(0, 0, W, H)}, {pts: boxPts(0, H - hb, W, H)}, ...tiles,
        {noFill: 1, pts: linePts([0, fb, W, fb])}, ...refreshSecs(m + fb * 0.4, fb / 2, fb * 0.22),
        {pts: roundedBox(bw, bh, bh * 0.2).map(([x, y]): Point => [x + W - m - bw, y + (fb - bh) / 2])}])
}

/* A text check: a white panel with the code (the label) under two squiggly lines that make it hard for a machine to
   read, a refresh arrow beside it, and a white box under it to type the code into */
const textcaptchaGeo: GeoFn = (W, H) => {
    const m = 0.08, py = H * 0.45, px = W - 0.5, r = Math.min(0.11, H * 0.1)
    return absGeo([{pts: boxPts(0, 0, W, H)}, {series: 0, shade: 0, pts: boxPts(m, py, px, H - m)},
        {noFill: 1, pts: wavePts(m, px, py + (H - m - py) * 0.38, (H - m - py) * 0.12, 20)},
        {noFill: 1, pts: wavePts(m, px, py + (H - m - py) * 0.64, (H - m - py) * 0.1, 14)},
        ...refreshSecs((px + W) / 2, (py + H - m) / 2, r),
        {series: 0, shade: 0, pts: boxPts(m, m, W - m, py - m)}])
}

export const wireframeShapes = {

    browser: {
        w: 3, h: 2, text: 'Page content', txt: {y: 0.42, h: 0.84},
        geo: fracGeo({pts: RECT}, {noFill: 1, pts: linePts([0, 0.85, 1, 0.85])}, {pts: boxPts(0.2, 0.88, 0.96, 0.97)}),
        palette: {
            label: 'Browser',
            icon: '<path d="M4 4H40V24H4Z"/><path d="M4 9H40"/><path d="M14 5.5H37V7.5H14Z"/>'
        }
    },

    mobile: {
        w: 1, h: 1.9, text: 'Screen', geo: fracGeo({pts: RECT}, {
            noFill: 1, pts: [
                ...boxPts(0.07, 0.08, 0.93, 0.92).map((q, i): Point => i ? q : [q[0], q[1], 'MoveTo']),
                ...linePts([0.38, 0.96, 0.62, 0.96])]
        }),
        palette: {
            label: 'Mobile screen',
            icon: '<path d="M15 2H29V26H15Z"/><path d="M17 5H27V22H17Z"/>'
        }
    },

    tablet: {
        w: 2.6, h: 1.9, text: 'Screen', geo: tabletGeo,
        palette: {
            label: 'Tablet', title: 'Tablet: a screen in an even bezel, with a camera dot',
            icon: '<rect x="8" y="2" width="28" height="24" rx="2"/><path d="M11 5H33V23H11Z"/><circle cx="22" cy="3.5" r="0.6"/>'
        }
    },

    smartwatch: {
        w: 1, h: 1.5, text: '10:09', txt: {x: 0.47, w: 0.7, h: 0.3}, geo: smartwatchGeo,
        palette: {
            label: 'Smartwatch', title: 'Smartwatch: a face between two straps, the time in its label',
            icon: '<path d="M17 8V2H27V8M17 20V26H27V20"/><rect x="14" y="8" width="16" height="12" rx="3"/><path d="M30 12.5H32V15.5H30"/>'
        }
    },

    appwindow: {
        w: 3, h: 2, text: 'My app', align: 0, txt: {x: 0.27, y: 0.925, w: 0.5, h: 0.15}, geo: appwindowGeo,
        palette: {
            label: 'App window', title: 'Desktop app window: the title in its label, with minimise, maximise and close',
            icon: '<path d="M4 3H40V25H4Z"/><path d="M4 8H40M7 5.5H17M27 5.5H29M31.5 4.5H33.5V6.5H31.5ZM36 4.5 38 6.5M38 4.5 36 6.5"/>'
        }
    },

    field: {
        w: 2, h: 0.35, text: 'Text field', align: 0, geo: fracGeo({pts: RECT}),
        palette: {
            label: 'Text field',
            icon: '<path d="M4 9H40V19H4Z"/><path d="M8 11.5V16.5"/>'
        }
    },

    button: {
        w: 1.2, h: 0.4, text: 'Button', geo: roundedEnds,
        palette: {
            label: 'Button',
            icon: '<rect x="5" y="8" width="34" height="12" rx="6"/>'
        }
    },

    dropdown: {
        w: 2, h: 0.35, text: 'Select…', align: 0, txt: {x: 0.44, w: 0.88},
        geo: fracGeo({pts: RECT}, {noFill: 1, pts: [[0.9, 0.62, 'MoveTo'], [0.93, 0.38], [0.96, 0.62]]}),
        palette: {
            label: 'Dropdown',
            icon: '<path d="M4 9H40V19H4Z"/><path d="M31 12.5 33.5 15.5 36 12.5"/>'
        }
    },

    checkbox: {
        w: 1.6,
        h: 0.3,
        text: 'Checkbox',
        fill: TABLE.headerFill,
        align: 0,
        txtLeft: 0.9,
        textOnPaper: true,
        stateful: true,
        geo: checkboxGeo,
        palette: {
            label: 'Checkbox',
            icon: '<path d="M5 9H15V19H5Z"/><path d="M7.5 14 9.5 16.5 13 11M19 14H38"/>'
        }
    },

    radio: {
        w: 1.6,
        h: 0.3,
        text: 'Option',
        fill: TABLE.headerFill,
        align: 0,
        txtLeft: 0.9,
        textOnPaper: true,
        stateful: true,
        geo: radioGeo,
        palette: {
            label: 'Radio button',
            icon: '<circle cx="10" cy="14" r="5"/><path d="M19 14H38"/>'
        }
    },

    progress: {
        w: 1, h: 1, text: '75%', fill: TABLE.headerFill, txt: {w: 0.64, h: 0.5}, textOnPaper: true, geo: ringGeo,
        palette: {
            label: 'Progress ring',
            icon: '<circle cx="22" cy="14" r="11"/><circle cx="22" cy="14" r="7"/><path d="M22 3A11 11 0 1 1 11 14"/>'
        }
    },

    progressbar: {
        w: 2,
        h: 0.3,
        text: '60%',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.9, w: 0.2},
        textOnPaper: true,
        geo: barGeo,
        palette: {
            label: 'Progress bar',
            icon: '<path d="M4 10H40V18H4Z"/><path d="M4 10H26V18H4Z"/>'
        }
    },

    switch: {
        w: 1.6,
        h: 0.3,
        text: 'Switch',
        fill: TABLE.headerFill,
        align: 0,
        txtLeft: 2.1,
        textOnPaper: true,
        stateful: true,
        geo: switchGeo,
        palette: {
            label: 'Switch', title: 'Switch (turn it on or off in the properties)',
            icon: '<rect x="4" y="8" width="22" height="12" rx="6"/><circle cx="20" cy="14" r="4"/><path d="M30 14H40"/>'
        }
    },

    slider: {
        w: 2,
        h: 0.3,
        text: '40%',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.9, w: 0.2},
        textOnPaper: true,
        geo: sliderGeo,
        palette: {
            label: 'Slider', title: 'Slider: set to the percentage in its label',
            icon: '<path d="M4 13H34V15H4Z"/><circle cx="16" cy="14" r="4"/><path d="M37 14H42"/>'
        }
    },

    password: {
        w: 2, h: 0.35, text: '••••••••', align: 0, txt: {x: 0.44, w: 0.8}, geo: passwordGeo,
        palette: {
            label: 'Password', title: 'Password field: hidden text and a show / hide eye',
            icon: '<path d="M3 8H41V20H3Z"/><path d="M8 14H8.5M11 14H11.5M14 14H14.5M17 14H17.5M29 14C31 11 35 11 37 14C35 17 31 17 29 14Z"/><circle cx="33" cy="14" r="1"/>'
        }
    },

    numberinput: {
        w: 1.4, h: 0.35, text: '1', geo: numberGeo,
        palette: {
            label: 'Number input', title: 'Number input: the number between − and + buttons',
            icon: '<path d="M6 8H38V20H6Z"/><path d="M14 8V20M30 8V20M8 14H12M32 14H36M34 12V16M21 12V16"/>'
        }
    },

    segmented: {
        w: 2.4,
        h: 0.35,
        text: 'Day | Week | Month',
        fill: GRID.headerFill,
        textOnPaper: true,
        segments: 'row',
        geo: segmentedGeo,
        palette: {
            label: 'Segmented',
            title: 'Segmented control / button group: options in the label, separated by |, the first chosen',
            icon: '<path d="M3 8H41V20H3Z"/><path d="M3 8H16V20H3Z"/><path d="M16 8V20M28 8V20"/>'
        }
    },

    search: {
        w: 2, h: 0.35, text: 'Search…', align: 0, txtLeft: 0.95, geo: searchGeo,
        palette: {
            label: 'Search box',
            icon: '<path d="M3 8H41V20H3Z"/><circle cx="10" cy="13" r="3"/><path d="M12 15 15 18M18 14H34"/>'
        }
    },

    textarea: {
        w: 2, h: 1, text: 'Write a message…', align: 0, txt: {y: 0.8, w: 0.94, h: 0.3}, geo: textareaGeo,
        palette: {
            label: 'Text area', title: 'Text area: a box for several lines',
            icon: '<path d="M4 3H40V25H4Z"/><path d="M8 8H34M8 13H30M35 24 39 20M37 24 39 22"/>'
        }
    },

    datepicker: {
        w: 2, h: 0.35, text: 'dd/mm/yyyy', align: 0, txt: {x: 0.42, w: 0.8}, geo: datepickerGeo,
        palette: {
            label: 'Date picker',
            icon: '<path d="M3 8H41V20H3Z"/><path d="M8 14H22M31 11H38V18H31ZM31 13H38"/>'
        }
    },

    timepicker: {
        w: 2, h: 0.35, text: 'hh:mm', align: 0, txt: {x: 0.42, w: 0.8}, geo: timepickerGeo,
        palette: {
            label: 'Time picker',
            icon: '<path d="M3 8H41V20H3Z"/><path d="M8 14H22"/><circle cx="34" cy="14" r="4"/><path d="M32 13 34 14 36 12.5"/>'
        }
    },

    colourpicker: {
        w: 2,
        h: 0.35,
        text: '#1F6F78',
        fill: TABLE.headerFill,
        align: 0,
        txtLeft: 1.05,
        textOnPaper: true,
        geo: colourpickerGeo,
        palette: {
            label: 'Colour picker', title: 'Colour picker: a swatch in the fill, the colour named in the label',
            icon: '<path d="M3 8H41V20H3Z"/><path d="M6 10.5H13V17.5H6Z"/><path d="M17 14H28M33 12.5 35 15 37 12.5"/>'
        }
    },

    upload: {
        w: 2.4, h: 1.2, text: 'Drop files here or browse', txt: {y: 0.28, w: 0.9, h: 0.3}, textOnPaper: true,
        geo: uploadGeo,
        palette: {
            label: 'File upload', title: 'File upload / drop zone',
            icon: '<path d="M4 3H8M12 3H16M20 3H24M28 3H32M36 3H40V7M40 11V15M40 19V25H36M32 25H28M24 25H20M16 25H12M8 25H4V21M4 17V13M4 9V3"/><path d="M22 17V8M19 11 22 8 25 11M17 15V18H27V15"/>'
        }
    },

    otp: {
        w: 2.4, h: 0.45, text: '4 | 7 | 1 | 9 | 2 | 6', textOnPaper: true, segments: 'row', geo: otpGeo,
        palette: {
            label: 'Code boxes', title: 'One-time code: a box per character, separated by | in the label',
            icon: '<path d="M3 8H9V20H3ZM11 8H17V20H11ZM19 8H25V20H19ZM27 8H33V20H27ZM35 8H41V20H35Z"/>'
        }
    },

    togglechips: {
        w: 2.6,
        h: 0.32,
        text: '✓ Wi-Fi | ✓ Parking | Pool',
        fill: GRID.headerFill,
        textOnPaper: true,
        segments: 'row',
        geo: togglechipsGeo,
        palette: {
            label: 'Toggle chips',
            title: 'Toggle chips: options in the label, separated by |; start one with ✓ to turn it on',
            icon: '<path d="M7 9H11A5 5 0 0 1 11 19H7A5 5 0 0 1 7 9ZM20 9H24A5 5 0 0 1 24 19H20A5 5 0 0 1 20 9ZM33 9H37A5 5 0 0 1 37 19H33A5 5 0 0 1 33 9Z"/><path d="M6.5 14 8.5 16 12 12M19.5 14 21.5 16 25 12"/>'
        }
    },

    rangeslider: {
        w: 2,
        h: 0.3,
        text: '20–70%',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.78, w: 0.44},
        textOnPaper: true,
        geo: rangesliderGeo,
        palette: {
            label: 'Range slider', title: 'Range slider: two handles, at the percentages in its label (20–70%)',
            icon: '<path d="M4 13H32V15H4Z"/><path d="M11 13H24V15H11Z"/><circle cx="11" cy="14" r="3.5"/><circle cx="24" cy="14" r="3.5"/><path d="M35 14H42"/>'
        }
    },

    formfield: {
        w: 2.4,
        h: 0.9,
        text: 'Email | name@example.com | Enter a valid email address',
        align: 0,
        txt: {x: 0.5, w: 0.96},
        textOnPaper: true,
        segments: 'column',
        geo: formfieldGeo,
        palette: {
            label: 'Form field', title: "Form field: its name, what's typed and a message, separated by |",
            icon: '<path d="M4 4H20"/><path d="M4 10H40V18H4Z"/><path d="M7 14H24M4 23H32"/>'
        }
    },

    spinner: {
        w: 0.5, h: 0.5, fill: TABLE.headerFill, geo: spinnerGeo,
        palette: {
            label: 'Spinner', title: 'Spinner / loader',
            icon: '<circle cx="22" cy="5" r="2.2"/><circle cx="28.4" cy="7.6" r="2"/><circle cx="31" cy="14" r="1.8"/><circle cx="28.4" cy="20.4" r="1.6"/><circle cx="22" cy="23" r="1.4"/><circle cx="15.6" cy="20.4" r="1.2"/><circle cx="13" cy="14" r="1"/><circle cx="15.6" cy="7.6" r="0.8"/>'
        }
    },

    skeleton: {
        w: 2.4, h: 0.8, fill: GRID.headerFill, geo: skeletonGeo,
        palette: {
            label: 'Skeleton', title: 'Skeleton loader: grey blocks where content will be',
            icon: '<circle cx="9" cy="10" r="5"/><path d="M18 7H40V10H18ZM18 13H36V16H18ZM18 19H30V22H18Z"/>'
        }
    },

    toast: {
        w: 2.6,
        h: 0.45,
        text: 'Message sent',
        fill: TABLE.headerFill,
        align: 0,
        txtLeft: 0.85,
        textOnPaper: true,
        geo: toastGeo,
        palette: {
            label: 'Toast', title: 'Toast notification: a message with a tick and a close cross',
            icon: '<path d="M5 8H39V20H5Z"/><path d="M7 20V22H41V10H39"/><circle cx="10" cy="14" r="3"/><path d="M16 14H30M33 12 36 16M36 12 33 16"/>'
        }
    },

    emptystate: {
        w: 2.4, h: 1.6, text: 'Nothing here yet', txt: {y: 0.43, w: 0.9, h: 0.2}, textOnPaper: true, geo: emptystateGeo,
        palette: {
            label: 'Empty state', title: 'Empty state: a picture, the message and a button',
            icon: '<path d="M3 2H41V26H3Z"/><path d="M17 9 19 5H25L27 9V12H17ZM17 9H20L21 10H23L24 9H27"/><path d="M14 16H30M18 19H26V23H18Z"/>'
        }
    },

    inlineerror: {
        w: 2.2,
        h: 0.3,
        text: 'Enter a valid email address',
        fill: ERROR,
        textColour: ERROR,
        align: 0,
        txtLeft: 0.9,
        textOnPaper: true,
        geo: inlineerrorGeo,
        palette: {
            label: 'Inline error', title: 'Inline error: a message in the error colour with a mark before it',
            icon: '<circle cx="9" cy="14" r="5"/><path d="M9 11V14.5M9 16.5V17M17 14H38"/>'
        }
    },

    dropdownmenu: {
        w: 2,
        h: 1.4,
        text: 'Sort by | Newest | Oldest | Most popular',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.5, w: 0.9},
        textOnPaper: true,
        segments: 'column',
        bg: true,
        geo: dropdownmenuGeo,
        palette: {
            label: 'Open dropdown',
            title: 'Open dropdown menu: the field, then the options, in the label separated by |; the first option lit',
            icon: '<path d="M6 2H38V8H6Z"/><path d="M31 6 33 4 35 6"/><path d="M6 10H38V26H6Z"/><path d="M6 10H38V15H6Z"/><path d="M10 12.5H26M10 18H24M10 22.5H22"/>'
        }
    },

    contextmenu: {
        w: 1.6,
        h: 1.2,
        text: 'Cut | Copy | Paste | Delete',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.5, w: 0.84},
        textOnPaper: true,
        segments: 'column',
        geo: contextmenuGeo,
        palette: {
            label: 'Context menu',
            title: 'Context menu: commands in the label, separated by |; the first lit, a line above the last',
            icon: '<path d="M10 2H34V26H10Z"/><path d="M10 2H34V8H10Z"/><path d="M14 5H26M14 11H28M14 15H24M10 19H34M14 22.5H22"/>'
        }
    },

    menubar: {
        w: 3.2,
        h: 0.3,
        text: 'File | Edit | View | Help',
        fill: TABLE.headerFill,
        txt: MENUBAR_TXT,
        textOnPaper: true,
        segments: 'row',
        bg: true,
        geo: menubarGeo,
        palette: {
            label: 'Menu bar', title: 'Menu bar: menus in the label, separated by |, the first open',
            icon: '<path d="M2 9H42V19H2Z"/><path d="M3 10H11V18H3Z"/><path d="M5 14H9M14 14H19M22 14H27M30 14H35"/>'
        }
    },

    tabbar: {
        w: 3,
        h: 0.65,
        text: 'Home | Search | Profile',
        fill: TABLE.headerFill,
        txt: {y: 0.22, h: 0.36},
        textOnPaper: true,
        segments: 'row',
        bg: true,
        geo: tabbarGeo,
        palette: {
            label: 'Bottom tab bar',
            title: 'Bottom tab bar (mobile): tabs in the label, separated by |, the first open',
            icon: '<path d="M3 4H41V24H3Z"/><circle cx="10" cy="11" r="3"/><circle cx="22" cy="11" r="3"/><circle cx="34" cy="11" r="3"/><path d="M7 19H13M19 19H25M31 19H37"/>'
        }
    },

    fab: {
        w: 0.6, h: 0.6, fill: TABLE.headerFill, geo: fabGeo,
        palette: {
            label: 'Action button', title: 'Floating action button: a round + button',
            icon: '<circle cx="22" cy="14" r="10"/><path d="M22 9V19M17 14H27"/>'
        }
    },

    backheader: {
        w: 3, h: 0.5, text: 'Settings', fill: TABLE.headerFill, textOnPaper: true, bg: true, geo: backheaderGeo,
        palette: {
            label: 'Back header', title: 'Back header (mobile): a back arrow, the title and a ⋮ menu',
            icon: '<path d="M3 7H41V21H3Z"/><path d="M10 10 7 14 10 18M17 14H27"/><circle cx="37" cy="10.5" r="0.8"/><circle cx="37" cy="14" r="0.8"/><circle cx="37" cy="17.5" r="0.8"/>'
        }
    },

    divider: {
        w: 3, h: 0.25, text: 'or', textOnPaper: true, geo: dividerGeo,
        palette: {
            label: 'Divider', title: 'Divider: a line across, broken for its label ("or") if it has one',
            icon: '<path d="M3 14H17M27 14H41"/><path d="M20 12 22 16M24 12 22 16"/>'
        }
    },

    footer: {
        w: 4,
        h: 0.45,
        text: '© Acme | Privacy | Terms | Contact',
        fill: GRID.headerFill,
        segments: 'row',
        geo: fracGeo({pts: RECT}),
        palette: {
            label: 'Footer', title: 'Page footer: its parts in the label, separated by |',
            icon: '<path d="M2 8H42V20H2Z"/><path d="M5 14H14M19 14H24M28 14H33M36 14H40"/>'
        }
    },

    hero: {
        w: 4,
        h: 2,
        text: 'A big headline\nWhy it matters',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.29, y: 0.62, w: 0.52, h: 0.5},
        textOnPaper: true,
        bg: true,
        geo: heroGeo,
        palette: {
            label: 'Hero section', title: 'Hero section: a headline, a button and a picture',
            icon: '<path d="M2 3H42V25H2Z"/><path d="M26 6H39V22H26ZM26 6 39 22M39 6 26 22M5 9H21M5 13H18"/><rect x="5" y="17" width="10" height="4" rx="2"/>'
        }
    },

    splitpane: {
        w: 3.2,
        h: 1.6,
        text: 'Files | Preview',
        fill: TABLE.headerFill,
        textOnPaper: true,
        segments: 'row',
        bg: true,
        geo: splitpaneGeo,
        palette: {
            label: 'Split pane', title: 'Split pane: two panes, named in the label separated by |, with a grip between',
            icon: '<path d="M3 3H41V25H3Z"/><path d="M22 3V25"/><rect x="20.5" y="11" width="3" height="6" rx="1.5"/>'
        }
    },

    scrollbar: {
        w: 0.18, h: 2, fill: TABLE.headerFill, geo: scrollbarGeo,
        palette: {
            label: 'Scroll bar', title: 'Scroll bar: down when it is taller than wide, across when wider',
            icon: '<path d="M19 2H25V26H19Z"/><path d="M19 6H25M19 22H25M22 3 20.5 5H23.5ZM22 25 20.5 23H23.5Z"/><path d="M20 8H24V14H20Z"/>'
        }
    },

    navbar: {
        w: 4,
        h: 0.45,
        text: 'Brand | Home | About | Contact',
        fill: TABLE.headerFill,
        txt: {x: 0.55, w: 0.88},
        textOnPaper: true,
        segments: 'row',
        bg: true,
        geo: navbarGeo,
        palette: {
            label: 'Nav bar', title: 'Header / nav bar: brand and links in the label, separated by |',
            icon: '<path d="M2 8H42V20H2Z"/><path d="M5 11H10V17H5ZM16 14H22M26 14H31M35 14H40"/>'
        }
    },

    modal: {
        w: 3, h: 1.8, text: 'Delete this file?\nThis can\'t be undone.', txt: {y: 0.62, w: 0.84, h: 0.5}, geo: modalGeo,
        palette: {
            label: 'Modal dialog',
            icon: '<path d="M5 2H39V26H5Z"/><path d="M33 5 36 8M36 5 33 8M11 11H29M11 15H25M21 19H28V23H21ZM30 19H37V23H30Z"/>'
        }
    },

    card: {
        w: 1.8, h: 2, text: 'Card title\nA line about it', align: 0, txt: {y: 0.24, w: 0.88, h: 0.4}, geo: cardGeo,
        palette: {
            label: 'Card', title: 'Card: a picture with text under it',
            icon: '<path d="M12 1H32V27H12Z"/><path d="M14 3H30V14H14ZM14 3 30 14M30 3 14 14M15 18H28M15 22H25"/>'
        }
    },

    alert: {
        w: 3.2,
        h: 0.45,
        text: 'Your changes have been saved.',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.56, w: 0.84},
        textOnPaper: true,
        geo: alertGeo,
        palette: {
            label: 'Alert banner',
            icon: '<path d="M2 8H42V20H2Z"/><path d="M2 8H4V20H2ZM18 14H38"/><circle cx="10" cy="14" r="3"/>'
        }
    },

    tooltip: {
        w: 1.6, h: 0.5, text: 'More about this', fill: DEF.line, txt: {y: 0.625, h: 0.75},
        geo: fracGeo({pts: [[0, 0.25], [0.44, 0.25], [0.5, 0], [0.56, 0.25], [1, 0.25], [1, 1], [0, 1], [0, 0.25]]}),
        palette: {
            label: 'Tooltip',
            icon: '<path d="M6 4H38V19H25L22 24 19 19H6Z"/><path d="M11 11H33"/>'
        }
    },

    avatar: {
        w: 0.6,
        h: 0.6,
        text: 'AB',
        fill: GRID.headerFill,
        geo: squareGeo({pts: arcPts(0.5, 0.5, 0.5, 0.5, 0, 360, 32)}),
        palette: {
            label: 'Avatar', title: 'Avatar: initials in a circle',
            icon: '<circle cx="22" cy="14" r="11"/><path d="M17 17 19 10 21 17M18 15H20M24 10V17H26.5A1.7 1.7 0 0 0 26.5 13.5H24M24 10H26A1.7 1.7 0 0 1 26 13.5"/>'
        }
    },

    badge: {
        w: 0.8, h: 0.28, text: 'New', fill: TABLE.headerFill, textColour: DEF.textOnDark, geo: roundedEnds,
        palette: {
            label: 'Badge', title: 'Badge / chip / tag',
            icon: '<path d="M14 8H30A6 6 0 0 1 30 20H14A6 6 0 0 1 14 8Z"/><path d="M16 14H28"/>'
        }
    },

    rating: {
        w: 1.6,
        h: 0.3,
        text: '4/5',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.9, w: 0.2},
        textOnPaper: true,
        geo: ratingGeo,
        palette: {
            label: 'Star rating', title: 'Star rating: from a score like 4/5 in its label',
            icon: '<path d="M8 8 9.5 12H13L10 14.5 11 18.5 8 16 5 18.5 6 14.5 3 12H6.5ZM22 8 23.5 12H27L24 14.5 25 18.5 22 16 19 18.5 20 14.5 17 12H20.5ZM36 8 37.5 12H41L38 14.5 39 18.5 36 16 33 18.5 34 14.5 31 12H34.5Z"/>'
        }
    },

    glyph: {
        w: 0.4,
        h: 0.4,
        geo: squareGeo({pts: boxPts(0, 0, 1, 1)}, {noFill: 1, pts: arcPts(0.5, 0.5, 0.25, 0.25, 0, 360, 20)},
            {noFill: 1, pts: linePts([0.32, 0.32, 0.68, 0.68])}),
        palette: {
            label: 'Icon', title: 'Icon placeholder',
            icon: '<path d="M14 4H30V24H14Z"/><circle cx="22" cy="14" r="5"/><path d="M18.5 17.5 25.5 10.5"/>'
        }
    },

    tabs: {
        w: 3,
        h: 0.4,
        text: 'Home | Profile | Settings',
        fill: TABLE.headerFill,
        textOnPaper: true,
        segments: 'row',
        geo: tabsGeo,
        palette: {
            label: 'Tabs', title: 'Tabs: name them in the label, separated by |',
            icon: '<path d="M3 20V8H15V20M15 8H28V20M28 8H41V20M3 20H41"/><path d="M3 18H15"/>'
        }
    },

    breadcrumb: {
        w: 2.4, h: 0.3, text: 'Home | Products | Shoes', textOnPaper: true, segments: 'row', geo: breadcrumbGeo,
        palette: {
            label: 'Breadcrumb', title: "Breadcrumb: the path's parts in the label, separated by |",
            icon: '<path d="M3 14H10M16 14H23M29 14H40"/><path d="M12 11 14 14 12 17M25 11 27 14 25 17"/>'
        }
    },

    pagination: {
        w: 2.4,
        h: 0.35,
        text: '‹ | 1 | 2 | 3 | ›',
        fill: TABLE.headerFill,
        textOnPaper: true,
        segments: 'row',
        geo: paginationGeo,
        palette: {
            label: 'Pagination', title: 'Pagination: pages in the label, separated by |',
            icon: '<path d="M3 9H11V19H3ZM13 9H21V19H13ZM23 9H31V19H23ZM33 9H41V19H33Z"/><path d="M13 17H21"/>'
        }
    },

    stepper: {
        w: 3.2,
        h: 0.6,
        text: 'Cart | Details | Payment | Done',
        fill: TABLE.headerFill,
        txt: {y: 0.25, h: 0.5},
        textOnPaper: true,
        segments: 'row',
        geo: stepperGeo,
        palette: {
            label: 'Stepper', title: 'Stepper: steps in the label, separated by |, the first current',
            icon: '<circle cx="7" cy="10" r="3"/><circle cx="22" cy="10" r="3"/><circle cx="37" cy="10" r="3"/><path d="M10 10H19M25 10H34M3 20H11M18 20H26M33 20H41"/>'
        }
    },

    pills: {
        w: 2.4, h: 0.32, text: 'All | Open | Closed', textOnPaper: true, segments: 'row', geo: pillsGeo,
        palette: {
            label: 'Filter pills', title: 'Filter pills: filters in the label, separated by |',
            icon: '<path d="M7 9H11A5 5 0 0 1 11 19H7A5 5 0 0 1 7 9ZM20 9H24A5 5 0 0 1 24 19H20A5 5 0 0 1 20 9ZM33 9H37A5 5 0 0 1 37 19H33A5 5 0 0 1 33 9Z"/>'
        }
    },

    list: {
        w: 2,
        h: 0.9,
        text: 'First item | Second item | Third item',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.56, w: 0.82},
        textOnPaper: true,
        segments: 'column',
        geo: listGeo,
        palette: {
            label: 'List', title: 'List: items in the label, separated by |',
            icon: '<path d="M4 3H40V25H4Z"/><path d="M4 10H40M4 18H40M14 7H34M14 14H34M14 22H34"/><circle cx="9" cy="7" r="1"/><circle cx="9" cy="14" r="1"/><circle cx="9" cy="22" r="1"/>'
        }
    },

    sidebar: {
        w: 1.6,
        h: 1.2,
        text: 'Dashboard | Reports | Settings',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.55, w: 0.8},
        textOnPaper: true,
        segments: 'column',
        geo: sidebarGeo,
        palette: {
            label: 'Sidebar menu', title: 'Sidebar menu: items in the label, separated by |, the first current',
            icon: '<path d="M10 3H34V25H10Z"/><path d="M10 10H34M10 18H34M10 3V10H12V3M16 7H28M16 14H28M16 22H28"/>'
        }
    },

    accordion: {
        w: 2.4, h: 1.05, text: 'Section one | Section two | Section three', align: 0, txt: {x: 0.46, w: 0.86},
        textOnPaper: true, segments: 'column', geo: accordionGeo,
        palette: {
            label: 'Accordion', title: 'Accordion: sections in the label, separated by |, the first open',
            icon: '<path d="M4 3H40V25H4Z"/><path d="M4 10H40M4 18H40M8 7H26M8 14H26M8 22H26M33 6 35 8 37 6M34 12 36 14 34 16M34 20 36 22 34 24"/>'
        }
    },

    image: {
        w: 1.6, h: 1.2, geo: fracGeo({pts: RECT}, {noFill: 1, pts: linePts([0, 0, 1, 1], [0, 1, 1, 0])}),
        palette: {
            label: 'Image', title: 'Image (drop a picture file on the page, or choose one in the properties)',
            icon: '<path d="M6 4H38V24H6Z"/><path d="M6 4 38 24M6 24 38 4"/>'
        }
    },

    video: {
        w: 2.4,
        h: 1.5,
        text: 'Video title',
        fill: TABLE.headerFill,
        align: 0,
        txt: {y: 0.9, w: 0.9, h: 0.14},
        textOnPaper: true,
        geo: videoGeo,
        palette: {
            label: 'Video', title: 'Video player: a play button and a seek bar, the title along the top',
            icon: '<path d="M6 3H38V25H6Z"/><circle cx="22" cy="13" r="6"/><path d="M20 10V16L25 13Z"/><path d="M9 21H35M9 21H17"/><circle cx="17" cy="21" r="1"/>'
        }
    },

    carousel: {
        w: 2.4, h: 1.5, fill: TABLE.headerFill, bg: true, geo: carouselGeo,
        palette: {
            label: 'Carousel', title: 'Image carousel: a picture with arrows either side and a dot per slide',
            icon: '<path d="M10 2H34V20H10Z"/><path d="M10 2 34 20M34 2 10 20M6 8 3 11 6 14M38 8 41 11 38 14"/><circle cx="16" cy="25" r="1.2"/><circle cx="20" cy="25" r="1.2"/><circle cx="24" cy="25" r="1.2"/><circle cx="28" cy="25" r="1.2"/>'
        }
    },

    codeblock: {
        w: 2.4,
        h: 1,
        text: 'let n = sum(items)\nprint(n)',
        fill: GRID.headerFill,
        align: 0,
        txt: {x: 0.495, w: 0.77, h: 0.84},
        geo: codeblockGeo,
        palette: {
            label: 'Code block', title: 'Code block: the code is its label, a gutter and a copy button',
            icon: '<path d="M4 3H40V25H4Z"/><path d="M9 3V25M13 9H27M13 14H31M13 19H23"/><path d="M32 6H36V10H32ZM34 6V4H38V8H36"/>'
        }
    },

    chatbubble: {
        w: 2.4,
        h: 0.5,
        text: 'See you at 3pm!',
        fill: GRID.headerFill,
        align: 0,
        txt: {x: 0.6, w: 0.72},
        sides: true,
        geo: chatbubbleGeo,
        palette: {
            label: 'Chat bubble',
            title: "Chat bubble: a message beside its sender's avatar; [side=right] for one from me",
            icon: '<circle cx="7" cy="21" r="3.5"/><path d="M14 24 18 20V7A3 3 0 0 1 21 4H38A3 3 0 0 1 41 7V21A3 3 0 0 1 38 24Z"/><path d="M22 11H36M22 16H32"/>'
        }
    },

    commentthread: {
        w: 2.6,
        h: 1.05,
        text: 'Ana: Can we make this bigger? | Ben: Done, have a look | Reply…',
        fill: GRID.headerFill,
        align: 0,
        txt: {x: 0.57, w: 0.82},
        textOnPaper: true,
        segments: 'column',
        geo: commentthreadGeo,
        palette: {
            label: 'Comment thread',
            title: 'Comment thread: comments in the label, separated by |, then a reply box (the last part)',
            icon: '<circle cx="7" cy="6" r="3"/><circle cx="7" cy="15" r="3"/><path d="M7 9V12M13 6H36M13 15H32M12 21H40V26H12Z"/>'
        }
    },

    bell: {
        w: 0.5,
        h: 0.5,
        text: '3',
        fill: ERROR,
        textColour: DEF.textOnDark,
        txt: {x: 0.74, y: 0.72, w: 0.44, h: 0.44},
        geo: bellGeo,
        palette: {
            label: 'Notification bell', title: 'Notification bell: the count in its label goes in the badge',
            icon: '<path d="M12 22 15 19V12A7 7 0 0 1 29 12V19L32 22Z"/><path d="M20 22A2 2 0 0 0 24 22"/><circle cx="31" cy="8" r="4"/>'
        }
    },

    usermenu: {
        w: 2,
        h: 1.6,
        text: 'Ana Smith | Profile | Settings | Sign out',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.58, w: 0.78},
        textOnPaper: true,
        segments: 'column',
        bg: true,
        geo: usermenuGeo,
        palette: {
            label: 'User menu',
            title: "User menu, open: the user's name, then the menu, in the label separated by |; the first item lit",
            icon: '<path d="M6 2H38V8H6Z"/><circle cx="10" cy="5" r="2"/><path d="M15 5H26M31 6 33 4 35 6"/><path d="M6 10H38V26H6Z"/><path d="M6 10H38V15H6Z"/><path d="M10 12.5H26M10 18H24M10 22.5H22"/>'
        }
    },

    /* The text blocks of the map screens sit in their search box (a street view's on its card), measured at the
       default size like an app window's title: a much bigger or smaller map drifts them a little */
    mapview: {
        w: 3, h: 2.2, text: 'Search the map', fill: '#E6E2D6', align: 0, textOnPaper: true,
        txt: {x: 0.335, y: 0.895, w: 0.417, h: 0.136}, geo: mapviewGeo,
        palette: {
            label: 'Map view',
            title: 'Map view: streets, a park, a river, a pin and zoom buttons; the search text in its label',
            icon: '<path d="M3 2H41V26H3Z"/><path d="M11 2V26M21 2V26M24 2V26M33 2V26M3 11H41M3 18H41"/><path d="M3 22Q12 19 22 22T41 22"/><path d="M5 4H25V7H5Z"/><path d="M22 15A2 2 0 1 1 22.1 15L22 18"/><path d="M37 19H40V25H37ZM37 22H40"/>'
        }
    },

    satellite: {
        w: 3, h: 2.2, text: 'Search the map', fill: '#55634A', align: 0, textOnPaper: true,
        txt: {x: 0.335, y: 0.895, w: 0.417, h: 0.136}, geo: satelliteGeo,
        palette: {
            label: 'Satellite view',
            title: 'Satellite view: fields, roads and a river from above, a map tile to switch back; the search text in its label',
            icon: '<path d="M3 2H41V26H3Z"/><path d="M5 10H14L13 16H6ZM27 10H38V16H28ZM6 19H12V24H6ZM24 19H30V24H24Z"/><path d="M3 17Q22 13 41 17M22 2 24 26"/><path d="M5 4H25V7H5Z"/><path d="M37 19H40V25H37Z"/>'
        }
    },

    streetview: {
        w: 3, h: 2, text: 'High Street', fill: '#8E979E', align: 0, textOnPaper: true,
        txt: {x: 0.243, y: 0.89, w: 0.38, h: 0.14}, geo: streetviewGeo,
        palette: {
            label: 'Street view',
            title: 'Street view: a road to the horizon between buildings, a mini map and a compass; the street name in its label',
            icon: '<path d="M3 2H41V26H3Z"/><path d="M3 15H41M8 26 21 15H23L36 26M3 4 18 13V16M41 4 26 13V16"/><path d="M22 18V20M22 22V25"/><path d="M5 4H17V7H5Z"/><circle cx="37" cy="22" r="2.5"/>'
        }
    },

    mappin: {
        w: 0.4, h: 0.6, fill: ERROR, geo: mappinGeo,
        palette: {
            label: 'Map pin', title: 'Map pin: a teardrop marker to drop on any map',
            icon: '<path d="M18.5 17A6 6 0 1 1 25.5 17L22 25Z"/><circle cx="22" cy="11" r="2.2"/>'
        }
    },

    directions: {
        w: 2.6,
        h: 1.5,
        text: 'From: Leeds | To: York | Turn left onto the A64 | Turn right at the roundabout | Continue for 20 miles',
        fill: TABLE.headerFill,
        align: 0,
        txt: {x: 0.55, w: 0.83},
        textOnPaper: true,
        segments: 'column',
        geo: directionsGeo,
        palette: {
            label: 'Directions',
            title: 'Directions: from, to and then the steps in the label, separated by |; each step’s arrow turns the way it says',
            icon: '<path d="M4 1H40V27H4Z"/><path d="M4 7H40M4 13H40M4 20H40"/><circle cx="9" cy="4" r="1.5"/><path d="M8 10A1.3 1.3 0 1 1 10 10L9 11.5Z"/><path d="M10 18V15.5H7M8 14.5 7 15.5 8 16.5M9 25V22M8 23 9 22 10 23M14 4H30M14 10H28M14 16.5H34M14 23.5H30"/>'
        }
    },

    captcha: {
        w: 2.6, h: 0.7, text: 'I’m not a robot', fill: PALE, align: 0, textOnPaper: true, stateful: true,
        txt: {x: 0.479, w: 0.504}, geo: captchaGeo,
        palette: {
            label: 'Robot check', title: 'Robot check (CAPTCHA): a box to tick beside its label, [state=on] for ticked',
            icon: '<path d="M2 7H42V21H2Z"/><path d="M6 11H12V17H6Z"/><path d="M15 14H29"/><path d="M36 10A4 4 0 1 1 33 11.5M33 9V11.5H35.5"/>'
        }
    },

    imagecaptcha: {
        w: 2.4,
        h: 2.9,
        text: 'Select all squares with traffic lights',
        fill: TABLE.headerFill,
        textColour: DEF.textOnDark,
        txt: {y: 0.897, w: 0.9, h: 0.2},
        geo: imagecaptchaGeo,
        palette: {
            label: 'Picture check',
            title: 'Picture check (CAPTCHA): the instruction in its label over a 3 by 3 grid of pictures, two picked',
            icon: '<path d="M10 1H34V27H10Z"/><path d="M10 6H34V1H10Z"/><path d="M12 8H18V13H12ZM19 8H25V13H19ZM27 9H31V12H27ZM12 14H18V19H12ZM20 15H24V18H20ZM26 14H32V19H26ZM10 22H34M28 23.5H32V25.5H28Z"/><path d="M14 24.5A1.3 1.3 0 1 1 14.3 23.5"/>'
        }
    },

    textcaptcha: {
        w: 2.2, h: 1.2, text: 'x7Kp2', fill: PALE, bold: true, textOnPaper: true,
        txt: {x: 0.405, y: 0.69, w: 0.68, h: 0.45}, geo: textcaptchaGeo,
        palette: {
            label: 'Text check',
            title: 'Text check (CAPTCHA): a code under squiggles (its label), a refresh arrow and a box to type it in',
            icon: '<path d="M4 3H40V25H4Z"/><path d="M6 5H33V14H6Z"/><path d="M6 11Q12 6 19 10T33 9M6 8Q14 12 22 7T33 11"/><path d="M38 9.5A2 2 0 1 1 37.2 8M36 6.5 37.2 8 35.7 8.6"/><path d="M6 17H38V23H6Z"/>'
        }
    },

    /* A grid is a group (see buildGrid in grid.ts) of header and body cells */
    grid: {
        w: GRID.colW * GRID.cells[0].length, h: gridHeight(GRID.cells.length), grid: true,
        palette: {
            label: 'Grid table',
            icon: '<path d="M4 5H40V23H4Z"/><path d="M4 11H40M4 17H40M16 5V23M28 5V23"/>'
        }
    },

    gridHead: {
        w: GRID.colW,
        h: GRID.rowH,
        fill: GRID.headerFill,
        bold: true,
        align: 0,
        txt: {x: 0.5, w: 0.9},
        geo: fracGeo({pts: RECT})
    },

    gridCell: {w: GRID.colW, h: GRID.rowH, align: 0, txt: {x: 0.5, w: 0.9}, geo: fracGeo({pts: RECT})},
} satisfies Record<string, ShapeDef>
