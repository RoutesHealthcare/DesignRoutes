import type {GeoFn, ShapeDef} from './types'
import {absGeo, linePts} from './geometry'
import {PALE} from '../engine/colours'

/* ---------- containers: labelled frames that other shapes belong to ----------
   A container is an ordinary shape on the page, not a group: its members stay shapes of their own, each with its
   own line, and name the container in a setting, a: process "Call" [in=lane1]. On the page that's the FlowIn user
   cell. Moving a container moves its members, dropping a shape on one puts it inside, and dragging it out takes it
   out (src/engine/containers.ts). */

/* The header band's depth (along the top of a frame, down the left of a lane), and the gap kept round members
   laid out automatically, in inches */
export const CONTAINER = {header: 0.3, pad: 0.25, bar: 0.14}

/* The frame round the whole shape, then a header band of fixed depth drawn over it. The frame is the backdrop: white
   unless [bgfill=] says otherwise, or see-through with [bg=off]. Containers are drawn beneath everything else
   (render.ts), so their members show on top of it either way. */
const framed = (side: boolean): GeoFn => (W, H, _label, _values, attrs) => {
    const d = CONTAINER.header, f = String(d)
    const pt = (t: string, x: number, fx: string, y: number, fy: string) => ({
        t,
        c: [['X', x, fx], ['Y', y, fy]] as [string, number, string][]
    })
    const band = side
        ? [pt('MoveTo', 0, 'Width*0', 0, 'Height*0'), pt('LineTo', d, f, 0, 'Height*0'), pt('LineTo', d, f, H, 'Height*1'),
            pt('LineTo', 0, 'Width*0', H, 'Height*1'), pt('LineTo', 0, 'Width*0', 0, 'Height*0')]
        : [pt('MoveTo', 0, 'Width*0', H - d, `Height-${f}`), pt('LineTo', W, 'Width*1', H - d, `Height-${f}`),
            pt('LineTo', W, 'Width*1', H, 'Height*1'), pt('LineTo', 0, 'Width*0', H, 'Height*1'),
            pt('LineTo', 0, 'Width*0', H - d, `Height-${f}`)]
    const frame = [pt('MoveTo', 0, 'Width*0', 0, 'Height*0'), pt('LineTo', W, 'Width*1', 0, 'Height*0'),
        pt('LineTo', W, 'Width*1', H, 'Height*1'), pt('LineTo', 0, 'Width*0', H, 'Height*1'), pt('LineTo', 0, 'Width*0', 0, 'Height*0')]
    return [{noFill: attrs?.bg === 'off' ? 1 : 0, shade: 0, rows: frame}, {rows: band}]
}

/* A frame with a header and a scrollbar: down the right, or along the bottom for [flow=row]. The thumb is as long as
   the share of the contents that fits (attrs.shown, worked out by the layout), as far along as it's scrolled
   (attrs.at, from [scroll=]). */
const scrolled: GeoFn = (W, H, label, values, attrs) => {
    const d = CONTAINER.header, b = CONTAINER.bar, f = String(d), s = String(b), row = attrs?.flow === 'row',
        shown = Math.max(0.15, Math.min(1, attrs?.shown ?? 0.4)), at = Math.max(0, Math.min(1, attrs?.at ?? 0)),
        from = at * (1 - shown), to = from + shown   // the thumb, as shares of the bar from its start
    const sec = (noFill: number, pts: [number, string, number, string][]) => ({
        noFill,
        rows: pts.map(([x, fx, y, fy], i) => ({
            t: i ? 'LineTo' : 'MoveTo',
            c: [['X', x, fx], ['Y', y, fy]] as [string, number, string][]
        }))
    })
    const box = (noFill: number, x0: number, fx0: string, y0: number, fy0: string, x1: number, fx1: string, y1: number, fy1: string) =>
        sec(noFill, [[x0, fx0, y0, fy0], [x1, fx1, y0, fy0], [x1, fx1, y1, fy1], [x0, fx0, y1, fy1], [x0, fx0, y0, fy0]])
    const body = H - d, [frame, band] = framed(false)(W, H, label, values, attrs)
    const bar = row
        ? [box(1, 0, 'Width*0', 0, 'Height*0', W, 'Width*1', b, s),
            box(0, W * from, `Width*${from}`, 0, 'Height*0', W * to, `Width*${to}`, b, s)]
        : [box(1, W - b, `Width-${s}`, 0, 'Height*0', W, 'Width*1', body, `Height-${f}`),
            box(0, W - b, `Width-${s}`, body * (1 - to), `(Height-${f})*${1 - to}`, W, 'Width*1', body * (1 - from), `(Height-${f})*${1 - from}`)]
    return [frame, band, ...bar]
}

/* A C4 boundary: a dashed frame round the containers of one system, its name in a band along the top that's white
   (shade 0) rather than tinted, so the frame still has something to pick it up by. The dashes are short lines, since
   LinePattern is the whole shape's (as on the upload drop zone), over a backdrop with no line of its own. */
const DASH = 0.1
const dashedLine = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number][] => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / (DASH * 2))),
        out: [number, number, number, number][] = []
    for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 0.5) / n
        out.push([x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b])
    }
    return out
}
const boundaryGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const d = CONTAINER.header
    return absGeo([{
        noFill: attrs?.bg === 'off' ? 1 : 0,
        noLine: 1,
        shade: 0,
        pts: [[0, 0], [W, 0], [W, H], [0, H], [0, 0]]
    },
        {series: 0, shade: 0, pts: [[0, H - d], [W, H - d], [W, H], [0, H], [0, H - d]]},
        {
            noFill: 1, pts: linePts(...dashedLine(0, 0, W, 0), ...dashedLine(W, 0, W, H), ...dashedLine(W, H, 0, H),
                ...dashedLine(0, H, 0, 0))
        }])
}

export const containerShapes = {
    container: {
        w: 3, h: 2, container: 'top', fill: PALE, bg: true, text: 'Container', geo: framed(false),
        palette: {
            label: 'Container', title: 'Container: a labelled frame; shapes dropped on it move with it',
            icon: '<rect x="4" y="3" width="36" height="22"/><path d="M4 9H40"/>'
        }
    },
    pool: {
        w: 6, h: 2.5, container: 'side', fill: PALE, bg: true, text: 'Pool', geo: framed(true),
        palette: {
            label: 'Swimlanes', title: 'Pool with two swimlanes; drop more lanes on it',
            icon: '<rect x="3" y="4" width="38" height="20"/><path d="M8 4V24M12 4V24M12 14H41"/>'
        }
    },
    lane: {
        w: 6, h: 1.25, container: 'side', fill: PALE, bg: true, text: 'Lane', geo: framed(true),
        palette: {
            label: 'Lane', title: 'Swimlane: a band for one team or role',
            icon: '<rect x="3" y="8" width="38" height="12"/><path d="M9 8V20"/>'
        }
    },
    c4boundary: {
        w: 4,
        h: 2.5,
        container: 'top',
        fill: PALE,
        bg: true,
        align: 0,
        text: 'Shop [Software system]',
        geo: boundaryGeo,
        palette: {
            label: 'C4 boundary', title: 'C4 boundary: a dashed frame round the containers of one system',
            icon: '<rect x="4" y="3" width="36" height="22" stroke-dasharray="3 2"/><path d="M7 7H22"/>'
        }
    },
    scroll: {
        w: 3, h: 2, container: 'top', scroll: true, fill: PALE, bg: true, text: 'Scroll area', geo: scrolled,
        palette: {
            label: 'Scroll area', title: 'Scroll area: a frame that cuts off what does not fit, with a scrollbar',
            icon: '<rect x="4" y="3" width="36" height="22"/><path d="M4 9H40M35 9V25"/><rect x="35" y="10" width="5" height="7"/>'
        }
    },
} satisfies Record<string, ShapeDef>
