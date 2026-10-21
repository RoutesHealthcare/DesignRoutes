import type {GeoFn, PointSection, ShapeDef} from './types'
import {absGeo, arcPts, fracGeo, linePts, r4, roundedBox, roundedEnds} from './geometry'
import {segmentsOf} from './wireframe'
import {ACCENT, DEF, PALE, STICKY} from '../engine/colours'

/* ---------- planning: notes and markers for boards, roadmaps and org charts ---------- */

/* A sticky note: a square of paper with its bottom right corner folded up. The fold keeps its size however big the
   note is. */
const stickyGeo: GeoFn = (W, H) => {
    const f = Math.min(0.3, W * 0.2, H * 0.2)
    return absGeo([{pts: [[0, 0], [W - f, 0], [W, f], [W, H], [0, H], [0, 0]]},
        {noFill: 1, pts: [[W - f, 0], [W - f, f], [W, f]]}])
}

/* A person card for an org chart: a picture placeholder at the left (a head and shoulders in a circle), the name and
   role beside it. The circle is sized from the height, so the text starts a fixed number of heights in (txtLeft). */
const PERSON_TXT = 1.05
const personcardGeo: GeoFn = (W, H) => {
    const r = H * 0.32, cx = H * 0.5, cy = H / 2
    return absGeo([{pts: roundedBox(W, H, Math.min(0.08, H * 0.15))},
        {noFill: 1, pts: arcPts(cx, cy, r, r, 0, 360, 24)},
        {noFill: 1, pts: arcPts(cx, cy + r * 0.25, r * 0.35, r * 0.35, 0, 360, 16)},
        {noFill: 1, pts: arcPts(cx, cy - r * 0.95, r * 0.65, r * 0.75, 50, 130, 10)}])
}

/* A timeline: a line along the bottom with an arrowhead at its end, a dot under the middle of each part of the label
   (a segmented row, "Q1 | Q2 | Q3"), the names above the dots */
const TIMELINE_Y = 0.22
const timelineGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, y = H * TIMELINE_Y, r = Math.min(0.07, H * 0.12), a = Math.min(0.1, H * 0.15)
    return absGeo([{noFill: 1, pts: linePts([0, y, W, y], [W, y, W - a, y + a * 0.6], [W, y, W - a, y - a * 0.6])},
        ...Array.from({length: n}, (_, i): PointSection => ({pts: arcPts(W * (i + 0.5) / n, y, r, r, 0, 360, 16)}))])
}

/* Phases: a chevron per part of the label, side by side, each pointing into the next */
const phasesGeo: GeoFn = (W, H, label) => {
    const n = segmentsOf(label).length, s = W / n, d = Math.min(H * 0.3, s * 0.25)
    return absGeo(Array.from({length: n}, (_, i): PointSection => {
        const x0 = i * s, x1 = x0 + s, first = i === 0, last = i === n - 1
        return {
            pts: [[x0, 0], [last ? x1 : x1 - d, 0], [x1, H / 2], [last ? x1 : x1 - d, H], [x0, H],
                [first ? x0 : x0 + d, H / 2], [x0, 0]]
        }
    }))
}

/* A mood face for journey maps, picked by [face=] alone (the label is just its name): happy (the default), sad, mad,
   angry or laughing, the face lightly shaded to match. The face fills the top of the shape and the label sits inside
   it underneath, so a layout leaves room for the name too. FaceAliases (engine/flow/face-aliases.ts) takes smile, :)
   and the like. */
const MOOD_FACE = 0.66   // the share of the height the face takes
export const FACES = {
    happy: {name: 'Happy'}, sad: {name: 'Sad'}, mad: {name: 'Mad'}, angry: {name: 'Angry'},
    laughing: {name: 'Laughing'}
}
type Face = keyof typeof FACES
const FACE_SERIES: Record<Face, number> = {happy: 4, sad: 2, mad: 1, angry: 3, laughing: 4}   // SERIES_FILLS: green, blue, amber, red
const moodGeo: GeoFn = (W, H, _label, _values, attrs) => {
    const f: Face = attrs?.face && attrs.face in FACES ? attrs.face as Face : 'happy',
        r = Math.min(W, H * MOOD_FACE) / 2, cx = W / 2, cy = H - r, e = r * 0.09, ex = r * 0.35, ey = cy + r * 0.25
    const dot = (x: number): PointSection => ({noFill: 1, pts: arcPts(x, ey, e, e, 0, 360, 10)})
    // laughing screws its eyes shut: a little arch each
    const eyes = f === 'laughing'
        ? [-1, 1].map((s): PointSection => ({noFill: 1, pts: arcPts(cx + s * ex, ey - e, e * 2, e * 2, 20, 160, 8)}))
        : [dot(cx - ex), dot(cx + ex)]
    // brows slope down to the nose: a little for mad, steeply for angry
    const tilt = f === 'angry' ? r * 0.2 : r * 0.1, by = ey + r * 0.2,
        brows = f === 'mad' || f === 'angry' ? [{
            noFill: 1, pts: linePts([cx - ex - r * 0.18, by + tilt, cx - ex + r * 0.18, by - tilt / 2],
                [cx + ex + r * 0.18, by + tilt, cx + ex - r * 0.18, by - tilt / 2])
        }] : []
    const mouth: PointSection = f === 'happy' ? {
            noFill: 1,
            pts: arcPts(cx, cy + r * 0.12, r * 0.45, r * 0.32, 200, 340, 12)
        }
        : f === 'laughing' ? {pts: [...arcPts(cx, cy - r * 0.05, r * 0.45, r * 0.42, 180, 360, 14), [r4(cx - r * 0.45), r4(cy - r * 0.05)]]}
            : f === 'mad' ? {noFill: 1, pts: linePts([cx - r * 0.35, cy - r * 0.4, cx + r * 0.35, cy - r * 0.32])}
                : {noFill: 1, pts: arcPts(cx, cy - r * 0.62, r * 0.45, r * 0.32, 20, 160, 12)}   // sad and angry frown
    return absGeo([{series: FACE_SERIES[f], shade: 0.35, pts: arcPts(cx, cy, r, r, 0, 360, 32)},
        ...eyes, ...brows, mouth])
}

/* Mind map topics: the central one filled, its branches outlined, both with fully rounded ends. A central topic among
   the shapes being placed lays its tree out to both sides of it (layoutMindMap in engine/layout.ts). */
export const planningShapes = {
    centraltopic: {
        w: 1.8, h: 0.7, text: 'Big idea', fill: ACCENT, textColour: DEF.textOnDark, bold: true, geo: roundedEnds,
        palette: {
            label: 'Central topic',
            title: 'Mind map central topic: connect topics to it and they spread out to both sides',
            icon: '<rect x="8" y="8" width="28" height="12" rx="6" stroke-width="2.4"/><path d="M2 8H8M36 8H42M2 20H8M36 20H42"/>'
        }
    },

    topic: {
        w: 1.4, h: 0.45, text: 'Topic', geo: roundedEnds,
        palette: {
            label: 'Topic', title: 'Mind map topic: a branch off the central topic or another topic',
            icon: '<rect x="8" y="9" width="28" height="10" rx="5"/>'
        }
    },

    sticky: {
        w: 1.6, h: 1.4, text: 'Remember this', fill: STICKY, txt: {w: 0.86, h: 0.8}, geo: stickyGeo,
        palette: {
            label: 'Sticky note', title: 'Sticky note: a yellow note with a folded corner',
            icon: '<path d="M10 3H34V19L28 25H10Z"/><path d="M28 25V19H34"/>'
        }
    },

    callout: {
        w: 2, h: 0.9, text: 'A note about this', txt: {y: 0.65, w: 0.92, h: 0.7},
        geo: fracGeo({pts: [[0, 0.3], [0.12, 0.3], [0.04, 0], [0.3, 0.3], [1, 0.3], [1, 1], [0, 1], [0, 0.3]]}),
        palette: {
            label: 'Callout', title: 'Callout: a speech bubble with a pointer at its bottom left',
            icon: '<path d="M4 3H40V19H14L7 26 9 19H4Z"/><path d="M9 9H35M9 13H27"/>'
        }
    },

    milestone: {
        w: 0.36, h: 0.36, text: 'Launch', fill: ACCENT, fixedSize: true, textOnPaper: true,
        txt: {y: -0.75, w: 5, h: 0.9},
        geo: fracGeo({pts: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]]}),
        palette: {
            label: 'Milestone', title: 'Milestone: a filled diamond with its name under it, for timelines and roadmaps',
            icon: '<path d="M22 3 29 10 22 17 15 10Z"/><path d="M14 23H30"/>'
        }
    },

    timeline: {
        w: 4, h: 0.6, text: 'Q1 | Q2 | Q3 | Q4', fill: ACCENT, segments: 'row', textOnPaper: true,
        txt: {y: 0.68, h: 0.5}, geo: timelineGeo,
        palette: {
            label: 'Timeline', title: 'Timeline: a line with a dot per part of the label, separated by |',
            icon: '<path d="M3 20H41M38 18 41 20 38 22"/><circle cx="9" cy="20" r="1.6"/><circle cx="22" cy="20" r="1.6"/><circle cx="35" cy="20" r="1.6"/><path d="M6 11H12M19 11H25M32 11H38"/>'
        }
    },

    phases: {
        w: 4.4, h: 0.5, text: 'Discover | Design | Build | Launch', fill: PALE, segments: 'row', geo: phasesGeo,
        palette: {
            label: 'Phases', title: 'Phases: a chevron per stage of a roadmap, named in the label, separated by |',
            icon: '<path d="M2 9H14L18 14 14 19H2ZM16 9H28L32 14 28 19H16L20 14ZM30 9H42V19H30L34 14Z"/>'
        }
    },

    mood: {
        w: 1, h: 0.75, text: 'Happy', fixedSize: true, textOnPaper: true,
        txt: {y: (1 - MOOD_FACE) / 2, h: 1 - MOOD_FACE}, geo: moodGeo, faces: FACES,
        palette: {
            label: 'Mood',
            title: 'Mood face for journey maps: happy, sad, mad, angry or laughing, from its face setting',
            icon: '<circle cx="22" cy="12" r="9"/><circle cx="19" cy="10" r="0.8"/><circle cx="25" cy="10" r="0.8"/><path d="M18 14Q22 18 26 14M16 26H28"/>'
        }
    },

    personcard: {
        w: 2.2, h: 0.7, text: 'Ana Silva\nHead of design', align: 0, txtLeft: PERSON_TXT, geo: personcardGeo,
        palette: {
            label: 'Person card', title: 'Person card for org charts: a picture, the name and role in its label',
            icon: '<rect x="3" y="7" width="38" height="14" rx="2"/><circle cx="10" cy="14" r="4.5"/><path d="M17 12H35M17 17H29"/>'
        }
    },
} satisfies Record<string, ShapeDef>
