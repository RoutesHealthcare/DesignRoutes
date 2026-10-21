import type {GeoFn, Point, PointSection, ShapeDef} from './types'
import {absGeo, arcPts, linePts, r4, roundedBox} from './geometry'
import {DEF} from '../engine/colours'

/* ---------- BPMN: events, gateways, tasks and data objects. The flowchart set covers the rest. ----------
   Events, gateways and data objects keep their size and have their name under them, on the paper, as in BPMN. */

const ring = (W: number, H: number, k = 1): Point[] => arcPts(W / 2, H / 2, W / 2 * k, H / 2 * k, 0, 360, 32)

/* The name under a small shape: a wide text block below it, so a long name doesn't wrap at the shape's width */
const UNDER = {y: -0.55, w: 5, h: 0.6}

/* An end event: a thick ring. Line weight is the whole shape's, so the ring is a filled band: the outer circle in the
   shape's (dark) fill and the inner one white over it (shade 0). */
const endeventGeo: GeoFn = (W, H) => absGeo([{pts: ring(W, H)}, {series: 0, shade: 0, pts: ring(W, H, 0.8)}])

/* A clock face inside an intermediate event's double ring: twelve ticks and two hands */
const timereventGeo: GeoFn = (W, H) => {
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.3
    const ticks = Array.from({length: 12}, (_, i): [number, number, number, number] => {
        const t = i * Math.PI / 6
        return [r4(cx + r * 0.8 * Math.cos(t)), r4(cy + r * 0.8 * Math.sin(t)), r4(cx + r * Math.cos(t)), r4(cy + r * Math.sin(t))]
    })
    return absGeo([{pts: ring(W, H)}, {noFill: 1, pts: ring(W, H, 0.86)},
        {noFill: 1, pts: arcPts(cx, cy, r, r, 0, 360, 24)},
        {noFill: 1, pts: linePts(...ticks, [cx, cy, cx, cy + r * 0.7], [cx, cy, cx + r * 0.5, cy])}])
}

/* A message event: the double ring with an envelope in it */
const messageeventGeo: GeoFn = (W, H) => {
    const cx = W / 2, cy = H / 2, w = W * 0.25, h = H * 0.17
    return absGeo([{pts: ring(W, H)}, {noFill: 1, pts: ring(W, H, 0.86)},
        {noFill: 1, pts: [[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h], [cx - w, cy - h]]},
        {noFill: 1, pts: [[cx - w, cy + h], [cx, cy], [cx + w, cy + h]]}])
}

/* A gateway: a diamond with its marker, an X (exclusive), a + (parallel), a ring (inclusive) or a pentagon in a
   double ring (event-based) */
const diamond = (W: number, H: number): Point[] => [[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2], [W / 2, 0]]
const gatewayGeo = (marker: 'x' | '+' | 'o' | 'event'): GeoFn => (W, H) => {
    const cx = W / 2, cy = H / 2, s = Math.min(W, H)
    if (marker === 'o') return absGeo([{pts: diamond(W, H)}, {
        noFill: 1,
        pts: arcPts(cx, cy, s * 0.2, s * 0.2, 0, 360, 24)
    }])
    if (marker === 'event') {
        const pent = Array.from({length: 6}, (_, i): Point => {
            const t = (90 + 72 * i) * Math.PI / 180
            return [r4(cx + s * 0.11 * Math.cos(t)), r4(cy + s * 0.11 * Math.sin(t))]
        })
        return absGeo([{pts: diamond(W, H)}, {noFill: 1, pts: arcPts(cx, cy, s * 0.24, s * 0.24, 0, 360, 24)},
            {noFill: 1, pts: arcPts(cx, cy, s * 0.2, s * 0.2, 0, 360, 24)}, {noFill: 1, pts: pent}])
    }
    const k = s * (marker === 'x' ? 0.15 : 0.22)
    const lines: [number, number, number, number][] = marker === 'x'
        ? [[cx - k, cy - k, cx + k, cy + k], [cx - k, cy + k, cx + k, cy - k]]
        : [[cx - k, cy, cx + k, cy], [cx, cy - k, cx, cy + k]]
    return absGeo([{pts: diamond(W, H)}, {noFill: 1, pts: linePts(...lines)}])
}

/* A task: a box with rounded corners. A marker in its top left corner says what kind (a person for a user task, a
   cog for a service task); none for a plain task. */
const TASK_R = 0.1
const taskGeo = (marker?: (x: number, y: number, s: number) => PointSection[]): GeoFn => (W, H) => {
    const s = Math.min(0.2, H * 0.25)
    return absGeo([{pts: roundedBox(W, H, Math.min(TASK_R, H * 0.2))}, ...(marker ? marker(0.08 + s / 2, H - 0.08 - s / 2, s) : [])])
}
const personMarker = (x: number, y: number, s: number): PointSection[] => [
    {noFill: 1, pts: arcPts(x, y + s * 0.22, s * 0.22, s * 0.22, 0, 360, 14)},
    {noFill: 1, pts: [...arcPts(x, y - s * 0.5, s * 0.45, s * 0.5, 0, 180, 10), [x + s * 0.45, y - s * 0.5]]}]
const cogMarker = (x: number, y: number, s: number): PointSection[] => {
    const teeth = Array.from({length: 33}, (_, i): Point => {
        const t = i * Math.PI / 16, r = (i % 4 < 2 ? 0.5 : 0.36) * s
        return [r4(x + r * Math.cos(t)), r4(y + r * Math.sin(t))]
    })
    return [{noFill: 1, pts: teeth}, {noFill: 1, pts: arcPts(x, y, s * 0.15, s * 0.15, 0, 360, 12)}]
}

/* A collapsed subprocess: a task with a small boxed + at the middle of its foot */
const plusMarker = (W: number, H: number): PointSection[] => {
    const s = Math.min(0.16, H * 0.22), x = W / 2, y = 0.05 + s / 2, k = s * 0.3
    return [{
        noFill: 1,
        pts: [[x - s / 2, y - s / 2], [x + s / 2, y - s / 2], [x + s / 2, y + s / 2], [x - s / 2, y + s / 2], [x - s / 2, y - s / 2]]
    },
        {noFill: 1, pts: linePts([x - k, y, x + k, y], [x, y - k, x, y + k])}]
}
const subprocessGeo: GeoFn = (W, H) => [...taskGeo()(W, H), ...absGeo(plusMarker(W, H))]

/* A data object: a page with its top right corner folded */
const dataobjectGeo: GeoFn = (W, H) => {
    const f = Math.min(W, H) * 0.3
    return absGeo([{pts: [[0, 0], [W, 0], [W, H - f], [W - f, H], [0, H], [0, 0]]},
        {noFill: 1, pts: [[W - f, H], [W - f, H - f], [W, H - f]]}])
}

export const bpmnShapes = {
    startevent: {
        w: 0.45, h: 0.45, text: '', fixedSize: true, textOnPaper: true, txt: UNDER,
        geo: (W, H) => absGeo([{pts: ring(W, H)}]),
        palette: {
            label: 'Start event', title: 'BPMN start event: a thin circle, its name under it',
            icon: '<circle cx="22" cy="14" r="9"/>'
        }
    },

    endevent: {
        w: 0.45, h: 0.45, text: '', fill: DEF.line, fixedSize: true, textOnPaper: true, txt: UNDER, geo: endeventGeo,
        palette: {
            label: 'End event', title: 'BPMN end event: a thick circle, its name under it',
            icon: '<circle cx="22" cy="14" r="8" stroke-width="3"/>'
        }
    },

    timerevent: {
        w: 0.45, h: 0.45, text: '', fixedSize: true, textOnPaper: true, txt: UNDER, geo: timereventGeo,
        palette: {
            label: 'Timer event', title: 'BPMN timer event: a clock in a double circle',
            icon: '<circle cx="22" cy="14" r="10"/><circle cx="22" cy="14" r="8"/><path d="M22 9V14H26"/>'
        }
    },

    messageevent: {
        w: 0.45, h: 0.45, text: '', fixedSize: true, textOnPaper: true, txt: UNDER, geo: messageeventGeo,
        palette: {
            label: 'Message event', title: 'BPMN message event: an envelope in a double circle',
            icon: '<circle cx="22" cy="14" r="10"/><circle cx="22" cy="14" r="8"/><path d="M17 11H27V17H17ZM17 11 22 15 27 11"/>'
        }
    },

    intermediateevent: {
        w: 0.45, h: 0.45, text: '', fixedSize: true, textOnPaper: true, txt: UNDER,
        geo: (W, H) => absGeo([{pts: ring(W, H)}, {noFill: 1, pts: ring(W, H, 0.86)}]),
        palette: {
            label: 'Intermediate event',
            title: 'BPMN intermediate event: a double circle; put one on a task\'s edge for a boundary event',
            icon: '<circle cx="22" cy="14" r="10"/><circle cx="22" cy="14" r="8"/>'
        }
    },

    gateway: {
        w: 0.6, h: 0.6, text: '', fixedSize: true, textOnPaper: true, txt: UNDER, geo: gatewayGeo('x'),
        palette: {
            label: 'Gateway', title: 'BPMN exclusive gateway: a diamond with an X; one way out is taken',
            icon: '<path d="M22 2 34 14 22 26 10 14Z"/><path d="M19 11 25 17M25 11 19 17"/>'
        }
    },

    parallelgateway: {
        w: 0.6, h: 0.6, text: '', fixedSize: true, textOnPaper: true, txt: UNDER, geo: gatewayGeo('+'),
        palette: {
            label: 'Parallel gateway', title: 'BPMN parallel gateway: a diamond with a +; every way out is taken',
            icon: '<path d="M22 2 34 14 22 26 10 14Z"/><path d="M22 9V19M17 14H27"/>'
        }
    },

    inclusivegateway: {
        w: 0.6, h: 0.6, text: '', fixedSize: true, textOnPaper: true, txt: UNDER, geo: gatewayGeo('o'),
        palette: {
            label: 'Inclusive gateway',
            title: 'BPMN inclusive gateway: a diamond with a ring; one or more ways out are taken',
            icon: '<path d="M22 2 34 14 22 26 10 14Z"/><circle cx="22" cy="14" r="4.5"/>'
        }
    },

    eventgateway: {
        w: 0.6, h: 0.6, text: '', fixedSize: true, textOnPaper: true, txt: UNDER, geo: gatewayGeo('event'),
        palette: {
            label: 'Event gateway', title: 'BPMN event-based gateway: the way out is whichever event happens first',
            icon: '<path d="M22 2 34 14 22 26 10 14Z"/><circle cx="22" cy="14" r="5.5"/><circle cx="22" cy="14" r="4.3"/><path d="M22 11.5 24.4 13.2 23.5 16H20.5L19.6 13.2Z"/>'
        }
    },

    task: {
        w: 1.5, h: 0.8, text: 'Task', geo: taskGeo(),
        palette: {
            label: 'Task', title: 'BPMN task: a box with rounded corners',
            icon: '<rect x="5" y="5" width="34" height="18" rx="4"/>'
        }
    },

    usertask: {
        w: 1.5, h: 0.8, text: 'Review order', geo: taskGeo(personMarker),
        palette: {
            label: 'User task', title: 'BPMN user task: done by a person, with a person in its corner',
            icon: '<rect x="5" y="5" width="34" height="18" rx="4"/><circle cx="11" cy="9" r="1.6"/><path d="M8 14A3 3 0 0 1 14 14Z"/>'
        }
    },

    servicetask: {
        w: 1.5, h: 0.8, text: 'Send email', geo: taskGeo(cogMarker),
        palette: {
            label: 'Service task', title: 'BPMN service task: done by a system, with a cog in its corner',
            icon: '<rect x="5" y="5" width="34" height="18" rx="4"/><circle cx="11" cy="11" r="3" stroke-dasharray="1.5 1"/>'
        }
    },

    bpmnsubprocess: {
        w: 1.5, h: 0.8, text: 'Handle refund', geo: subprocessGeo,
        palette: {
            label: 'Subprocess',
            title: 'BPMN collapsed subprocess: a task with a + at its foot, standing for a whole flow',
            icon: '<rect x="5" y="5" width="34" height="18" rx="4"/><path d="M19.5 17H24.5V22H19.5ZM20.5 19.5H23.5M22 18V21"/>'
        }
    },

    dataobject: {
        w: 0.45,
        h: 0.6,
        text: '',
        fixedSize: true,
        textOnPaper: true,
        txt: {y: -0.35, w: 5, h: 0.45},
        geo: dataobjectGeo,
        palette: {
            label: 'Data object', title: 'BPMN data object: a page with a folded corner, its name under it',
            icon: '<path d="M16 3H25L30 8V25H16Z"/><path d="M25 3V8H30"/>'
        }
    },
} satisfies Record<string, ShapeDef>
