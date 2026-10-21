import type {Box, Pt} from "./core";
import type {Page} from "./page";
import type JSZip from "jszip";
import type {FlowAst} from "./flow/language";
import type {Geo} from "./flow/sync";

export type Tool = 'select' | 'connect';
export type EditorState = {
    // file
    zip: JSZip | null,              // the open .vsdx, while visio-io reads one
    name: string,
    handle: FileSystemFileHandle | null,
    dirty: boolean,
    // document
    text: string,
    ast: FlowAst | null,            // the flow parser's output; null until the first parse
    pages: Page[],
    pi: number,                     // index of the current page
    built: Map<string, Geo>[],      // per page: where buildModel drew each shape, by FlowId (flow/sync.ts)
    masters: Record<string, { byId: Record<string, Element>, top: Element | null, name: string }>,
    styles: Record<string, Element>,
    pagesDoc?: Document,            // only set for an opened .vsdx
    pagesPart?: string,
    undo: { text: string, pi: number }[],
    redo: { text: string, pi: number }[],
    // view
    zoom: number, panX: number, panY: number,
    tool: Tool,
    // selection and editing
    sel: string | null,
    selection: Set<string>,
    hover: string | null,
    editing: string | null,
    newConn?: { style: string, start: string, end: string, route?: string | null },
    // present mode (present.ts): the step shown, 0 for the base diagram, and a name for each, Start first. While it is
    // set, the canvas shows that step, not the text, so nothing may write the canvas back into the text.
    present: { at: number, labels: string[] } | null,
    // drawn geometry, rebuilt on every render
    boxes: Record<string, Box>,
    polys: Record<string, Pt[][]>,
    lines: Record<string, Pt[][]>,
    elById: Record<string, Element>,
};