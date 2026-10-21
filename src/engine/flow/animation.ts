/* ---------- playing the @animation block ----------
   Step n of a drawing is its base diagram with steps 1..n applied in order (language.ts reads the block). A step line
   is a shape line: $id restates a shape that already exists, and only what it writes changes; everything left out
   carries over from the step before. +id: adds a shape only the animation has, -$id hides a shape and +$id shows it
   again with the last values it had. Nothing here touches the text: present mode builds the canvas from what
   playSteps returns, and leaving present mode rebuilds it from the text. */
import {GRID, isChartKind, isContainerKind, type ShapeKind, valuesProblem} from '../../shapes';
import {
    attrProblem,
    type Attrs,
    checkContainers,
    checkMindMaps,
    checkSequences,
    dropDefaults,
    type FlowAst,
    type FlowError,
    type FlowPage,
    readShapeBody,
    readShapeLine,
    SHAPE_ATTRS,
    type ShapeDecl,
    shapeKindOf
} from './language';

/* Where a shape was drawn in the base diagram, in mm from the page's top-left, by id (S.built, one map per page) */
export type Pins = Map<string, { x: number, y: number }>[];
/* What playSteps gives back: the pages at that step, and for every step in the block the pages its lines change */
export type Played = { pages: FlowPage[], touched: number[][] };
type Live = { pi: number, d: ShapeDecl, hidden: boolean };

/* The drawing after the first upTo steps. report: put what's wrong with the block in ast.errors and ast.notes (parseFlow
   does this once, playing every step). pins: where the base diagram drew each shape; a shape the layout places is
   pinned there, so a step that moves one shape leaves the others where they were (see pin). */
export function playSteps(ast: FlowAst, upTo: number, opts: { report?: boolean, pins?: Pins } = {}): Played {
    const block = ast.animation, pages: FlowPage[] = structuredClone(ast.pages), touched: number[][] = [];
    const err = (line: number, msg: string): null => {
        if (opts.report) ast.errors.push({line, msg});
        return null;
    };
    const note = (line: number, msg: string, level: 'warning' | 'info') => {
        if (opts.report) ast.notes.push({line, msg, level});
    };
    if (!block) return {pages, touched};
    if (opts.pins) pages.forEach((p, pi) => pin(p, opts.pins![pi]));
    /* the pages each id is on; $id must name one of them only */
    const where = new Map<string, number[]>();
    pages.forEach((p, pi) => p.shapes.forEach(d => where.set(d.id, [...where.get(d.id) ?? [], pi])));
    const live = new Map<string, Live>();
    const find = (id: string, line: number, as: string): Live | null => {
        const l = live.get(id);
        if (l) return l;
        const at = where.get(id) ?? [];
        if (!at.length) return err(line, `There is no shape "${id}" for ${as}${id}.`);
        if (at.length > 1) return err(line, `"${id}" is on more than one page (${at.map(pi => pages[pi].name).join(', ')}), so ${as}${id} can't tell which one it means.`);
        const d = pages[at[0]].byId.get(id);
        if (!d) return null;   // added by a step after upTo, so not there yet
        const made = {pi: at[0], d, hidden: false};
        live.set(id, made);
        return made;
    };

    block.steps.forEach((st, si) => {
        const on = new Set<number>(), apply = si < upTo;
        /* the same shape twice in one step: the last line wins */
        const last = new Map(st.ops.map(o => [o.id, o]));
        for (const o of st.ops) if (last.get(o.id) !== o)
            note(o.line, `"${o.id}" comes up again later in step ${st.n}, so only that later line counts.`, 'warning');
        const ops = st.ops.filter(o => last.get(o.id) === o);
        // a shape added with no container of its own goes on the page of the step's first $ line, or else the first page
        let stepPage: number | null = null;
        for (const o of ops) {
            if (o.op === 'add') continue;
            const l = find(o.id, o.line, o.op === 'set' ? '$' : o.op === 'hide' ? '-$' : '+$');
            if (!l) continue;
            stepPage ??= l.pi;
            on.add(l.pi);
            if (o.op === 'set') {
                if (l.hidden) err(o.line, `"${o.id}" is hidden at this step, so $${o.id} can't change it. Show it again first with +$${o.id}.`);
                else restate(l, o.rest, o.line, pages[l.pi], err, note, apply);
            } else if (o.op === 'hide') {
                if (l.hidden) err(o.line, `"${o.id}" is already hidden at this step.`);
                else if (apply) l.hidden = true;
            } else if (!l.hidden) err(o.line, `+$${o.id} shows a hidden shape, but "${o.id}" isn't hidden at this step.`);
            else if (apply) l.hidden = false;
        }
        for (const o of ops) {
            if (o.op !== 'add') continue;
            if (where.has(o.id)) {
                err(o.line, `"${o.id}" is already a shape, so +${o.id}: can't make a new one. Use $${o.id} to change it.`);
                continue;
            }
            const d = readShapeLine(o.id, o.kind, o.rest, o.line, '', msg => err(o.line, msg));
            if (!d) continue;
            let box = d.attrs.in ? where.get(d.attrs.in) : undefined;
            if (d.attrs.in) {
                const c = box && box.length === 1 ? pages[box[0]].byId.get(d.attrs.in) : undefined;
                if (!box || box.length !== 1 || !c || !isContainerKind(c.kind)) {
                    err(o.line, c ? `"${d.attrs.in}" is a ${c.kind}, not a container, pool or lane, so nothing can be in it.`
                        : `There is no container "${d.attrs.in}" on this page.`);
                    delete d.attrs.in;
                    box = undefined;
                }
            }
            const pi = box && box.length === 1 ? box[0] : stepPage ?? 0;
            where.set(o.id, [pi]);   // so a later step can find it, even one past upTo
            on.add(pi);
            if (!apply) continue;
            pages[pi].shapes.push(d);
            pages[pi].byId.set(d.id, d);
            live.set(o.id, {pi, d, hidden: false});
        }
        touched.push([...on]);
    });
    pages.forEach((p, pi) => settle(p, new Set([...live.values()].filter(l => l.pi === pi && l.hidden).map(l => l.d.id))));
    return {pages, touched};
}

/* A shape the layout places, at the top of its page (no container, mind map or sequence placing it), given the place
   the base diagram drew it at. With nothing placed, a page is laid out in layers; once anything is placed, loose shapes
   go next to what they connect to, which would shuffle the whole page the first time a step placed one shape. */
function pin(p: FlowPage, at: Map<string, { x: number, y: number }> | undefined): void {
    if (!at) return;
    for (const d of p.shapes) {
        const g = at.get(d.id);
        if (!g || d.place || d.attrs.in || d.map || (d.seq && d.seq.root !== d.id)) continue;
        d.place = {x: g.x, y: g.y, w: d.dims?.w ?? null, h: d.dims?.h ?? null};
        d.dims = null;
    }
}

/* Applies a $id line to the shape it names: rest is the line after $id, an optional type and then what any shape line
   can have. Settings it writes that the shape's type (new or not) can't have are errors; ones carried over from before
   that a new type can't have are dropped, with a note. Nothing is changed unless apply. */
function restate(l: Live, rest: string, line: number, page: FlowPage, err: (line: number, msg: string) => null,
                 note: (line: number, msg: string, level: 'info') => void, apply: boolean): void {
    const d = l.d, fail = (msg: string) => err(line, msg);
    let kind: ShapeKind = d.kind;
    const tm = rest.match(/^\s*([A-Za-z][A-Za-z0-9]*)\b/);
    if (tm) {
        const k = shapeKindOf(tm[1]);
        if (!k) return void fail(`Unknown shape type "${tm[1]}". A $id line can start with a new type, then what any shape line has.`);
        kind = k;
        rest = rest.slice(tm[0].length);
    }
    const w = readShapeBody(kind, rest, fail);
    if (!w) return;
    const attrs: Attrs = {...d.attrs, ...w.attrs}, wrote = new Set(Object.keys(w.attrs));
    for (const k of SHAPE_ATTRS) if (wrote.has(k)) {
        const bad = attrProblem(kind, k, attrs);
        if (bad) return void fail(bad);
    }
    if (w.place && w.dims) return void fail('Give the size once: @ x,y WxH, or WxH on its own.');
    if (kind === 'grid' && w.label) return void fail('A grid has no label of its own: its text goes in its cells, like { Name, Email; Ann, ann@example.com }.');
    if (kind !== 'table' && kind !== 'grid' && w.columns) return void fail('Only tables have a { column; list }, grids a { cell, cell; row } and charts { values }.');
    if (w.attrs.in) {
        const c = page.byId.get(w.attrs.in);
        if (!c || c.implicit) return void fail(`There is no container "${w.attrs.in}" on this page.`);
        if (!isContainerKind(c.kind)) return void fail(`"${w.attrs.in}" is a ${c.kind}, not a container, pool or lane, so nothing can be in it.`);
        if (c === d) return void fail('A shape cannot be inside itself.');
    }
    /* what a new type can't keep from before */
    const dropped: string[] = [];
    for (const k of SHAPE_ATTRS) if (!wrote.has(k) && attrs[k as keyof Attrs] != null && attrProblem(kind, k, attrs)) {
        dropped.push(`${k}=${attrs[k as keyof Attrs]}`);
        delete attrs[k as keyof Attrs];
    }
    let label = w.label ?? d.label;
    if (kind === 'grid' && w.label == null && label) {
        dropped.push('its label');
        label = '';
    }
    let columns = w.columns ?? d.columns;
    if (kind === 'table') columns ??= ['column'];
    else if (kind !== 'grid' && columns) {
        dropped.push('its columns');
        columns = null;
    }
    let cells = w.cells ?? d.cells ?? null;
    if (kind !== 'grid' && cells) {
        dropped.push('its cells');
        cells = null;
    }
    if (kind === 'grid' && !(cells && cells.length)) cells = GRID.cells.map(r => [...r]);
    let values = w.values ?? d.values ?? null;
    if (values && !w.values && (!isChartKind(kind) || kind !== d.kind && valuesProblem(kind, values))) {
        dropped.push('its values');
        values = null;
    }
    if (dropped.length) note(line, `As a ${kind}, "${d.id}" can't keep ${dropped.join(', ')} from before, so ${dropped.length > 1 ? 'they are' : 'it is'} left out.`, 'info');
    if (!apply) return;
    /* a place or size left out keeps the one before */
    let place = d.place, dims = d.dims ?? null;
    if (w.place) {
        place = {
            x: w.place.x, y: w.place.y,
            w: w.place.w ?? place?.w ?? dims?.w ?? null, h: w.place.h ?? place?.h ?? dims?.h ?? null
        };
        dims = null;
    }
    if (w.dims) {
        if (place) place = {...place, w: w.dims.w, h: w.dims.h};
        else dims = {...w.dims};
    }
    dropDefaults(kind, attrs);
    Object.assign(d, {kind, label, columns, cells, values, place, dims, attrs});
}

/* A page as it is at a step: hidden shapes out, with what goes with them (the members of a hidden container, the
   topics down a hidden central topic or topic's branch) and every connection to any of them; then the page's
   containers, mind maps and sequences worked out again for what's left */
function settle(p: FlowPage, hidden: Set<string>): void {
    for (const d of p.shapes) {
        delete d.map;
        delete d.seq;
    }
    checkMindMaps(p);
    const gone = new Map<string, boolean>(), out = (d: ShapeDecl | undefined, n = 0): boolean => {
        if (!d || n > p.shapes.length) return false;
        if (gone.has(d.id)) return gone.get(d.id)!;
        const v = hidden.has(d.id) || (!!d.attrs.in && out(p.byId.get(d.attrs.in), n + 1))
            || (!!d.map && out(p.byId.get(d.map.parent), n + 1));
        gone.set(d.id, v);
        return v;
    };
    p.shapes = p.shapes.filter(d => !out(d));
    p.byId = new Map(p.shapes.map(d => [d.id, d]));
    p.edges = p.edges.filter(e => p.byId.has(e.from) && p.byId.has(e.to));
    p.shapes = p.shapes.filter(d => !d.implicit || p.edges.some(e => e.from === d.id || e.to === d.id));
    p.byId = new Map(p.shapes.map(d => [d.id, d]));
    p.edgeByLine = new Map(p.edges.map(e => [e.line, e]));
    for (const d of p.shapes) {
        delete d.map;
        delete d.seq;
    }
    const ignored: FlowError[] = [];   // the block's own checks have reported what matters
    checkContainers(p, ignored);
    checkMindMaps(p);
    checkSequences(p);
}
