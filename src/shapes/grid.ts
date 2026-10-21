import {NS, S, cellEl, kid, kids, mk, snapIn, toast} from '../engine/core.js'
import {numEl, shapeCtx, shapeText} from '../engine/visio-package'
import {pageCtx, render} from '../engine/render'
import {refreshFor} from '../engine/connectors'
import {setUser, userV} from '../engine/flow/model'
import {commit} from '../engine/document'
import {GRID, gridHeight} from './registry'
import {roleOf, setRole} from './roles'
import {buildShape, ensureShapes, nextId} from './build'

/* ---------- wireframe grids: a group holding one shape per cell, each tagged with its row and column ---------- */

/* True for a grid group. Also tells TypeScript that el is an Element (not null) wherever it returns true. */
export const isGrid = (el: Element | null | undefined): el is Element =>
    !!el && el.getAttribute('Type') === 'Group' && roleOf(el) === 'grid'

export type GridParts = { all: Element[], rows: Element[][] }

/* The cell shapes as rows of columns, from the row,column tag each cell carries (FlowCell) */
export function gridParts(el: Element): GridParts {
    const all = kids(kid(el, 'Shapes'), 'Shape') as Element[], rows: Element[][] = []
    for (const c of all) {
        const [r, k] = String(userV(c, 'FlowCell') || '').split(',').map(Number)
        if (!(r >= 0 && k >= 0)) continue
            ;
        (rows[r] = rows[r] || [])[k] = c
    }
    // A missing row or cell leaves a hole in the arrays; filter(Boolean) closes it up
    return {all, rows: rows.filter(Boolean).map(r => r.filter(Boolean))}
}

/* Build a grid group with ID gid and cell ids firstId, firstId+1, ...; L,B,W in page inches.
   cells is an array of rows, each an array of cell texts; the first row is the header. */
export function buildGrid(doc: XMLDocument, gid: string | number, firstId: number, L: number, B: number, W: number, cells: string[][]): Element {
    const nr = cells.length, nc = Math.max(1, ...cells.map(r => r.length)), H = gridHeight(nr), cw = W / nc
    let next = firstId
    const g: Element = mk(doc, 'Shape', {
        ID: String(gid),
        Type: 'Group',
        LineStyle: '0',
        FillStyle: '0',
        TextStyle: '0'
    })
    const C = (n: string, v: number | string, f?: string | null, u?: string) => g.appendChild(cellEl(doc, n, v, f, u))
    C('PinX', L + W / 2, null, 'MM');
    C('PinY', B + H / 2, null, 'MM');
    C('Width', W, null, 'MM');
    C('Height', H, null, 'MM')
    C('LocPinX', W / 2, 'Width*0.5', 'MM');
    C('LocPinY', H / 2, 'Height*0.5', 'MM');
    C('Angle', 0, null, 'DEG');
    C('FlipX', 0);
    C('FlipY', 0)
    setRole(g, 'grid')
    const inner = doc.createElementNS(NS, 'Shapes')
    g.appendChild(inner)
    cells.forEach((row, r) => {
        for (let k = 0; k < nc; k++) {
            const c = buildShape(doc, r ? 'gridCell' : 'gridHead', String(next++), k * cw, H - (r + 1) * GRID.rowH, cw, GRID.rowH, row[k] ?? '')
            setUser(c, 'FlowCell', `${r},${k}`)
            inner.appendChild(c)
        }
    })
    return g
}

/* How many shape IDs a grid of these cells uses: one for the group, one per cell */
export const gridIds = (cells: string[][]) => 1 + cells.length * Math.max(1, ...cells.map(r => r.length))

/* Adds a new grid centred on x,y (page inches) and returns its id */
export function addGrid(x: number, y: number): string {
    const doc: XMLDocument = pageCtx().doc, cells = GRID.cells, W = GRID.colW * cells[0].length,
        H = gridHeight(cells.length), id = nextId(doc)
    ensureShapes(doc).appendChild(buildGrid(doc, id, +id + 1, snapIn(x - W / 2), snapIn(y - H / 2), W, cells))
    return id
}

/* Adds or removes the last row (axis 'row') or column (axis 'col') of a grid, keeping its top-left corner where it is.
   The group keeps its ID, so connections stay glued to it. */
export function resizeGrid(id: string, axis: 'row' | 'col', add: boolean): void {
    const el = S.elById[id]
    if (!isGrid(el)) return
    const cells: string[][] = gridParts(el).rows.map(r => r.map(c => shapeText(shapeCtx(c, null))))
    const nc = Math.max(1, ...cells.map(r => r.length))
    if (!add && (axis === 'row' ? cells.length : nc) <= 1) {
        toast(`A grid needs at least one ${axis === 'row' ? 'row' : 'column'}.`);
        return
    }
    if (axis === 'row') {
        if (add) cells.push(Array(nc).fill('')); else cells.pop()
    } else for (const [r, row] of cells.entries()) {
        while (row.length < nc) row.push('')
        if (add) row.push(r ? '' : `Column ${nc + 1}`); else row.pop()
    }
    const W = numEl(el, 'Width', 1), H = numEl(el, 'Height', 1)
    const L = numEl(el, 'PinX', 0) - numEl(el, 'LocPinX', W / 2),
        top = numEl(el, 'PinY', 0) - numEl(el, 'LocPinY', H / 2) + H
    const nW = axis === 'col' ? W * (nc + (add ? 1 : -1)) / nc : W, nH = gridHeight(cells.length)
    commit(() => {
        const doc: XMLDocument = pageCtx().doc, g = buildGrid(doc, id, +nextId(doc), L, top - nH, nW, cells),
            fid = userV(el, 'FlowId')
        if (fid) setUser(g, 'FlowId', fid)
        el.replaceWith(g)
        render();
        refreshFor(id)
    })
}
