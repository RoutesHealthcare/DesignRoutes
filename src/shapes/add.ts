import {NS, PX, S, snapIn} from '../engine/core.js'
import {pageCtx, render} from '../engine/render'
import {centreOf, refreshConnector, setGlue} from '../engine/connectors'
import {CONN, setEdgeStyle, setUser, userV} from '../engine/flow/model'
import {uniqueFid} from '../engine/flow/language'
import {CONTAINER, SHAPES, type ShapeKind} from './registry'
import {buildConnector, buildShape, ensureShapes, nextId} from './build'
import {addTable} from './table'
import {addGrid} from './grid'

/* ---------- adding shapes and connectors to the current page ---------- */

/* Adds a shape centred on x,y (page inches), snapped to the grid, and returns its id. Tables and grids are groups,
   built by their own add functions. */
export function addShape(kind: ShapeKind, x: number, y: number): string {
    const T = SHAPES[kind]
    if (T.table) return addTable(x, y)
    if (T.grid) return addGrid(x, y)
    const doc: XMLDocument = pageCtx().doc, id = nextId(doc), W = T.w, H = T.h, L = snapIn(x - W / 2),
        B = snapIn(y - H / 2)
    const el = ensureShapes(doc).appendChild(buildShape(doc, kind, id, L, B, W, H))
    if (kind === 'pool') addLanes(doc, el, L, B, W, H)
    return id
}

/* A new pool comes with two lanes in it, stacked down its height beside its header. The lanes name the pool, so
   it's given its FlowId now rather than when the text is written. */
function addLanes(doc: XMLDocument, pool: Element, L: number, B: number, W: number, H: number) {
    const used = new Set([...doc.getElementsByTagNameNS(NS, 'Shape')].map(s => userV(s, 'FlowId')).filter((f): f is string => !!f))
    const fid = uniqueFid('pool', used), d = CONTAINER.header, h = H / 2
    setUser(pool, 'FlowId', fid)
    for (const [i, name] of ['Lane 1', 'Lane 2'].entries()) {
        const lane = buildShape(doc, 'lane', nextId(doc), L + d, B + H - (i + 1) * h, W - d, h, name)
        setUser(lane, 'FlowIn', fid)
        ensureShapes(doc).appendChild(lane)
    }
}

/* A point on screen (pixels, y down) as page inches (y up); pg.h is the page height in inches */
export const pxToIn = (q: [number, number], pg: { h: number }): [number, number] => [q[0] / PX, pg.h - q[1] / PX]

/* Adds a connector from shape fromId, either to shape toId or, with no toId, ending loose at endIn (page inches).
   beginPt, endPt: the snap points it's attached to ('n', 'e', 's', 'w'), if any. Returns its id. */
export function addConnector(fromId: string, toId: string | null | undefined, endIn: [number, number], beginPt?: string, endPt?: string): string {
    const pg = pageCtx(), doc: XMLDocument = pg.doc, id = nextId(doc)
    const el = buildConnector(doc, id, pxToIn(centreOf(fromId), pg), endIn)
    setEdgeStyle(el, S.newConn ?? CONN.flow)   // newConn is set when the panel starts; a plain sequence otherwise
    ensureShapes(doc).appendChild(el)
    if (beginPt) setUser(el, 'FlowBeginPt', beginPt)
    if (endPt) setUser(el, 'FlowEndPt', endPt)
    setGlue(id, 'Begin', fromId)
    if (toId) setGlue(id, 'End', toId)
    render();
    refreshConnector(id)
    return id
}
