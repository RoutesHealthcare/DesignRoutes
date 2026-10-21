/* ---------- palette ---------- */
/* What the palette's buttons do; the buttons themselves are in components/Palette.tsx. A shape button adds its
   shape in the middle of the view when clicked, or where it's dropped when dragged onto the page (Stage.tsx).
   The current tool (select or connect) is a tiny store, so the Connect button can show whether it's on. */
import {PX, S, stage, svg} from './core.js';
import {pageCtx, render} from './render';
import {containerAt, growToFit, setContainer, withMembers} from './containers';
import {commit, editDoc} from './document';
import {select} from './selection';
import {userV} from './flow/model';
import {addSteps} from './flow/language';
import {addShape, PATTERNS, patternLines, type ShapeKind} from '../shapes';
import type {Tool} from './editorState';

/* The drag data type a palette button's kind travels under, so a drop can tell it from a file */
export const SHAPE_DRAG = 'text/x-shape';

/* The palette shape being dragged, if any. A real drag goes through the operating system's drag and drop, which
   can lose the custom SHAPE_DRAG data on the way (Chrome on Windows does), so a drop reads this first. */
let draggedShape: ShapeKind | null = null;
export const setDraggedShape = (kind: ShapeKind | null) => {
    draggedShape = kind;
};
export const getDraggedShape = () => draggedShape;

/* The same for a ready-made pattern (shapes/patterns.ts), by its name */
export const PATTERN_DRAG = 'text/x-pattern';
let draggedPattern: string | null = null;
export const setDraggedPattern = (name: string | null) => {
    draggedPattern = name;
};
export const getDraggedPattern = () => draggedPattern;

const toolListeners = new Set<() => void>();

export const getTool = (): Tool => S.tool;

/* For useSyncExternalStore: calls back whenever the tool changes, and returns how to stop */
export function subscribeTool(listener: () => void) {
    toolListeners.add(listener);
    return () => {
        toolListeners.delete(listener);
    };
}

export function setTool(t: Tool) {
    S.tool = t;
    stage.classList.toggle('connect', t === 'connect');   // the stage's classes are shared with pointer.ts, so set here, not by React
    toolListeners.forEach(l => l());
}

/* Adds a shape centred on (x, y), in page inches, and selects it, as one undo step. Dropped on a container, it
   goes inside it. */
export function placeShape(kind: ShapeKind, x: number, y: number) {
    setTool('select');
    commit(() => {
        const id = addShape(kind, x, y), pg = pageCtx();
        S.sel = id;
        render();   // the new shape needs drawing before it can be looked up and measured
        const el = S.elById[id], c = containerAt(x * PX, (pg.h - y) * PX, new Set(withMembers([id])));
        if (el && c && setContainer(el, c)) growToFit(el);
    });
}

/* The middle of the visible canvas, in page inches (y counts up from the bottom of the page) */
function viewCentre() {
    const r = svg.getBoundingClientRect();
    const px = (r.width / 2 - S.panX) / S.zoom, py = (r.height / 2 - S.panY) / S.zoom;
    return {x: px / PX, y: pageCtx().h - py / PX};
}

/* What clicking a palette shape does */
export function placeInView(kind: ShapeKind) {
    const c = viewCentre();
    placeShape(kind, c.x, c.y);
}

/* What clicking a pattern does (a login form, a settings page, ...; shapes/patterns.ts) */
export function placePatternInView(name: string) {
    const c = viewCentre();
    placePattern(name, c.x, c.y);
}

/* Adds a pattern centred on (x, y), in page inches (y counts up from the bottom), where it was dropped or the middle
   of the view: its lines go in at the end of the current page's text and its steps into the @animation block, as
   one undo step, and its outermost container is selected, so the whole pattern can be dragged at once. Its ids are
   kept clear of every page's, not just this one's, as a step's $id must name one shape in the whole file. */
export function placePattern(name: string, cx: number, cy: number) {
    const ast = S.ast, p = PATTERNS.find(q => q.name === name), ap = ast?.pages[S.pi];
    if (!ast || !p || !ap) return;
    setTool('select');
    const x = cx * 25.4 - p.w / 2, y = (pageCtx().h - cy) * 25.4 - p.h / 2;
    const {lines, id, ids} = patternLines(p, x, y, new Set(ast.pages.flatMap(q => q.shapes.map(d => d.id))));
    const L = S.text.split('\n');
    let at = ast.animation && ast.animation.start <= ap.endLine ? ast.animation.start - 1 : ap.endLine;   // above the block
    while (at > (ap.headerLine ?? -1) && !L[at].trim()) at--;   // straight after the page's last line, as an import does
    L.splice(at + 1, 0, '', ...lines);
    const text = L.join('\n');
    editDoc(p.animation?.length ? addSteps(text, p.animation, ids) : text, S.pi, true);
    const el = Object.values(S.elById).find(e => userV(e, 'FlowId') === id);
    if (el) select(el.getAttribute('ID'));
}
