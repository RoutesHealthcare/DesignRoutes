/* ---------- the language ---------- */
import {
    formatValues,
    GRID,
    gridHeight,
    isChartKind,
    isContainerKind,
    isPartKind,
    parseValues,
    type ChartValues,
    type ShapeKind,
    SHAPES,
    tableHeight,
    valuesProblem
} from '../../shapes';
import {clampN} from '../formats/export';
import {sizeFor} from '../layout';
import type {Pt} from '../core';
import {
    CARD_L,
    CARD_L_TOK,
    CARD_R,
    CARD_R_TOK,
    CONN,
    type EdgeStyle,
    isLineStyle,
    isMarker,
    type LineStyle,
    type Marker,
    MARKERS,
    parseVia,
    resolveType,
    viaToStr
} from './model';
import {ShapeKinds} from "./shape-kinds";
import {LangAliases} from "./lang-aliases";
import {resolveFace} from "./face-aliases";
import {playSteps} from "./animation";

/* ---------- what parseFlow returns ---------- */
/* A position in mm from the top-left of the page; w and h are null when the text gives only x,y */
export type Place = { x: number, y: number, w: number | null, h: number | null };
/* A size in mm with no position (WxH on its own): an automatically placed shape, or a flexi container's member */
export type Dims = { w: number, h: number };
/* How a flexi container lines up its members */
export type FlowDir = 'row' | 'column';
export type FlowAlign = 'start' | 'center' | 'end' | 'stretch';
/* The settings in [ ]: shapes use fill to state, connections stroke to endpt. Colours are #RRGGBB, upper case. */
export type Attrs = {
    fill?: string,
    stroke?: string,
    text?: string,
    weight?: number,
    size?: number,
    icon?: string,
    state?: string,
    side?: string,        // a chat bubble: left (the default) or right
    bg?: string,          // a chart or frame shape: whether its backdrop is filled, on (the default) or off
    bgfill?: string,      // ... the backdrop's colour, white (the default) unless set
    map?: string,         // a route map: which of its maps it shows (the first is the default)
    lang?: string,        // a script: which language it's in (the first is the default)
    face?: string,        // a mood: which face it pulls (the first is the default)
    colours?: string,     // a chart or legend's series colours, in order: "#AA3377,#228833"
    in?: string,         // the container a shape is inside, by its id
    flow?: FlowDir,       // a flexi container: its members in a row or a column, in text order
    gap?: number,         // ... with this many mm between them
    align?: FlowAlign,    // ... and lined up like this across it
    scroll?: number,      // a scroll area: how far its contents are scrolled along its bar, in mm
    style?: LineStyle,
    start?: Marker,
    end?: Marker,
    means?: string,
    route?: string,
    via?: Pt[],
    beginpt?: string,
    endpt?: string
};
/* Settings as read back off the canvas: null where the shape is at its default, so the statement leaves it out */
export type ShapeAttrs = { [K in keyof Attrs]?: Attrs[K] | null };
/* A shape line (id: kind "label" ...). An implicit shape was never declared, only named by a connection. */
export type ShapeDecl = {
    id: string, kind: ShapeKind, label: string, columns: string[] | null, cells?: string[][] | null,
    values?: ChartValues | null, place: Place | null, dims?: Dims | null, attrs: Attrs, line: number | null,
    implicit?: boolean,
    indent?: number,          // how far the line is indented, in spaces (a tab counts as 4): a mind map topic's depth
    map?: MapPlace            // a topic in a mind map: see checkMindMaps
    seq?: SeqPlace            // a lifeline in a sequence diagram: see checkSequences
};
/* A topic's place in a mind map: the central topic it belongs to, the topic or central topic it hangs off, and whether
   a branch line is drawn for it (not when the text joins it to the map with a connection of its own) */
export type MapPlace = { root: string, parent: string, link: boolean };
/* A lifeline's place in a sequence diagram: the first lifeline of it, and how far along it is (the first is 0) */
export type SeqPlace = { root: string, index: number };
/* A connection line (from token to [settings] : "label"); the token decides style, start and end */
export type FlowEdge = Omit<Attrs, 'stroke' | 'weight'> & {
    from: string, to: string, style: LineStyle, start: Marker, end: Marker, means: string,
    stroke: string | null, weight: number | null, label: string, line: number
};
/* Which way automatic layout places a page: top to bottom, left to right, and so on */
export type Direction = 'TB' | 'LR' | 'BT' | 'RL';
export type FlowKey = { title: string, place: { x: number, y: number } | null, line: number };
export type FlowPage = {
    name: string, size: [number, number] | null, direction: Direction,
    headerLine: number | null,          // null for the page made when the text has no page line
    shapes: ShapeDecl[], byId: Map<string, ShapeDecl>,
    edges: FlowEdge[], edgeByLine: Map<number, FlowEdge>,
    key: FlowKey | null,
    lastShapeLine: number | null, lastEdgeLine: number | null, endLine: number
};
export type FlowError = { line: number, msg: string };
/* Something worth knowing that doesn't stop the text being read: a warning, or a note on something left out */
export type FlowNote = FlowError & { level: 'warning' | 'info' };
/* One line inside an @animation block, as written: what it does, to which id, and (for $id and +id) the rest of it,
   which is read once the shape's type at that step is known (see animation.ts) */
export type AnimOp =
    { op: 'set', id: string, rest: string, line: number } |
    { op: 'hide' | 'show', id: string, line: number } |
    { op: 'add', id: string, kind: string, rest: string, line: number };
export type AnimStep = { n: number, line: number, ops: AnimOp[] };
/* The @animation block: the lines it runs over (end is null when it is never closed) and its steps, in number order */
export type Animation = { start: number, end: number | null, steps: AnimStep[] };
export type FlowAst = {
    pages: FlowPage[], errors: FlowError[], notes: FlowNote[], icons: Map<string, string>,
    animation: Animation | null
};

/* ---------- what the statement writers take: a shape or connection, from the text or from the canvas ---------- */
export type ShapeObj = {
    id: string, kind: string, label?: string, columns?: string[] | null, cells?: string[][] | null,
    values?: ChartValues | null, place?: Place | null, dims?: Dims | null, attrs?: ShapeAttrs
};
export type EdgeObj = EdgeStyle & { from: string, to: string, label?: string };

export let FLOW_KINDS: ShapeKind[];
export const FLOW_ID = /^[A-Za-z_][\w-]*$/;
export const SHAPE_ATTRS = ['fill', 'stroke', 'text', 'weight', 'size', 'icon', 'state', 'side', 'bg', 'bgfill', 'map', 'lang', 'face', 'colours', 'flow', 'gap', 'align', 'scroll', 'in'],
    EDGE_ATTRS = ['style', 'start', 'end', 'stroke', 'weight', 'size', 'text', 'means', 'route', 'via', 'beginpt', 'endpt'];
const SNAP_SIDES = ['n', 'e', 's', 'w'];
/* A connection's end on a side: n, e, s or w for the middle of it, or e@0.3 for a point that far along it (down the
   side for e and w, across for n and s) */
const isEndPoint = (v: string): boolean => {
    const [side, at, ...more] = v.split('@');
    return SNAP_SIDES.includes(side) && !more.length && (at == null || (/^(0|1|0?\.\d+|1\.0+)$/.test(at)));
};
/* A picture, such as a Visio icon kept from an import or one chosen for an image shape: icon web_design "data:image/svg+xml;base64,..."
   Only SVG, PNG and JPEG data URIs are accepted; they are drawn with <image>, which runs no scripts and loads nothing. */
export const ICON_DATA = /^data:image\/(?:svg\+xml|png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
export const MAX_ICON_CHARS = 2e6;
export const iconStmt = (name: string, data: string): string => `icon ${name} ${qs(data)}`;
const qs = (s: unknown): string => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n|[\u2028\u2029]/g, '\\n') + '"';
const unescapeStr = (s: string): string => s.replace(/\\(.)/g, (_, c) => c === 'n' ? '\n' : c);
const mmN = (v: number | null): string => String(Math.round(Number(v) * 10) / 10);

function readString(s: string, p: number): { v: string, end: number } | null {
    let i = p + 1, v = '';
    while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length) {
            v += s[i] + s[i + 1];
            i += 2;
        } else v += s[i++];
    }
    return i < s.length ? {v: unescapeStr(v), end: i + 1} : null;
}

function closeAt(s: string, p: number, ch: string): number {
    let q = false;
    for (let i = p + 1; i < s.length; i++) {
        if (q && s[i] === '\\') {
            i++;
            continue;
        }
        if (s[i] === '"') q = !q; else if (!q && s[i] === ch) return i;
    }
    return -1;
}

export function splitComment(line: string): { code: string, comment: string } {   // # starts a comment at the start of a line or after a space, so colours like fill=#1F6F78 are safe
    let q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q && c === '\\') {
            i++;
            continue;
        }
        if (c === '"') q = !q;
        else if (c === '#' && !q && (i === 0 || /\s/.test(line[i - 1]))) return {
            code: line.slice(0, i),
            comment: line.slice(i)
        };
    }
    return {code: line, comment: ''};
}

function splitList(s: string): string[] {
    const out: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q && c === '\\') {
            cur += c + (s[i + 1] || '');
            i++;
            continue;
        }
        if (c === '"') q = !q;
        if (!q && (c === ';' || c === ',')) {
            out.push(cur);
            cur = '';
        } else cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(Boolean).map(x => /^".*"$/.test(x) ? unescapeStr(x.slice(1, -1)) : x);
}

/* Grid cells: rows split on ";", cells on ",". Unlike a column list, empty cells are kept (written as ""), and short
   rows are padded so every row has the same number of cells. */
function splitGrid(s: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], cur = '', q = false, quoted = false;
    const cell = () => {
        const t = cur.trim();
        row.push(/^".*"$/.test(t) ? unescapeStr(t.slice(1, -1)) : t);
        quoted = quoted || t !== '';
        cur = '';
    };
    const endRow = () => {
        cell();
        if (quoted) rows.push(row);
        row = [];
        quoted = false;
    };
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q && c === '\\') {
            cur += c + (s[i + 1] || '');
            i++;
            continue;
        }
        if (c === '"') q = !q;
        if (!q && c === ',') cell(); else if (!q && c === ';') endRow(); else cur += c;
    }
    endRow();
    const n = Math.max(1, ...rows.map(r => r.length));
    for (const r of rows) while (r.length < n) r.push('');
    return rows;
}

/* A grid as plain text, one row per line, for formats that only carry a label; gridFromText reads it back */
export const gridText = (cells: string[][]): string => cells.map(r => r.join(' | ')).join('\n');
export const gridFromText = (t: unknown): string[][] => {
    const rows = String(t || '').split('\n').map(l => l.split(' | ').map(c => c.trim())),
        n = Math.max(1, ...rows.map(r => r.length));
    for (const r of rows) while (r.length < n) r.push('');
    return rows;
};

function parseAttrs(s: string, allowed: string[], fail: (msg: string) => null): Attrs | null {
    const a: Record<string, string | number | Pt[]> = {},
        re = /([A-Za-z][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|#[^\s,]*(?:,[^\s,]+)+|[^\s,]+)/g;
    let m, rest = s;
    while ((m = re.exec(s))) {
        const k = m[1].toLowerCase();
        let v = m[2], val: string | number | Pt[] = v;   // v: the text as written; val: what is stored
        if (v.startsWith('"')) val = v = unescapeStr(v.slice(1, -1));
        if (!allowed.includes(k)) return fail(`Unknown setting "${m[1]}". Use ${allowed.join(', ')}.`);
        if ((k === 'fill' || k === 'stroke' || k === 'text' || k === 'bgfill') && !/^#[0-9a-f]{6}$/i.test(v)) return fail(`${k} needs a colour like #1F6F78.`);
        if (k === 'weight') {
            const w = +v;
            if (!(w >= 0.25 && w <= 12)) return fail('weight is a line thickness in points, from 0.25 to 12.');
            val = w;
        }
        if (k === 'size') {
            const z = +v;
            if (!(z >= 4 && z <= 96)) return fail('size is a text size in points, from 4 to 96.');
            val = z;
        }
        if (k === 'style' && !isLineStyle(v)) return fail('style is solid, dashed or dotted.');
        if ((k === 'start' || k === 'end') && !isMarker(v)) return fail(`${k} is one of: ${Object.keys(MARKERS).join(', ')}.`);
        if (k === 'route' && v !== 'straight' && v !== 'elbow') return fail('route is straight or elbow.');
        if ((k === 'beginpt' || k === 'endpt') && !isEndPoint(v)) return fail(`${k} is n, e, s or w: the side of the shape the line is anchored to, or a side and how far along it, from 0 to 1, like e@0.3.`);
        if (k === 'state' && v !== 'on' && v !== 'off') return fail('state is on or off.');
        if (k === 'side' && v !== 'left' && v !== 'right') return fail('side is left or right.');
        if (k === 'bg' && v !== 'on' && v !== 'off') return fail('bg is on or off.');
        if (k === 'colours') {   // a list, commas (no quotes needed) or spaces between
            const cs = v.split(/[\s,]+/).filter(Boolean);
            if (!cs.length || cs.length > 12 || cs.some(c => !/^#[0-9a-f]{6}$/i.test(c)))
                return fail('colours lists up to 12 colours, one per series in order, like colours=#AA3377,#228833,#4477AA.');
            val = cs.join(',');
        }
        if (k === 'icon' && !/^[A-Za-z_][\w-]*$/.test(v)) return fail('icon is the name of an icon line, like icon=web_design.');
        if (k === 'in' && !FLOW_ID.test(v)) return fail('in is the id of the container the shape is inside, like in=lane1.');
        if (k === 'flow' && v !== 'row' && v !== 'column') return fail('flow is row or column: which way the container lines up what is in it.');
        if (k === 'align' && !['start', 'center', 'end', 'stretch'].includes(v)) return fail('align is start, center, end or stretch.');
        if (k === 'gap') {
            const g = +v;
            if (!(g >= 0 && g <= 200)) return fail('gap is the space between the shapes in a container, in mm, from 0 to 200.');
            val = g;
        }
        if (k === 'scroll') {
            const by = +v;
            if (!(by >= 0 && by <= 10000)) return fail('scroll is how far a scroll area is scrolled, in mm from the start, like scroll=40.');
            val = by;
        }
        if (k === 'via') {
            const via = parseVia(v) as Pt[] | null;   // parseVia checks every point has two numbers
            if (!via) return fail('via lists bend points in mm from the top-left of the page, like via="40,20 40,60".');
            val = via;
        }
        a[k] = typeof val === 'string' && /^#/.test(val) ? val.toUpperCase() : val;
        rest = rest.replace(m[0], '');
    }
    if (rest.replace(/[\s,]/g, '')) return fail(`Could not read the settings "${rest.trim()}".`);
    return a as Attrs;
}

/* What a shape line says after its type, each part undefined when the line leaves it out */
export type ShapeBody = {
    label?: string, columns?: string[], cells?: string[][], values?: ChartValues, place?: Place, dims?: Dims,
    attrs: Attrs
};

/* Reads the rest of a shape line (label, { list }, @ x,y WxH, WxH, [settings]) for a shape of type kind. Nothing is
   checked against the type here beyond what { } holds; shapeProblem does that. */
export function readShapeBody(kind: ShapeKind, rest: string, fail: (msg: string) => null): ShapeBody | null {
    const o: ShapeBody = {attrs: {}};
    let p = 0;
    while (p < rest.length) {
        const c = rest[p];
        if (/\s/.test(c)) {
            p++;
            continue;
        }
        if (c === '"') {
            const s = readString(rest, p);
            if (!s) return fail('A quoted label is not closed.');
            o.label = s.v;
            p = s.end;
            continue;
        }
        if (c === '{') {
            const e = closeAt(rest, p, '}');
            if (e < 0) return fail(`A ${kind === 'grid' ? 'cell' : 'column'} list is missing its closing }.`);
            if (kind === 'grid') o.cells = splitGrid(rest.slice(p + 1, e));
            else if (isChartKind(kind)) {
                o.values = parseValues(kind, rest.slice(p + 1, e));
                const bad = valuesProblem(kind, o.values);
                if (bad) return fail(bad);
            } else o.columns = splitList(rest.slice(p + 1, e));
            p = e + 1;
            continue;
        }
        if (c === '@') {
            const mm = rest.slice(p).match(/^@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?))?/);
            if (!mm) return fail('A placement looks like @ x,y or @ x,y WxH, in millimetres.');
            o.place = {
                x: clampN(+mm[1], -1e4, 1e4, 0),
                y: clampN(+mm[2], -1e4, 1e4, 0),
                w: mm[3] != null ? clampN(+mm[3], 2, 2000, 40) : null,
                h: mm[4] != null ? clampN(+mm[4], 2, 2000, 20) : null
            };
            p += mm[0].length;
            continue;
        }
        if (/\d/.test(c)) {   // a size with no position: WxH
            const mm = rest.slice(p).match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
            if (!mm) return fail('A size on its own looks like 40x20, in millimetres.');
            o.dims = {w: clampN(+mm[1], 2, 2000, 40), h: clampN(+mm[2], 2, 2000, 20)};
            p += mm[0].length;
            continue;
        }
        if (c === '[') {
            const e = closeAt(rest, p, ']');
            if (e < 0) return fail('A settings list is missing its closing ].');
            const a = parseAttrs(rest.slice(p + 1, e), SHAPE_ATTRS, fail);
            if (!a) return null;
            if (a.lang) a.lang = LangAliases[a.lang] ?? a.lang;   // python -> py, and so on
            if (a.face) a.face = resolveFace(a.face);   // smile, :) -> happy
            Object.assign(o.attrs, a);
            p = e + 1;
            continue;
        }
        return fail(`Unexpected "${rest.slice(p, p + 15).trim()}" in the shape line.`);
    }
    return o;
}

/* What's wrong with setting k, as it is in a, on a shape of type kind, or null if nothing is. a is all of the
   shape's settings, since gap and align need a flow. */
export function attrProblem(kind: ShapeKind, k: string, a: Attrs): string | null {
    const T = SHAPES[kind];
    switch (k) {
        case 'state':
            return T.stateful ? null : 'Only switches, checkboxes, radio buttons and robot checks have a state.';
        case 'side':
            return T.sides ? null : 'Only chat bubbles have a side.';
        case 'bg':
            return T.bg ? null : 'Only charts, frame shapes and containers have a bg.';
        case 'bgfill':
            return T.bg ? null : 'Only charts, frame shapes and containers have a bgfill.';
        case 'map':
            if (!T.maps) return 'Only country maps and route maps have a map.';
            return T.maps[a.map!] ? null : `map is one of: ${Object.keys(T.maps).join(', ')}.`;
        case 'lang':
            if (!T.langs) return 'Only scripts have a language.';
            return T.langs[a.lang!] ? null : `lang is one of: ${Object.keys(T.langs).join(', ')}.`;
        case 'face':
            if (!T.faces) return 'Only moods have a face.';
            return T.faces[a.face!] ? null : `face is one of: ${Object.keys(T.faces).join(', ')}.`;
        case 'colours':
            return T.colours ? null : 'Only charts and legends have colours: one per series.';
        case 'flow':
        case 'gap':
        case 'align':
            if (!isContainerKind(kind)) return 'Only containers, pools and lanes have flow, gap and align.';
            return k !== 'flow' && !a.flow ? 'gap and align go with flow=row or flow=column.' : null;
        case 'scroll':
            return T.scroll ? null : 'Only scroll areas have a scroll.';
    }
    return null;
}

/* What's wrong with a whole shape line for a shape of type kind, or null if nothing is */
export function shapeProblem(kind: ShapeKind, o: ShapeBody): string | null {
    for (const k of SHAPE_ATTRS) if (o.attrs[k as keyof Attrs] != null) {
        const bad = attrProblem(kind, k, o.attrs);
        if (bad) return bad;
    }
    if (o.dims && o.place) return 'Give the size once: @ x,y WxH, or WxH on its own.';
    if (kind === 'grid' && o.label) return 'A grid has no label of its own: its text goes in its cells, like { Name, Email; Ann, ann@example.com }.';
    if (kind !== 'table' && kind !== 'grid' && o.columns) return 'Only tables have a { column; list }, grids a { cell, cell; row } and charts { values }.';
    return null;
}

/* Leaves out settings that are at their default, so they are never written: state=off, side=left, bg=on, white
   bgfill, the first map, language or face, and scroll=0. Only for settings shapeProblem has passed. */
export function dropDefaults(kind: ShapeKind, a: Attrs): void {
    const T = SHAPES[kind], first = (o: Record<string, unknown> | undefined) => o ? Object.keys(o)[0] : undefined;
    if (a.state === 'off') delete a.state;
    if (a.side === 'left') delete a.side;
    if (a.bg === 'on') delete a.bg;
    if (a.bgfill === '#FFFFFF') delete a.bgfill;
    if (a.map && a.map === first(T.maps)) delete a.map;
    if (a.lang && a.lang === first(T.langs)) delete a.lang;
    if (a.face && a.face === first(T.faces)) delete a.face;
    if (a.scroll === 0) delete a.scroll;
}

/* The shape line id: kind ... read into a declaration, or null (and fail called) if it can't be. kindIn is the type
   as written: a type, or one of its aliases. */
export function readShapeLine(id: string, kindIn: string, rest: string, line: number, raw: string,
                              fail: (msg: string) => null): ShapeDecl | null {
    const kind = shapeKindOf(kindIn);
    if (!kind) return fail(`Unknown shape type "${kindIn}". Try: ${FLOW_KINDS.slice(0, 8).join(', ')}…`);
    const o = readShapeBody(kind, rest, fail);
    if (!o) return null;
    const bad = shapeProblem(kind, o);
    if (bad) return fail(bad);
    dropDefaults(kind, o.attrs);
    const columns = kind === 'table' && !o.columns ? ['column'] : o.columns ?? null;
    const cells = kind === 'grid' && !(o.cells && o.cells.length) ? GRID.cells.map(r => [...r]) : o.cells ?? null;
    return {
        id,
        kind,
        label: o.label ?? '',
        columns,
        cells,
        values: o.values || null,
        place: o.place ?? null,
        dims: o.dims ?? null,
        attrs: o.attrs,
        line,
        indent: raw.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length
    };
}

/* A type as written, or one of its aliases, to the type; undefined if it is neither */
export const shapeKindOf = (written: string): ShapeKind | undefined => {
    const k = written.toLowerCase();
    return FLOW_KINDS.find(f => f.toLowerCase() === k) || ShapeKinds[k];
};

/* ---------- the @animation block ----------
   The last thing in a file: steps that restate shapes, played one at a time in present mode (animation.ts)

       @animation start
       step 1
          $order [fill=#C8E6C9]            # change a shape: only what's written changes
          +retry: process "Retry" @ 200,60 # a shape only the animation has
          -$pay                            # hide a shape (its connections hide with it)
       step 2
          +$pay                            # show it again
       @animation end */
export const BLOCK_START = /^@animation\s+start$/i, BLOCK_END = /^@animation\s+end$/i;

/* A $id, +id:, -$id or +$id line (code with no comment, trimmed), or null if it isn't one */
function readStepLine(code: string, line: number): AnimOp | null {
    let m;
    if ((m = code.match(/^\$([A-Za-z_][\w-]*)(?![\w-])(.*)$/))) return {op: 'set', id: m[1], rest: m[2], line};
    if ((m = code.match(/^([-+])\$([A-Za-z_][\w-]*)$/))) return {op: m[1] === '-' ? 'hide' : 'show', id: m[2], line};
    if ((m = code.match(/^\+([A-Za-z_][\w-]*)\s*:\s*([A-Za-z][A-Za-z0-9]*)\b(.*)$/))) return {
        op: 'add', id: m[1], kind: m[2], rest: m[3], line
    };
    return null;
}

/* The block moved back to the end of the text, when something was added after it (a new page, say): the editor's
   own changes keep it last, as it has to be. Text with no block, or nothing after it, comes back as it was. */
export function keepAnimationLast(text: string): string {
    const L = text.split('\n'), code = (l: string) => splitComment(l).code.trim(),
        start = L.findIndex(l => BLOCK_START.test(code(l))),
        end = start < 0 ? -1 : L.findIndex((l, i) => i > start && BLOCK_END.test(code(l)));
    if (end < 0 || !L.slice(end + 1).some(l => l.trim())) return text;
    const after = L.slice(end + 1);
    while (!after[0].trim()) after.shift();
    while (!after[after.length - 1].trim()) after.pop();
    const before = L.slice(0, start);
    while (before.length && !before[before.length - 1].trim()) before.pop();
    return [...before, '', ...after, '', ...L.slice(start, end + 1), ''].join('\n');
}

/* A pattern's own steps (step 1, step 2... and their lines) added to the text's @animation block, numbered on from
   its last step so they play after it, with their $ids renamed by ids (the names the pattern's shapes got on the
   page). A text with no block gets one at the end. */
export function addSteps(text: string, steps: string[], ids: Map<string, string>): string {
    const L = text.split('\n'), code = (l: string) => splitComment(l).code.trim(),
        start = L.findIndex(l => BLOCK_START.test(code(l))),
        end = start < 0 ? -1 : L.findIndex((l, i) => i > start && BLOCK_END.test(code(l)));
    const stepOf = (l: string) => +(code(l).match(/^step\s+(\d+)$/i)?.[1] ?? 0),
        last = start < 0 ? 0 : Math.max(0, ...L.slice(start, end < 0 ? L.length : end).map(stepOf));
    const lines = steps.map(l => renameInStep(l, ids).replace(/^(\s*step\s+)(\d+)/i, (_, s: string, n: string) => s + (+n + last)));
    if (end >= 0) {
        L.splice(end, 0, ...lines);
        return L.join('\n');
    }
    while (L.length && !L[L.length - 1].trim()) L.pop();
    return [...L, '', ...(start < 0 ? ['@animation start'] : []), ...lines, '@animation end', ''].join('\n');
}

function parseConnector(tok: string): { style: LineStyle, start: Marker, end: Marker } | null {
    for (const c of Object.values(CONN)) if (c.token === tok) return {
        style: c.style,
        start: c.start,
        end: c.end
    };
    const m = tok.match(/^([|}][|o])(--|\.\.)([|o][|{])$/);
    if (m) return {style: m[2] === '--' ? 'solid' : 'dashed', start: CARD_L[m[1]], end: CARD_R[m[3]]};
    return null;
}

export function parseFlow(text: string): FlowAst {
    const lines = text.split('\n'),
        ast: FlowAst = {pages: [], errors: [], notes: [], icons: new Map(), animation: null};
    let page: FlowPage | null = null, step: AnimStep | null = null,
        block: 'before' | 'in' | 'after' = 'before';   // where we are with the @animation block
    const newPage = (name: string, line: number | null): FlowPage => {
        page = {
            name,
            size: null,
            direction: 'TB',
            headerLine: line,
            shapes: [],
            byId: new Map(),
            edges: [],
            edgeByLine: new Map(),
            key: null,
            lastShapeLine: null,
            lastEdgeLine: null,
            endLine: line ?? 0
        };
        ast.pages.push(page);
        return page;
    };
    lines.forEach((raw, i) => {
        const code = splitComment(raw).code.trim();
        // the block belongs to no page, so a page ends before it: what's added to a page goes in above the block
        if (block === 'before' && !BLOCK_START.test(code) && page && !/^page\b/i.test(code)) page.endLine = i;
        if (!code) return;
        const fail = (msg: string): null => {
            ast.errors.push({line: i, msg});
            return null;
        };
        let m;
        if (block === 'after') return fail('Nothing can come after @animation end: the animation block is the last thing in the file.');
        if (block === 'in') {
            const a = ast.animation!;
            if (BLOCK_END.test(code)) {
                a.end = i;
                block = 'after';
                return;
            }
            if ((m = code.match(/^step\s+(\d+)$/i))) {
                const n = +m[1];
                if (a.steps.some(s => s.n === n)) return fail(`There is already a step ${n} in the block.`);
                a.steps.push(step = {n, line: i, ops: []});
                return;
            }
            const op = readStepLine(code, i);
            if (!op) return fail('Inside @animation, a line is step N, $id ... to change a shape, +id: type ... to add one, -$id to hide one or +$id to show it again.');
            if (!step) return fail('Start with a step line, like step 1, before what changes in it.');
            step.ops.push(op);
            return;
        }
        if (BLOCK_START.test(code)) {
            ast.animation = {start: i, end: null, steps: []};
            block = 'in';
            return;
        }
        if (BLOCK_END.test(code)) return fail('@animation end has no @animation start above it.');
        if (/^step\s+\d+$/i.test(code) || readStepLine(code, i)) return fail('Step lines only go inside an @animation block: @animation start, then step 1, then what changes.');
        if ((m = code.match(/^flow\s+(\S+)$/i))) {
            if (ast.pages.length) fail('"flow" belongs at the top of the file.'); else if (m[1] !== '1') fail(`This editor reads version 1 flow files, not version ${m[1]}.`);
            return;
        }
        if ((m = code.match(/^icon\s+([A-Za-z_][\w-]*)\s+(.*)$/i))) {
            const s = m[2].startsWith('"') && readString(m[2], 0);
            if (!s || m[2].slice(s.end).trim()) return fail('An icon needs a name and a picture in quotes, like icon server "data:image/svg+xml;base64,...".');
            if (s.v.length > MAX_ICON_CHARS || !ICON_DATA.test(s.v)) return fail('An icon picture must be an SVG, PNG or JPEG data URI.');
            if (ast.icons.has(m[1])) return fail(`The icon "${m[1]}" is defined twice.`);
            ast.icons.set(m[1], s.v);
            return;
        }
        if ((m = code.match(/^page\b\s*(.*)$/i))) {
            const rest = m[1], s = rest.startsWith('"') && readString(rest, 0);
            if (!s) return fail('A page needs a name in quotes, like page "Onboarding".');
            const p = newPage(s.v, i);
            let r = rest.slice(s.end), mm;
            while ((r = r.trim())) {
                if ((mm = r.match(/^size\s+(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i))) {
                    p.size = [clampN(+mm[1], 50, 5000, 297), clampN(+mm[2], 50, 5000, 210)];
                    r = r.slice(mm[0].length);
                } else if ((mm = r.match(/^direction\s+(TB|TD|LR|BT|RL)\b/i))) {
                    const d = mm[1].toUpperCase();
                    p.direction = d === 'TD' ? 'TB' : d as Direction;   // the pattern above only lets these through
                    r = r.slice(mm[0].length);
                } else return fail(`Unexpected "${r.slice(0, 20)}" in the page line. Use size WxH (mm) and direction TB, LR, BT or RL.`);
            }
            return;
        }
        const pg = page ?? newPage('Page-1', null);
        if ((m = code.match(/^key\b(?!\s*:)\s*(.*)$/i))) {
            if (pg.key) return fail('A page has one key.');
            const k: FlowKey = {title: 'Key', place: null, line: i};
            let r = m[1].trim(), mm;
            if (r.startsWith('"')) {
                const s = readString(r, 0);
                if (!s) return fail('The key title is not closed.');
                k.title = s.v;
                r = r.slice(s.end).trim();
            }
            if (r) {
                if (!(mm = r.match(/^@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/))) return fail('A key line looks like key "Key" @ x,y.');
                k.place = {x: +mm[1], y: +mm[2]};
            }
            pg.key = k;
            pg.lastShapeLine = i;
            return;
        }
        if ((m = code.match(/^([A-Za-z_][\w-]*)\s*:\s*([A-Za-z][A-Za-z0-9]*)\b(.*)$/))) {
            const id = m[1];
            if (shapeKindOf(m[2]) && pg.byId.has(id)) return fail(`"${id}" is already used on this page.`);
            const d = readShapeLine(id, m[2], m[3], i, raw, fail);
            if (!d) return;
            pg.shapes.push(d);
            pg.byId.set(id, d);
            pg.lastShapeLine = i;
            return;
        }
        if ((m = code.match(/^([A-Za-z_][\w-]*)\s+(\S+)\s+([A-Za-z_][\w-]*)(.*)$/))) {
            const base = parseConnector(m[2]);
            if (!base) return fail(`"${m[2]}" is not a connection. Try -> for a sequence, -data-> for data flow, ..> for a dependency or ||--o{ for one to many.`);
            if (m[1] === m[3]) return fail('A connection needs two different shapes.');
            const e: FlowEdge = {
                from: m[1],
                to: m[3], ...base,
                means: '',
                stroke: null,
                weight: null,
                label: '',
                line: i
            };
            let r = m[4].trim();
            if (r.startsWith('[')) {
                const end = closeAt(r, 0, ']');
                if (end < 0) return fail('A settings list is missing its closing ].');
                const a = parseAttrs(r.slice(1, end), EDGE_ATTRS, fail);
                if (!a) return;
                Object.assign(e, a);
                r = r.slice(end + 1).trim();
            }
            if (r.startsWith(':')) {
                r = r.slice(1).trim();
                if (r.startsWith('"')) {
                    const s = readString(r, 0);
                    if (!s) return fail('The label is not closed.');
                    e.label = s.v;
                    r = r.slice(s.end).trim();
                } else {
                    e.label = r;
                    r = '';
                }
            }
            if (r) return fail(`Unexpected "${r.slice(0, 15)}" after the connection.`);
            pg.edges.push(e);
            pg.edgeByLine.set(i, e);
            pg.lastEdgeLine = i;
            return;
        }
        fail('This line is not a page, shape, connection or key.');
    });
    if (!ast.pages.length) newPage('Page-1', null).endLine = lines.length - 1;
    const anim = ast.animation as Animation | null;   // set inside the forEach, which TypeScript can't see
    if (anim) {
        if (anim.end == null) ast.errors.push({line: anim.start, msg: '@animation start has no @animation end.'});
        anim.steps.sort((a, b) => a.n - b.n);
    }
    for (const p of ast.pages) checkContainers(p, ast.errors);
    for (const p of ast.pages) checkMindMaps(p);
    for (const p of ast.pages) checkSequences(p);
    /* a connection outside the block can't use a shape only the block has: it isn't a stray process */
    const added = new Set(anim ? anim.steps.flatMap(s => s.ops.filter(o => o.op === 'add').map(o => o.id)) : []);
    for (const p of ast.pages) p.edges = p.edges.filter(e => {
        const id = [e.from, e.to].find(id => !p.byId.has(id) && added.has(id));
        if (!id) return true;
        ast.errors.push({
            line: e.line,
            msg: `"${id}" only exists in the animation (+${id}), so a connection outside it can't use it.`
        });
        p.edgeByLine.delete(e.line);
        return false;
    });
    for (const p of ast.pages) for (const e of p.edges) for (const id of [e.from, e.to]) if (!p.byId.has(id)) {
        const d: ShapeDecl = {
            id,
            kind: 'process',
            label: id,
            columns: null,
            place: null,
            attrs: {},
            line: null,
            implicit: true
        };
        p.shapes.push(d);
        p.byId.set(id, d);
    }
    if (anim) playSteps(ast, anim.steps.length, {report: true});   // only for what it finds wrong
    return ast;
}

/* Mind maps. A topic with no place of its own (no @), after a central topic and before the next, is in that central
   topic's map; it hangs off the nearest topic above it in the map that is indented less, or else the central topic:

       idea: centraltopic "Website"
       goals: topic "Goals"
         signups: topic "More sign-ups"
       users: topic "Users"

   A topic with a place stands on its own. The map lays its topics out round the central topic, so any WxH is all
   they keep. Each gets a branch line from the shape it hangs off, unless the text already joins it to another shape
   in the map with a connection (the way maps were written before), which then shapes the map instead. Central topics
   and topics inside a container aren't in maps. */
export function checkMindMaps(p: FlowPage): void {
    let root: ShapeDecl | null = null;
    const above: ShapeDecl[] = [], members: ShapeDecl[] = [];
    for (const d of p.shapes) {
        if (d.implicit) continue;
        if (d.kind === 'centraltopic' && !d.attrs.in) {
            root = d;
            above.length = 0;
            continue;
        }
        if (d.kind !== 'topic' || !root || d.place || d.attrs.in) continue;
        while (above.length && (above[above.length - 1].indent ?? 0) >= (d.indent ?? 0)) above.pop();
        d.map = {root: root.id, parent: above.length ? above[above.length - 1].id : root.id, link: true};
        above.push(d);
        members.push(d);
    }
    for (const d of members) {
        const inMap = (id: string) => id === d.map!.root || p.byId.get(id)?.map?.root === d.map!.root;
        d.map!.link = !p.edges.some(e => (e.from === d.id && inMap(e.to)) || (e.to === d.id && inMap(e.from)));
    }
}

/* Sequence diagrams. The first lifeline on a page that isn't in a container starts its sequence, and every later one
   with no place of its own (no @) and no container joins it; the same goes for the lifelines inside each container,
   which make a sequence of their own there (not in a flexi container, which lines its members up itself):

       client: lifeline "Client"
       server: lifeline "Server"
       db: lifeline "Database"
       client -> server : "GET /orders"
       server -> db : "query"

   The sequence stands its lifelines side by side in text order, from where the first one is, and the connections
   between two of them become its messages: level arrows, one under another in text order, the lifelines as long as
   they need to be. Only the first lifeline can be given a place; a later one with an @ stands on its own. */
export function checkSequences(p: FlowPage): void {
    const roots = new Map<string, ShapeDecl>(), members = new Map<string, ShapeDecl[]>();   // by container, '' for none
    for (const d of p.shapes) {
        if (d.implicit || d.kind !== 'lifeline') continue;
        const box = d.attrs.in ?? '';
        if (box && p.byId.get(box)?.attrs.flow) continue;
        if (!roots.has(box)) {
            roots.set(box, d);
            members.set(box, []);
        } else if (!d.place) members.get(box)!.push(d);
    }
    for (const [box, root] of roots) {
        const ms = members.get(box)!;
        if (!ms.length) continue;
        root.seq = {root: root.id, index: 0};
        ms.forEach((d, i) => d.seq = {root: root.id, index: i + 1});
    }
}

/* [in=id] must name a container on the same page, and never lead back round to the shape itself. A bad one is
   reported on the member's line and dropped, so the shape is still drawn, just not inside anything. */
export function checkContainers(p: FlowPage, errors: FlowError[]): void {
    for (const d of p.shapes) {
        const fid = d.attrs.in;
        if (!fid) continue;
        const c = p.byId.get(fid);
        let msg = '';
        if (!c || c.implicit) msg = `There is no container "${fid}" on this page.`;
        else if (!isContainerKind(c.kind)) msg = `"${fid}" is a ${c.kind}, not a container, pool or lane, so nothing can be in it.`;
        else for (let up: ShapeDecl | undefined = c, n = 0; up && n <= p.shapes.length; up = up.attrs.in ? p.byId.get(up.attrs.in) : undefined, n++)
                if (up === d) {
                    msg = fid === d.id ? 'A shape cannot be inside itself.' : `"${d.id}" and "${fid}" are each inside the other.`;
                    break;
                }
        if (msg) {
            errors.push({line: d.line ?? 0, msg});
            delete d.attrs.in;
        } else if (c!.attrs.flow && d.place) {   // a flexi container places its members, so a position is only a size
            if (d.place.w != null && d.place.h != null) d.dims = {w: d.place.w, h: d.place.h};
            d.place = null;
        }
    }
}

/* canonical statements: what the editor writes, and how two statements are compared */
const orderedAttrs = (a: Record<string, unknown> | null | undefined, keys: string[]): Record<string, unknown> =>
    Object.fromEntries(keys.filter(k => a && a[k] != null && a[k] !== '').map(k => [k, a![k]]));
const attrStr = (a: Record<string, unknown>): string => {
    const p = Object.entries(a).map(([k, v]) => `${k}=${/^[#\w.]+$|^#\w{6}(,#\w{6})+$/.test(String(v)) ? v : qs(v)}`);   // a colour list needs no quotes
    return p.length ? '[' + p.join(' ') + ']' : '';
};
const colText = (c: string): string => /^[^;,{}"\s#](?:[^;,{}"#]*[^;,{}"\s#])?$/.test(c) ? c : qs(c);

export function shapeStmt(o: ShapeObj): string {
    let s = `${o.id}: ${o.kind}`;
    if (o.label) s += ' ' + qs(o.label);
    if (o.kind === 'table') s += ' { ' + (o.columns || []).map(colText).join('; ') + ' }';
    if (o.kind === 'grid') s += ' { ' + (o.cells || []).map(r => r.map(colText).join(', ')).join('; ') + ' }';
    if (isChartKind(o.kind) && o.values && o.values.length) s += ' { ' + formatValues(o.kind, o.values) + ' }';
    if (o.place) s += ` @ ${mmN(o.place.x)},${mmN(o.place.y)}` + (o.place.w != null ? ` ${mmN(o.place.w)}x${mmN(o.place.h)}` : '');
    else if (o.dims) s += ` ${mmN(o.dims.w)}x${mmN(o.dims.h)}`;
    const a = attrStr(orderedAttrs(o.attrs, SHAPE_ATTRS));
    return a ? s + ' ' + a : s;
}

export function edgeStmt(e: EdgeObj): string {
    const t = resolveType(e), a: Record<string, unknown> = {};
    let tok;
    if (t === 'er') tok = CARD_L_TOK[e.start] + (e.style === 'solid' ? '--' : '..') + CARD_R_TOK[e.end];
    else if (t === 'custom') {
        tok = '--';
        Object.assign(a, {style: e.style, start: e.start, end: e.end});
    } else tok = CONN[t].token;
    const elbow = e.route === 'elbow';
    Object.assign(a, orderedAttrs({
            stroke: e.stroke, weight: e.weight, size: e.size, text: e.text, means: e.means, route: elbow ? 'elbow' : null,
            via: elbow && e.via && e.via.length ? viaToStr(e.via) : null, beginpt: e.beginpt || null, endpt: e.endpt || null
        },
        ['stroke', 'weight', 'size', 'text', 'means', 'route', 'via', 'beginpt', 'endpt']));
    let s = `${e.from} ${tok} ${e.to}`;
    const as = attrStr(a);
    if (as) s += ' ' + as;
    if (e.label) s += ' : ' + qs(e.label);
    return s;
}

export const keyStmt = (k: {
    title?: string,
    place?: { x: number, y: number } | null
}): string => `key ${qs(k.title || 'Key')}` + (k.place ? ` @ ${mmN(k.place.x)},${mmN(k.place.y)}` : '');
export const pageStmt = (p: {
    name: string,
    size?: [number, number] | null,
    direction?: string
}): string => `page ${qs(p.name)}` + (p.size ? ` size ${mmN(p.size[0])}x${mmN(p.size[1])}` : '') + (p.direction && p.direction !== 'TB' ? ` direction ${p.direction}` : '');
export const tableH = (cols: unknown[] | null | undefined): number => tableHeight(Math.max(1, (cols || []).length)) * 25.4;
/* Tables and grids take their height from their rows, so the text only ever records their width */
export const fixedHeight = (kind: string): boolean => kind === 'table' || kind === 'grid';
export const fixedH = (o: {
    kind: string,
    columns?: unknown[] | null,
    cells?: string[][] | null
}): number => o.kind === 'grid' ? gridHeight((o.cells || []).length) * 25.4 : tableH(o.columns);

export function declObj(d: ShapeDecl): ShapeObj {
    if (d.implicit) return {id: d.id, kind: 'process', label: d.id, place: null, attrs: {}};
    const place = d.place ? {...d.place} : null;
    if (place && fixedHeight(d.kind) && place.w != null) place.h = fixedH(d);
    const dims = d.dims ? {w: d.dims.w, h: fixedHeight(d.kind) ? fixedH(d) : d.dims.h} : null;
    return {
        id: d.id,
        kind: d.kind,
        label: d.label || '',
        columns: d.columns,
        cells: d.cells,
        values: d.values,
        place,
        dims,
        attrs: d.attrs
    };
}

export function autoSizeMM(o: Omit<ShapeObj, 'id'>): { w: number, h: number } {   // reads only kind, label, columns and cells
    const s = sizeFor({kind: o.kind, label: o.label || '', columns: o.columns, cells: o.cells});
    return {w: s.w * 25.4, h: fixedHeight(o.kind) ? fixedH(o) : s.h * 25.4};
}

export function uniqueFid(base: unknown, used: Set<string>): string {
    let b = String(base || 'shape').toLowerCase().normalize('NFKD').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'shape';
    if (!/^[a-z_]/.test(b)) b = 's_' + b;
    if (['key', 'page', 'flow'].includes(b)) b += '_1';
    let id = b, n = 2;
    while (used.has(id)) id = `${b}_${n++}`;
    return id;
}

/* ---------- renaming shapes ----------
   ids maps old ids to new ones. Everywhere a statement names a shape follows: a shape line's own id, its [in=] and
   both ends of a connection. Labels, other settings and comments are left as they are, so renaming order doesn't
   touch "Place order". Used to rename a shape (engine/rename.ts) and to give a pattern's shapes ids that are free
   on the page it goes in (shapes/patterns.ts). */
const QUOTED_OR_IN = /"(?:[^"\\]|\\.)*"|(\bin\s*=\s*)("(?:[^"\\]|\\.)*"|[A-Za-z_][\w-]*)/gi;

export function renameInLine(raw: string, ids: Map<string, string>): string {
    const {code, comment} = splitComment(raw), lead = code.match(/^\s*/)![0], c = code.slice(lead.length);
    if (/^(?:flow|icon)\s/i.test(c) || /^page\b/i.test(c) || /^key\b(?!\s*:)/i.test(c)) return raw;
    const to = (id: string) => ids.get(id) ?? id;
    let m;
    if ((m = c.match(/^([A-Za-z_][\w-]*)(?=\s*:\s*[A-Za-z])/)))   // a shape line
        return lead + to(m[1]) + c.slice(m[1].length).replace(QUOTED_OR_IN, (all, key: string | undefined, v: string) => {
            if (!key) return all;   // quoted text: a label or another setting's value
            const id = v.startsWith('"') ? unescapeStr(v.slice(1, -1)) : v, n = ids.get(id);
            return n == null ? all : key + (/^\w+$/.test(n) ? n : qs(n));
        }) + comment;
    if ((m = c.match(/^([A-Za-z_][\w-]*)(\s+\S+\s+)([A-Za-z_][\w-]*)/)))   // a connection
        return lead + to(m[1]) + m[2] + to(m[3]) + c.slice(m[0].length) + comment;
    return raw;
}

/* What's wrong with to as the new id of the shape from on page p, or null if nothing is */
export function idProblem(p: FlowPage, from: string, to: string): string | null {
    if (!FLOW_ID.test(to)) return 'An id starts with a letter or _, then letters, digits, _ or -, like order_2.';
    if (['flow', 'icon', 'key', 'page'].includes(to.toLowerCase())) return `"${to}" starts other kinds of line, so it can't be an id.`;
    if (to !== from && p.byId.has(to)) return `"${to}" is already used on this page.`;
    return null;
}

/* The text with the shapes ids names renamed throughout page pi of ast (parsed from that text) */
export function renameIds(text: string, ast: FlowAst, pi: number, ids: Map<string, string>): string {
    const p = ast.pages[pi], L = text.split('\n'), a = ast.animation;
    for (let i = p.headerLine ?? 0; i <= p.endLine && i < L.length; i++) L[i] = renameInLine(L[i], ids);
    /* the block's $id lines name shapes anywhere in the file, so only ids on this page alone are theirs */
    const here = new Map([...ids].filter(([from]) => ast.pages.every((q, i) => (i === pi) === q.byId.has(from))));
    if (a && here.size) for (let i = a.start; i <= (a.end ?? L.length - 1) && i < L.length; i++) L[i] = renameInStep(L[i], here);
    return L.join('\n');
}

/* renameInLine for a line in the @animation block: the id after $, -$ or +$, and an [in=] */
export function renameInStep(raw: string, ids: Map<string, string>): string {
    const {code, comment} = splitComment(raw);
    return code.replace(/^(\s*[-+]?\$)([A-Za-z_][\w-]*)/, (all, pre: string, id: string) => pre + (ids.get(id) ?? id))
        .replace(QUOTED_OR_IN, (all, key: string | undefined, v: string) => {
            if (!key) return all;
            const id = v.startsWith('"') ? unescapeStr(v.slice(1, -1)) : v, n = ids.get(id);
            return n == null ? all : key + (/^\w+$/.test(n) ? n : qs(n));
        }) + comment;
}

/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init(): void {
    FLOW_KINDS = (Object.keys(SHAPES) as ShapeKind[]).filter(k => !isPartKind(k));
}
