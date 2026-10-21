import type {GeoFn, Point, ShapeDef} from './types'
import {RECT, absGeo, arcPts, boxPts, fracGeo, linePts, r4, roundedBox} from './geometry'
import {C4, DEF} from '../engine/colours'

/* The cloud outline: a circle whose radius ripples, sampled at 65 points */
const cloudPts = Array.from({length: 65}, (_, i): Point => {
    const t = 2 * Math.PI * i / 64, f = 0.86 + 0.14 * Math.abs(Math.sin(3.5 * t))
    return [r4(0.5 + 0.5 * f * Math.cos(t)), r4(0.5 + 0.5 * f * Math.sin(t))]
})

/* ---------- C4: people and boxes at each level of zoom, in the usual C4 blues. A boundary is a container. ---------- */

/* A C4 box: rounded corners, the name, its type and a line about it in the label */
const c4Box: GeoFn = (W, H) => absGeo([{pts: roundedBox(W, H, Math.min(0.1, H * 0.12))}])

/* A C4 person: a head over a rounded body, the label in the body */
const C4_BODY = 0.64
const c4personGeo: GeoFn = (W, H) => {
    const bh = H * C4_BODY, r = Math.min(W * 0.2, (H - bh) * 0.62)
    return absGeo([{pts: roundedBox(W, bh, Math.min(0.18, bh * 0.3))},
        {pts: arcPts(W / 2, bh + (H - bh) / 2 + r * 0.15, r, r, 0, 360, 24)}])
}

/* ---------- Network and cloud icons: set sizes, the name under them like the server's ---------- */

const UNDER = {y: -0.32, w: 3.4, h: 0.4}

/* An arrowhead at x,y pointing along angle a (degrees), as a V of two lines, in fractions */
const head = (x: number, y: number, a: number, s = 0.08): [number, number, number, number][] => {
    const t = a * Math.PI / 180, l = (d: number): [number, number, number, number] =>
        [x, y, r4(x - s * Math.cos(t + d)), r4(y - s * Math.sin(t + d))]
    return [l(0.6), l(-0.6)]
}

/* A firewall: a brick wall */
const firewallGeo = fracGeo({pts: RECT}, {
    noFill: 1, pts: linePts([0, 0.25, 1, 0.25], [0, 0.5, 1, 0.5], [0, 0.75, 1, 0.75],
        [0.5, 0, 0.5, 0.25], [0.25, 0.25, 0.25, 0.5], [0.75, 0.25, 0.75, 0.5], [0.5, 0.5, 0.5, 0.75],
        [0.25, 0.75, 0.25, 1], [0.75, 0.75, 0.75, 1])
})

/* A router: a disc with arrows out to each side */
const routerGeo = fracGeo({pts: arcPts(0.5, 0.5, 0.5, 0.5, 0, 360, 32)}, {
    noFill: 1, pts: linePts([0.2, 0.5, 0.8, 0.5], [0.5, 0.2, 0.5, 0.8],
        ...head(0.8, 0.5, 0), ...head(0.2, 0.5, 180), ...head(0.5, 0.8, 90), ...head(0.5, 0.2, 270))
})

/* A load balancer: one line in at the left, fanned out to three at the right */
const loadbalancerGeo = fracGeo({pts: RECT}, {
    noFill: 1, pts: linePts([0.12, 0.5, 0.4, 0.5], [0.4, 0.5, 0.86, 0.8], [0.4, 0.5, 0.86, 0.5], [0.4, 0.5, 0.86, 0.2],
        ...head(0.86, 0.8, 33), ...head(0.86, 0.5, 0), ...head(0.86, 0.2, -33))
})

/* A message queue: messages waiting in a row */
const queueGeo = fracGeo({pts: RECT}, {
    noFill: 1, pts: linePts([0.25, 0, 0.25, 1], [0.5, 0, 0.5, 1], [0.75, 0, 0.75, 1])
})

/* A cache: a cylinder, like the database, with a lightning flash on it */
const CYL = 0.14
const cacheGeo = fracGeo(
    {pts: [[0, 1 - CYL], [0, CYL], ...arcPts(0.5, CYL, 0.5, CYL, 180, 360).slice(1), [1, 1 - CYL], ...arcPts(0.5, 1 - CYL, 0.5, CYL, 0, 180).slice(1)]},
    {noFill: 1, pts: arcPts(0.5, 1 - CYL, 0.5, CYL, 180, 360)},
    {noFill: 1, pts: [[0.56, 0.72], [0.36, 0.44], [0.52, 0.44], [0.42, 0.2], [0.66, 0.5], [0.5, 0.5], [0.56, 0.72]]})

/* A storage bucket: a pail, wider at its rim */
const bucketGeo = fracGeo(
    {pts: [[0, 0.85], [0.14, 0.06], ...arcPts(0.5, 0.06, 0.36, 0.06, 180, 360).slice(1), [1, 0.85], ...arcPts(0.5, 0.85, 0.5, 0.15, 0, 180).slice(1)]},
    {noFill: 1, pts: arcPts(0.5, 0.85, 0.5, 0.15, 180, 360)})

/* A phone: a narrow rounded body, a speaker slot at the top and a button at the bottom */
const phoneGeo: GeoFn = (W, H) => {
    const r = Math.min(W, H) * 0.16, b = Math.min(W, H) * 0.07
    return absGeo([{pts: roundedBox(W, H, r)}, {noFill: 1, pts: boxPts(W * 0.1, H * 0.14, W * 0.9, H * 0.86)},
        {noFill: 1, pts: linePts([W * 0.38, H * 0.93, W * 0.62, H * 0.93])},
        {noFill: 1, pts: arcPts(W / 2, H * 0.07, b, b, 0, 360, 12)}])
}

/* A service: a hexagon, the usual mark for one service of many */
const serviceGeo = fracGeo({pts: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5], [0.25, 0]]})

/* A script: a file with a folded corner, and its language's extension lettered in the corner, from [lang=py]. Keys
   are the extension itself, without the dot, so the text you write is the text you see. */
export const LANGS: Record<string, { name: string }> = {
    py: {name: 'Python'},
    js: {name: 'JavaScript'},
    jsx: {name: 'JSX'},
    ts: {name: 'TypeScript'},
    tsx: {name: 'TSX'},
    cs: {name: 'C#'},
    php: {name: 'PHP'},
    html: {name: 'HTML'},
    css: {name: 'CSS'},
    sql: {name: 'SQL'},
    java: {name: 'Java'},
    go: {name: 'Go'},
    rb: {name: 'Ruby'},
    rs: {name: 'Rust'},
    swift: {name: 'Swift'},
    kt: {name: 'Kotlin'},
    cpp: {name: 'C++'},
    c: {name: 'C'},
    sh: {name: 'Shell'},
}
/* The fold is a square (its two straight edges equal), folded in half along its diagonal, whatever the shape's own
   proportions: sized off the shorter side so a tall, narrow script doesn't grow a stretched-out corner */
const scriptGeo: GeoFn = (W, H) => {
    const fold = Math.min(W, H) * 0.32
    return absGeo([
        {pts: [[0, 0], [W - fold, 0], [W, fold], [W, H], [0, H], [0, 0]]},
        {noFill: 1, pts: [[W - fold, 0, 'MoveTo'], [W - fold, fold], [W, fold]]}
    ])
}
/* Its extension, tucked just inside the folded corner; attrs.lang is null at the default (py), like maps */
const scriptBadge = (attrs?: Parameters<GeoFn>[4]) => ({
    x: 0.8, y: 0.16, text: '.' + (attrs?.lang && LANGS[attrs.lang] ? attrs.lang : Object.keys(LANGS)[0])
})

export const systemsShapes = {
    server: {
        w: 0.6, h: 1, txt: {y: -0.18, w: 2.4, h: 0.3},
        geo: fracGeo({pts: RECT}, {
            noFill: 1,
            pts: linePts([0, 0.75, 1, 0.75], [0, 0.5, 1, 0.5], [0.2, 0.15, 0.45, 0.15])
        }),
        palette: {
            label: 'Server',
            icon: '<path d="M15 2H29V26H15Z"/><path d="M15 9H29M15 15H29M18 21H22"/>'
        }
    },
    cloud: {
        w: 1.6, h: 1, geo: fracGeo({pts: cloudPts}),
        palette: {
            label: 'Cloud',
            icon: '<path d="M12 22A6 6 0 0 1 11 10A8 8 0 0 1 26 8A6 6 0 0 1 35 13A5 5 0 0 1 34 22Z"/>'
        }
    },
    user: {
        w: 0.6, h: 0.8, txt: {y: -0.16, w: 2.4, h: 0.3},
        geo: fracGeo({pts: arcPts(0.5, 0.76, 0.24, 0.18, 0, 360, 32)}, {pts: [...arcPts(0.5, 0, 0.45, 0.5, 180, 0, 24), [0.05, 0]]}),
        palette: {
            label: 'User',
            icon: '<circle cx="22" cy="8" r="5"/><path d="M11 26A11 10 0 0 1 33 26Z"/>'
        }
    },
    api: {
        w: 1.6, h: 0.8, txt: {x: 0.56, w: 0.84},
        geo: fracGeo({pts: boxPts(0.12, 0, 1, 1)}, {pts: boxPts(0, 0.62, 0.24, 0.78)}, {pts: boxPts(0, 0.22, 0.24, 0.38)}),
        palette: {
            label: 'System / API',
            icon: '<path d="M12 4H40V24H12Z"/><path d="M8 8H16V12H8ZM8 16H16V20H8Z"/>'
        }
    },

    c4person: {
        w: 1.6,
        h: 1.5,
        text: 'Customer\n[Person]',
        fill: C4.person,
        textColour: DEF.textOnDark,
        txt: {y: C4_BODY / 2, w: 0.9, h: C4_BODY * 0.9},
        geo: c4personGeo,
        palette: {
            label: 'C4 person', title: 'C4 person: someone who uses the system, a head over a body',
            icon: '<circle cx="22" cy="7" r="4.5"/><rect x="11" y="13" width="22" height="13" rx="4"/>'
        }
    },
    c4system: {
        w: 2,
        h: 1.1,
        text: 'Shop\n[Software system]',
        fill: C4.system,
        textColour: DEF.textOnDark,
        txt: {w: 0.9, h: 0.9},
        geo: c4Box,
        palette: {
            label: 'C4 system', title: 'C4 software system: the dark blue box at the top level',
            icon: '<rect x="6" y="5" width="32" height="18" rx="3"/><path d="M13 12H31M16 16H28"/>'
        }
    },
    c4container: {
        w: 2,
        h: 1.1,
        text: 'Web app\n[Container: React]',
        fill: C4.container,
        textColour: DEF.textOnDark,
        txt: {w: 0.9, h: 0.9},
        geo: c4Box,
        palette: {
            label: 'C4 container', title: 'C4 container: an app or data store inside a system (put it in a boundary)',
            icon: '<rect x="6" y="5" width="32" height="18" rx="3"/><path d="M13 12H31M13 16H31"/>'
        }
    },
    c4component: {
        w: 2, h: 1.1, text: 'Sign-in\n[Component]', fill: C4.component, txt: {w: 0.9, h: 0.9}, geo: c4Box,
        palette: {
            label: 'C4 component', title: 'C4 component: a part of a container, in the lightest blue',
            icon: '<rect x="6" y="5" width="32" height="18" rx="3"/><path d="M16 12H28"/>'
        }
    },
    c4external: {
        w: 2,
        h: 1.1,
        text: 'Payments\n[External system]',
        fill: C4.external,
        textColour: DEF.textOnDark,
        txt: {w: 0.9, h: 0.9},
        geo: c4Box,
        palette: {
            label: 'C4 external', title: 'C4 external system: one outside the system being drawn, in grey',
            icon: '<rect x="6" y="5" width="32" height="18" rx="3" stroke-dasharray="3 2"/><path d="M13 12H31"/>'
        }
    },

    firewall: {
        w: 0.7, h: 0.6, text: 'Firewall', fixedSize: true, txt: UNDER, geo: firewallGeo,
        palette: {
            label: 'Firewall', title: 'Firewall: a brick wall, its name under it',
            icon: '<path d="M12 4H32V24H12Z"/><path d="M12 9H32M12 14H32M12 19H32M22 4V9M17 9V14M27 9V14M22 14V19M17 19V24M27 19V24"/>'
        }
    },
    router: {
        w: 0.6, h: 0.6, text: 'Router', fixedSize: true, txt: UNDER, geo: routerGeo,
        palette: {
            label: 'Router', title: 'Router: a disc with arrows out each side',
            icon: '<circle cx="22" cy="14" r="11"/><path d="M15 14H29M22 7V21M27 12 29 14 27 16M17 12 15 14 17 16M20 9 22 7 24 9M20 19 22 21 24 19"/>'
        }
    },
    loadbalancer: {
        w: 0.8, h: 0.6, text: 'Load balancer', fixedSize: true, txt: UNDER, geo: loadbalancerGeo,
        palette: {
            label: 'Load balancer', title: 'Load balancer: one line in, fanned out to three',
            icon: '<path d="M8 4H36V24H8Z"/><path d="M11 14H18L32 7M18 14H32M18 14 32 21"/>'
        }
    },
    queue: {
        w: 1, h: 0.4, text: 'Queue', fixedSize: true, txt: {y: -0.5, w: 3, h: 0.6}, geo: queueGeo,
        palette: {
            label: 'Queue', title: 'Message queue: messages waiting in a row',
            icon: '<path d="M4 8H40V20H4Z"/><path d="M13 8V20M22 8V20M31 8V20"/>'
        }
    },
    cache: {
        w: 0.6, h: 0.7, text: 'Cache', fixedSize: true, txt: {y: -0.27, w: 3.6, h: 0.35}, geo: cacheGeo,
        palette: {
            label: 'Cache', title: 'Cache: a cylinder with a lightning flash',
            icon: '<path d="M13 6V22A9 3 0 0 0 31 22V6A9 3 0 0 0 13 6Z"/><path d="M13 6A9 3 0 0 0 31 6M23 10 19 16H24L21 22"/>'
        }
    },
    bucket: {
        w: 0.6, h: 0.65, text: 'Files', fixedSize: true, txt: {y: -0.3, w: 3.6, h: 0.38}, geo: bucketGeo,
        palette: {
            label: 'Storage bucket', title: 'Storage bucket: a pail for files and blobs',
            icon: '<path d="M11 6 15 24A7 2 0 0 0 29 24L33 6"/><ellipse cx="22" cy="6" rx="11" ry="3"/>'
        }
    },
    phone: {
        w: 0.4, h: 0.7, text: 'Phone', fixedSize: true, txt: {y: -0.27, w: 6, h: 0.35}, geo: phoneGeo,
        palette: {
            label: 'Phone', title: 'Phone: a mobile device (the mobile wireframe is the screen to draw on)',
            icon: '<rect x="16" y="2" width="12" height="24" rx="2"/><path d="M17.5 5H26.5V22H17.5ZM20.5 3.5H23.5"/>'
        }
    },
    service: {
        w: 0.7, h: 0.6, text: 'Service', fixedSize: true, txt: UNDER, geo: serviceGeo,
        palette: {
            label: 'Service', title: 'Service: a hexagon, for one service among many',
            icon: '<path d="M16 4H28L34 14 28 24H16L10 14Z"/>'
        }
    },
    script: {
        w: 0.9, h: 1.3, text: 'script', txt: {y: 0.62, w: 0.84, h: 0.6}, geo: scriptGeo, langs: LANGS, badge: scriptBadge,
        palette: {
            label: 'Script', title: 'Script: a file with its language\'s extension in the corner ([lang=py])',
            icon: '<path d="M8 3H28L36 11V25H8Z"/><path d="M28 3V11H36"/>'
        }
    },
} satisfies Record<string, ShapeDef>
