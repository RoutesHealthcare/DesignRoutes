/* The shapes folder's front door: everything outside src/shapes imports from here.
   Files inside the folder import from the specific file instead (./registry, ./build, ...), never from here, so
   there's no import loop: this file imports them, and none of them imports it. */
export {
    SHAPES,
    PALETTE,
    isShapeKind,
    isChartKind,
    isPartKind,
    isContainerKind,
    CONTAINER,
    TABLE,
    tableHeight,
    GRID,
    gridHeight,
    ringPct,
    segmentsOf,
    CHART_SAMPLES,
    PLAIN_VALUES_PROBLEM,
    cellValues,
    formatValues,
    parseValues,
    valuesCell,
    valuesPerPoint,
    valuesProblem
} from './registry'
export type {ShapeKind, ShapeDef, PaletteEntry, PaletteItem} from './registry'
export type {ChartValues} from './types'
export {roleOf, setRole} from './roles'
export {SERIES_FILLS, coloursOf, seriesFill, shaded} from './series'
export {applySize} from './resize'
export {LIFELINE_HEAD} from './uml'
export {buildConnector, buildShape, ensureShapes, nextId} from './build'
export {addTable, buildTable, isTable, resizeTable, tableParts} from './table'
export type {TableParts} from './table'
export {addGrid, buildGrid, gridIds, gridParts, isGrid, resizeGrid} from './grid'
export type {GridParts} from './grid'
export {addConnector, addShape, pxToIn} from './add'
export {PATTERNS, PATTERN_GROUPS, patternLines} from './patterns'
export type {Pattern, PatternGroup} from './patterns'
export {searchPalette} from './search'
export type {PaletteMatch} from './search'
