/* The parts of the graph model (formats/export.ts) that layout reads and writes. Sizes and positions are in
   inches; a node can arrive without them, and layoutGraph fills them in. */
export type LayoutNode = {
    id: string,
    kind: string,
    w: number,
    h: number,
    x: number,
    y: number,
    columns?: unknown[],
    cells?: string[][]
};