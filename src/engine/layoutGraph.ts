import type {LayoutNode} from "./layoutNode";

export type LayoutGraph = {
    nodes: LayoutNode[],
    edges: { from: string, to: string }[],
    positioned?: boolean,
    direction?: string
};