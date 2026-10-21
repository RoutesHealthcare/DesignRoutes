/* Every shape type, merged from the group files. The order is the order of shape suggestions in the text pane
   (FLOW_KINDS in src/js/flow/language.ts), so it follows the palette. To add a shape, see ShapesPlan.md. */
import type {PaletteEntry, ShapeDef} from './types'
import {flowchartShapes} from './flowchart'
import {databaseShapes} from './database'
import {wireframeShapes} from './wireframe'
import {chartShapes} from './charts'
import {systemsShapes} from './systems'
import {containerShapes} from './containers'
import {planningShapes} from './planning'
import {umlShapes} from './uml'
import {bpmnShapes} from './bpmn'


const ALL = {
    ...flowchartShapes,
    ...databaseShapes,
    ...wireframeShapes,
    ...chartShapes,
    ...systemsShapes,
    ...containerShapes,
    ...planningShapes,
    ...umlShapes,
    ...bpmnShapes,
}

/* 'process' | 'decision' | ...: the real shape names, worked out from the keys above */
export type ShapeKind = keyof typeof ALL

export const SHAPES: Record<ShapeKind, ShapeDef> = ALL

/* True for a real shape name. Object.hasOwn, not `in`: 'toString' in SHAPES is true too. */
export const isShapeKind = (k: unknown): k is ShapeKind => typeof k === 'string' && Object.hasOwn(SHAPES, k)

/* The palette, built from the shapes' own palette entries: one group per shape file, in the order above */
export type PaletteItem = PaletteEntry & { kind: ShapeKind }
const onPalette = (shapes: Record<string, ShapeDef>): PaletteItem[] =>
    Object.entries(shapes).flatMap(([kind, d]) => d.palette ? [{kind: kind as ShapeKind, ...d.palette}] : [])
const group = (name: string, shapes: Record<string, ShapeDef>, open = false) =>
    ({name, open, items: onPalette(shapes).filter(i => !i.pinned)})
export const PALETTE = {
    pinned: onPalette(ALL).filter(i => i.pinned),
    groups: [
        group('Flowchart', flowchartShapes, true),
        group('Database', databaseShapes),
        group('UI wireframe', wireframeShapes),
        group('BI / dashboards', chartShapes),
        group('Systems', systemsShapes),
        group('Containers', containerShapes),
        group('Planning', planningShapes),
        group('UML', umlShapes),
        group('BPMN', bpmnShapes),
    ],
}

export const isChartKind = (k: unknown) => isShapeKind(k) && SHAPES[k].chart

/* A frame other shapes can be inside: container, pool, lane */
export const isContainerKind = (k: unknown) => isShapeKind(k) && !!SHAPES[k].container

/* Shapes that only exist inside a table or grid, never on their own */
export const isPartKind = (k?: string | null) => /^(table(Header|Row)|grid(Head|Cell))$/.test(k || '')

export {TABLE, tableHeight} from './database'
export {GRID, gridHeight, ringPct, segmentsOf} from './wireframe'
export {CONTAINER} from './containers'
export {
    CHART_SAMPLES,
    PLAIN_VALUES_PROBLEM,
    cellValues,
    formatValues,
    parseValues,
    valuesCell,
    valuesPerPoint,
    valuesProblem
} from './charts'
export type {PaletteEntry, ShapeDef} from './types'
