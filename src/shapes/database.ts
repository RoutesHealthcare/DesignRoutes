import type {ShapeDef} from './types'
import {RECT, arcPts, fracGeo} from './geometry'
import {ACCENT, DEF} from '../engine/colours'

/* How far the top and bottom ellipses of the cylinder reach in, as a fraction of the height */
const CYL = 0.12

/* A new table from the palette: its width, header and row heights, starting columns and header colour */
export const TABLE = {w: 2, headerH: 0.35, rowH: 0.3, columns: ['id', 'name', 'created_at'], headerFill: ACCENT}
export const tableHeight = (cols: number) => TABLE.headerH + TABLE.rowH * cols

export const databaseShapes = {
    database: {
        w: 1.2, h: 1.1, txt: {y: 0.44, h: 0.7}, geo: fracGeo(
            {pts: [[0, 1 - CYL], [0, CYL], ...arcPts(0.5, CYL, 0.5, CYL, 180, 360).slice(1), [1, 1 - CYL], ...arcPts(0.5, 1 - CYL, 0.5, CYL, 0, 180).slice(1)]},
            {noFill: 1, pts: arcPts(0.5, 1 - CYL, 0.5, CYL, 180, 360)}),
        palette: {
            label: 'Database',
            icon: '<path d="M10 6V22A12 3.5 0 0 0 34 22V6A12 3.5 0 0 0 10 6Z"/><path d="M10 6A12 3.5 0 0 0 34 6"/>'
        }
    },
    /* A table is a group (see buildTable in table.ts): a header shape and one row shape per column */
    table: {
        w: TABLE.w, h: tableHeight(TABLE.columns.length), table: true,
        palette: {
            label: 'Table',
            icon: '<path d="M6 4H38V24H6Z"/><path d="M6 10H38M6 15H38M6 20H38"/>'
        }
    },
    tableHeader: {
        w: TABLE.w,
        h: TABLE.headerH,
        fill: TABLE.headerFill,
        textColour: DEF.textOnDark,
        bold: true,
        geo: fracGeo({pts: RECT})
    },
    tableRow: {w: TABLE.w, h: TABLE.rowH, align: 0, geo: fracGeo({pts: RECT})},
} satisfies Record<string, ShapeDef>
