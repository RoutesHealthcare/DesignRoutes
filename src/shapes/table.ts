import {NS, S, cellEl, kid, kids, mk, setCell, snapIn, toast} from '../engine/core.js'
import {numEl} from '../engine/visio-package'
import {pageCtx, render} from '../engine/render'
import {refreshFor} from '../engine/connectors'
import {commit} from '../engine/document'
import {TABLE, tableHeight, type ShapeKind} from './registry'
import {roleOf, setRole} from './roles'
import {buildShape, ensureShapes, nextId} from './build'

/* ---------- database tables: a group holding a header shape and one shape per column ---------- */

/* True for a table group. Also tells TypeScript that el is an Element (not null) wherever it returns true. */
export const isTable = (el: Element | null | undefined): el is Element =>
    !!el && el.getAttribute('Type') === 'Group' && roleOf(el) === 'table'

export type TableParts = { all: Element[], header: Element | null, rows: Element[] }

/* A table's header and rows, the rows top to bottom */
export function tableParts(el: Element): TableParts {
    const all = kids(kid(el, 'Shapes'), 'Shape') as Element[]
    return {
        all,
        header: all.find(c => roleOf(c) === 'tableHeader') || null,
        rows: all.filter(c => roleOf(c) === 'tableRow').sort((a, b) => numEl(b, 'PinY', 0) - numEl(a, 'PinY', 0)),
    }
}

/* Build a table group with ids firstId, firstId+1, ...; L,B,W in page inches */
export function buildTable(doc: XMLDocument, firstId: number, L: number, B: number, W: number, name: string, columns: string[]): Element {
    const {headerH, rowH} = TABLE, H = headerH + rowH * columns.length
    let next = firstId
    const g: Element = mk(doc, 'Shape', {
        ID: String(next++),
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
    setRole(g, 'table')
    const inner = doc.createElementNS(NS, 'Shapes')
    g.appendChild(inner)
    const part = (kind: ShapeKind, b: number, h: number, text: string) => inner.appendChild(buildShape(doc, kind, String(next++), 0, b, W, h, text))
    part('tableHeader', H - headerH, headerH, name)
    columns.forEach((col, i) => part('tableRow', H - headerH - rowH * (i + 1), rowH, col))
    return g
}

/* Adds a new table centred on x,y (page inches) and returns its id */
export function addTable(x: number, y: number): string {
    const doc: XMLDocument = pageCtx().doc, H = tableHeight(TABLE.columns.length), id = nextId(doc)
    ensureShapes(doc).appendChild(buildTable(doc, +id, snapIn(x - TABLE.w / 2), snapIn(y - H / 2), TABLE.w, 'table_name', TABLE.columns))
    return id
}

/* Grow or shrink a table by one row at the bottom, keeping its top edge fixed */
export function resizeTable(id: string, add: boolean): void {
    const el = S.elById[id]
    if (!isTable(el)) return
    const {all, rows} = tableParts(el), last = rows[rows.length - 1]
    if (!add && rows.length <= 1) {
        toast('A table needs at least one row.');
        return
    }
    const rh = last ? numEl(last, 'Height', TABLE.rowH) : TABLE.rowH, d = add ? rh : -rh
    const W = numEl(el, 'Width', TABLE.w), H = numEl(el, 'Height', 1),
        bottom = numEl(el, 'PinY', 0) - numEl(el, 'LocPinY', H / 2), nH = H + d
    commit(() => {
        if (!add) last.remove()
        for (const c of all) if (add || c !== last) setCell(c, 'PinY', numEl(c, 'PinY', 0) + d)
        setCell(el, 'Height', nH);
        setCell(el, 'LocPinY', nH / 2, 'Height*0.5');
        setCell(el, 'PinY', bottom - d + nH / 2)
        if (add) {
            const doc: XMLDocument = pageCtx().doc, r = buildShape(doc, 'tableRow', nextId(doc), 0, 0, W, rh, 'column')
            const shapes: Element | null = kid(el, 'Shapes')   // a table group always has its Shapes
            shapes?.appendChild(r)
        }
        render();
        refreshFor(id)
    })
}
