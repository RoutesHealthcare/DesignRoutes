import type {GeoFn, Point, ShapeDef} from './types'
import {RECT, absGeo, arcPts, boxPts, fracGeo, linePts, roundedBox} from './geometry'
import {segmentsOf} from './wireframe'
import {DEF} from '../engine/colours'

/* ---------- UML: class boxes, states and sequence lifelines. Actor and use case are user and ellipse. ---------- */

/* A class box: one compartment per part of the label (name | attributes | operations), a line between each */
const umlclassGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length
    return [...fracGeo({pts: RECT})(W, H),
        ...absGeo([{
            noFill: 1, pts: linePts(...Array.from({length: n - 1}, (_, i): [number, number, number, number] =>
                [0, H * (n - 1 - i) / n, W, H * (n - 1 - i) / n]))
        }])]
}

/* A state: a box with well rounded corners */
const stateGeo: GeoFn = (W, H) => absGeo([{pts: roundedBox(W, H, Math.min(0.18, H * 0.3, W * 0.3))}])

/* The final state: a ring (no fill, so the paper shows between it and the dot) round a dot in the shape's fill */
const finalGeo: GeoFn = (W, H) => absGeo([{noFill: 1, pts: arcPts(W / 2, H / 2, W / 2, H / 2, 0, 360, 32)},
    {pts: arcPts(W / 2, H / 2, W * 0.32, H * 0.32, 0, 360, 24)}])

/* A sequence diagram lifeline: the participant's box at the top and a dashed line down from it. The dashes are drawn
   as short lines, since LinePattern is the whole shape's (as on the upload drop zone). The head keeps its depth
   however long the line is (a sequence makes its lifelines as long as its messages need), and its name stays in it. */
export const LIFELINE_HEAD = 0.45
const lifelineGeo: GeoFn = (W, H) => {
    const hh = Math.min(LIFELINE_HEAD, H), x = W / 2, dash = 0.08, dashes: [number, number, number, number][] = []
    for (let y = H - hh - dash; y > 0; y -= dash * 2) dashes.push([x, y, x, Math.max(0, y - dash)])
    return absGeo([{pts: boxPts(0, H - hh, W, H)}, {noFill: 1, pts: linePts(...dashes)}])
}

/* An activation bar: the narrow box on a lifeline while a participant is busy */
const activationGeo: GeoFn = fracGeo({pts: RECT})

const circle = (W: number, H: number): Point[] => arcPts(W / 2, H / 2, W / 2, H / 2, 0, 360, 32)

export const umlShapes = {
    umlclass: {
        w: 1.8, h: 1.5, text: 'User | id: int\nname: text | login()\nlogout()', segments: 'column', geo: umlclassGeo,
        palette: {
            label: 'Class', title: 'UML class: name | attributes | operations, one compartment per part of the label',
            icon: '<path d="M8 2H36V26H8Z"/><path d="M8 9H36M8 18H36M12 5.5H32M12 12H26M12 15H28M12 21H24"/>'
        }
    },

    state: {
        w: 1.4, h: 0.6, text: 'Waiting', geo: stateGeo,
        palette: {
            label: 'State', title: 'UML state: a box with rounded corners',
            icon: '<rect x="5" y="6" width="34" height="16" rx="6"/>'
        }
    },

    initial: {
        w: 0.3, h: 0.3, text: '', fill: DEF.line, fixedSize: true, textOnPaper: true, txt: {y: -0.9, w: 6, h: 0.8},
        geo: (W, H) => absGeo([{pts: circle(W, H)}]),
        palette: {
            label: 'Initial state', title: 'UML initial state: a filled dot where the machine starts',
            icon: '<circle cx="22" cy="14" r="3" stroke-width="6"/>'
        }
    },

    final: {
        w: 0.34, h: 0.34, text: '', fill: DEF.line, fixedSize: true, textOnPaper: true, txt: {y: -0.8, w: 6, h: 0.7},
        geo: finalGeo,
        palette: {
            label: 'Final state', title: 'UML final state: a ring round a filled dot',
            icon: '<circle cx="22" cy="14" r="8"/><circle cx="22" cy="14" r="2.2" stroke-width="4.4"/>'
        }
    },

    lifeline: {
        w: 1.2, h: 3, text: 'Server', txtTop: LIFELINE_HEAD, geo: lifelineGeo,
        palette: {
            label: 'Lifeline', title: 'Sequence diagram lifeline: the participant in a box over a dashed line',
            icon: '<path d="M12 2H32V9H12Z"/><path d="M22 9V12M22 15V18M22 21V24"/>'
        }
    },

    activation: {
        w: 0.16, h: 1, text: '', fixedSize: true, geo: activationGeo,
        palette: {
            label: 'Activation', title: 'Sequence diagram activation bar: put it over a lifeline while it is busy',
            icon: '<path d="M22 2V5M22 23V26"/><rect x="19.5" y="6" width="5" height="16"/>'
        }
    },
} satisfies Record<string, ShapeDef>
