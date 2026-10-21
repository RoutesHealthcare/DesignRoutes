/* ---------- graph model to statements (imports and Visio) ---------- */
import {$, PX, S, kid, kids, toast, type Pt} from './core';
import {DEF} from './colours';
import {parsePackage} from './visio-package';
import {SHAPES, isShapeKind, roleOf} from '../shapes';
import {commitText} from './text-editor';
import {downloadBlob} from './properties';
import {MAX_IMPORT_CHARS, pageGraph, plural, type Graph} from './formats/export';
import {pageCtx, render} from './render';
import {scrollOf} from './containers';
import {openImport} from './dialogs';
import {
    IMPORTERS,
    detectFormat,
    unfence,
    type ImportedGraph,
    type ImportEdge,
    type ImportNode
} from './formats/import';
import {layoutGraph} from './layout';
import type {LayoutGraph} from './layoutGraph';
import {applyTags, SHAPE_TEXT_PT, userV} from './flow/model';
import {
    autoSizeMM,
    edgeStmt,
    fixedH,
    fixedHeight,
    FLOW_ID,
    gridFromText,
    iconStmt,
    keyStmt,
    pageStmt,
    shapeStmt,
    uniqueFid,
    type FlowAst,
    type FlowPage,
    type Place,
    type ShapeAttrs
} from './flow/language';
import {LOOSE_GAP, PAGE_MARGIN, geoMM, type Geo} from './flow/sync';
import {editDoc, loadText, setDirty} from './document';
import {TP, applyFromEditor} from './text-pane';
import JSZip from "jszip";

/* A shape as graphStatements writes it: a node from any graph, plus what the text pane and Visio import add */
export type StatementNode = ImportNode & {
    keepPlace?: Place | null,       // the text pane: keep the place the statement already had
    keepAttrs?: ShapeAttrs,         // ... and its settings
    iconRef?: string                // nameIcons: the name of the node's icon in the text
};
export type StatementGraph = { nodes: StatementNode[], edges: ImportEdge[] };
export type StatementOptions = {
    ox?: number, oy?: number,       // mm added to every position
    used?: Set<string>,             // flow ids already taken; the new ones are added to it
    placed?: boolean,               // write positions (false: let the editor lay the page out)
    relabel?: boolean               // name every shape from its label, ignoring the graph's own ids
};
/* One page of a Visio drawing, read into the graph model */
type VisioPage = { name: string, size: [number, number], g: Graph, key: { title: string, place: Geo } | null };

/* The parsed document. It always exists once the editor has started; the menus can't be used before that. */
const ast = (): FlowAst => {
    if (!S.ast) throw new Error('the document has not been read yet.');
    return S.ast;
};
/* layoutGraph fills in any position or size a node lacks (LayoutNode only describes it afterwards) */
const laidOut = <G extends ImportedGraph>(g: G): G => {
    layoutGraph(g as unknown as LayoutGraph);
    return g;
};

export function graphStatements(g: StatementGraph, {
    ox = PAGE_MARGIN,
    oy = PAGE_MARGIN,
    used = new Set<string>(),
    placed = true,
    relabel = false
}: StatementOptions = {}): { lines: string[], ids: Map<string, string> } {
    const ids = new Map<string, string>(), lines: string[] = [];
    for (const n of g.nodes) {
        const want = String(n.id),
            id = !relabel && FLOW_ID.test(want) && !used.has(want) && !['key', 'page', 'flow'].includes(want.toLowerCase()) ? want : uniqueFid(n.label || n.kind, used);
        used.add(id);
        ids.set(n.id, id);
    }
    for (const n of g.nodes) {
        const kind = isShapeKind(n.kind) ? n.kind : 'process',
            cells = kind === 'grid' ? (n.cells && n.cells.length ? n.cells : gridFromText(n.label)) : null;   // other formats carry a grid's cells in its label
        const auto = autoSizeMM({kind, label: n.label, columns: n.columns, cells});
        const w = n.w != null ? n.w * 25.4 : auto.w, h = n.h != null ? n.h * 25.4 : auto.h;
        const sized = Math.abs(w - auto.w) > 0.6 || (!fixedHeight(kind) && Math.abs(h - auto.h) > 0.6);
        const place = n.keepPlace !== undefined ? n.keepPlace : placed && n.x != null ? {
            x: ox + n.x * 25.4,
            y: oy + (n.y ?? 0) * 25.4,
            w: sized ? w : null,
            h: sized ? (fixedHeight(kind) ? fixedH({kind, columns: n.columns, cells}) : h) : null
        } : null;
        const hex = (v: string | null | undefined) => v && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null,
            T = SHAPES[kind];
        const attrs: ShapeAttrs = n.keepAttrs || (fixedHeight(kind) ? {} : {
            fill: hex(n.fill) && hex(n.fill) !== (T.fill || DEF.fill).toUpperCase() ? hex(n.fill) : null,
            stroke: hex(n.line) && hex(n.line) !== DEF.line.toUpperCase() ? hex(n.line) : null,
            text: hex(n.textColour) && hex(n.textColour) !== (T.textColour || DEF.text).toUpperCase() ? hex(n.textColour) : null,
            icon: n.iconRef || null,
            size: n.size && Math.abs(n.size - SHAPE_TEXT_PT) > 0.01 ? n.size : null
        });
        lines.push(shapeStmt({
            id: ids.get(n.id)!,   // every node was named above
            kind,
            label: kind === 'grid' ? '' : n.label || '',
            cells,
            columns: kind === 'table' ? (n.columns && n.columns.length ? n.columns : ['column']) : null,
            place,
            attrs
        }));
    }
    for (const e of g.edges) {
        const from = ids.get(e.from), to = ids.get(e.to);
        if (!from || !to || from === to) continue;
        const via = placed && e.route === 'elbow' && e.via ? e.via.map(([x, y]): Pt => [ox + x * 25.4, oy + y * 25.4]) : null;   // bends are in inches, like node positions
        lines.push(edgeStmt({
            from,
            to,
            style: e.style || 'solid',
            start: e.start || 'none',
            end: e.end || (e.directed === false ? 'none' : 'arrow'),
            means: e.means || '',
            stroke: e.stroke || null,
            weight: e.weight || null,
            size: e.size || null,
            text: e.text || null,
            label: e.label || '',
            route: e.route || null,
            via
        }));
    }
    return {lines, ids};
}

const nextPageName = (base = 'Imported') => {
    let i = 1;
    while (ast().pages.some(p => p.name === `${base}-${i}`)) i++;
    return `${base}-${i}`;
};

export function replacePageBody(text: string, ap: FlowPage, newLines: string[]): string {
    const L = text.split('\n'), start = ap.headerLine == null ? 0 : ap.headerLine + 1, end = ap.endLine;
    let keep = end;
    while (keep >= start && !L[keep].trim()) keep--;   // keep blank lines between pages
    L.splice(start, Math.max(0, keep - start + 1), ...newLines);
    return L.join('\n');
}

/* dest: 'new' (a new page), 'replace' (this page's contents) or anything else (beside what is on this page) */
export async function importGraph(g: ImportedGraph, dest: string): Promise<void> {
    if (!g.nodes.length) throw new Error('no shapes were found to import.');
    applyTags(g);
    laidOut(g);
    const ap = ast().pages[S.pi];
    if (dest === 'new') {
        const {lines} = graphStatements(g), name = nextPageName();
        editDoc(S.text.replace(/\s*$/, '\n') + '\n' + pageStmt({
            name,
            size: [297, 210],
            direction: g.direction
        }) + '\n' + lines.join('\n') + '\n', ast().pages.length);
    } else if (dest === 'replace') {
        const {lines} = graphStatements(g);
        editDoc(replacePageBody(S.text, ap, lines), S.pi);
    } else {
        const built = S.built[S.pi];
        let ox = PAGE_MARGIN, oy = PAGE_MARGIN;
        if (built && built.size) {
            ox = Math.max(...[...built.values()].map(b => b.x + b.w)) + LOOSE_GAP * 2;
            oy = Math.min(...[...built.values()].map(b => b.y));
        }
        const {lines} = graphStatements(g, {ox, oy, used: new Set(ap.shapes.map(d => d.id))});
        const L = S.text.split('\n');
        let at = ap.endLine;
        while (at > (ap.headerLine ?? -1) && !L[at].trim()) at--;
        L.splice(at + 1, 0, ...lines);
        editDoc(L.join('\n'), S.pi);
    }
}

/* ---------- Visio import and export ---------- */

/* Reads every page of a .vsdx into the graph model, leaving the open document untouched */
export async function readVisio(buf: ArrayBuffer): Promise<VisioPage[]> {
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(buf);
    } catch (_) {
        throw new Error('that is not a .vsdx package. Open older .vsd files in Visio and save them as .vsdx first.');
    }
    const keep = {zip: S.zip, pages: S.pages, masters: S.masters, styles: S.styles, pi: S.pi}, out: VisioPage[] = [];
    S.zip = zip;
    try {
        await parsePackage();
        for (let i = 0; i < S.pages.length; i++) {
            S.pi = i;
            const pg = S.pages[i], g = pageGraph();
            const top = kids(kid(pg.doc.documentElement, 'Shapes'), 'Shape');
            const key = top.find(el => roleOf(el) === 'key');   // a key this editor wrote comes back as a key
            out.push({
                name: pg.name + (pg.bg ? ' (background)' : ''), size: [pg.w * 25.4, pg.h * 25.4], g,
                key: key ? {title: userV(key, 'FlowKeyTitle') || 'Key', place: geoMM(key, pg)} : null
            });
        }
    } finally {
        Object.assign(S, keep);
        render();
    }   // reading draws each Visio page, so put the open page back
    return out;
}

/* Imports a Visio drawing. Its first page goes where dest says (a new page, replacing this page, or beside what
   is on this page); any further pages are added as new pages. Shapes keep their places and connectors their routes. */
export async function importVisio(buf: ArrayBuffer, name: string, dest: string): Promise<void> {
    const pages = await readVisio(buf);
    if (!pages.some(p => p.g.nodes.length)) throw new Error('no shapes were found in that drawing.');
    const nodes: StatementNode[] = pages.flatMap(p => p.g.nodes), iconLines = nameIcons(nodes);
    const ap = ast().pages[S.pi], used = new Set(ap.shapes.map(d => d.id));
    const pageText = (p: VisioPage, opts?: StatementOptions) => {
        const lines = graphStatements(p.g, {ox: 0, oy: 0, used: new Set(), relabel: true, ...opts}).lines;
        if (p.key) lines.push(keyStmt({title: p.key.title, place: {x: p.key.place.x, y: p.key.place.y}}));
        return lines;
    };
    const newPage = (p: VisioPage) => '\n' + pageStmt({
        name: uniquePageName(p.name),
        size: p.size
    }) + '\n' + pageText(p).join('\n') + '\n';
    const [first, ...rest] = pages;
    let text = S.text, focus = S.pi;
    if (dest === 'replace') {
        text = replacePageBody(text, ap, pageText(first));
        if (ap.headerLine != null) {
            const L = text.split('\n');
            L[ap.headerLine] = pageStmt({name: ap.name, size: first.size, direction: ap.direction});
            text = L.join('\n');
        }   // take the Visio page size too
    } else if (dest === 'add') {
        const built = S.built[S.pi];
        let ox = 0;
        if (built && built.size) ox = Math.max(...[...built.values()].map(b => b.x + b.w)) + LOOSE_GAP * 2;
        const L = text.split('\n');
        let at = ap.endLine;
        while (at > (ap.headerLine ?? -1) && !L[at].trim()) at--;
        L.splice(at + 1, 0, ...pageText(first, {ox, used}));
        text = L.join('\n');
    } else {
        text = text.replace(/\s*$/, '\n') + newPage(first);
        focus = ast().pages.length;
    }
    for (const p of rest) text = text.replace(/\s*$/, '\n') + newPage(p);
    editDoc(addIconLines(text, iconLines), focus);
    const icons = nodes.filter(n => n.iconRef).length, warnings = pages.flatMap(p => p.g.warnings);
    toast(`Imported ${name}${pages.length > 1 ? ` (${plural(pages.length, 'page')})` : ''}: ${plural(nodes.length, 'shape')}`
        + (icons ? `, ${icons} of them icons kept as pictures` : '') + '. Shapes take the editor\'s nearest equivalent, so some Visio formatting is not kept.'
        + (warnings.length ? ' ' + warnings.join(' ') : ''), 9000);
}

/* Gives each distinct icon picture a name (reusing one already in the document for the same picture), sets
   n.iconRef on the nodes that use it, and returns the icon lines the document still needs */
function nameIcons(nodes: StatementNode[]): string[] {
    const icons = ast().icons, known = new Map([...icons].map(([name, data]) => [data, name])),
        taken = new Set(icons.keys()), lines: string[] = [];
    for (const n of nodes) {
        if (!n.icon) continue;
        let name = (n.iconKey && known.get(n.iconKey)) || known.get(n.icon);
        if (!name) {
            const base = String(n.iconName || 'icon').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(?=\d)/, 'i_') || 'icon';
            name = base;
            for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
            taken.add(name);
            known.set(n.icon, name);
            if (n.iconKey) known.set(n.iconKey, name);
            lines.push(iconStmt(name, n.icon));
        }
        n.iconRef = name;
    }
    return lines;
}

/* Icon lines sit under the "flow 1" header, before the first page */
export function addIconLines(text: string, lines: string[]): string {
    if (!lines.length) return text;
    const L = text.split('\n'), at = L.findIndex(l => /^\s*flow\s/i.test(l));
    L.splice(at + 1, 0, ...lines);
    return L.join('\n');
}

const uniquePageName = (base: string) => {
    let n = base, i = 2;
    while (ast().pages.some(p => p.name === n)) n = `${base} (${i++})`;
    return n;
};

/* ---------- opening and saving ---------- */
/* The File System Access API's pickers (Chromium only), which TypeScript's DOM types leave out */
type FilePickerType = { description: string, accept: Record<string, string[]> };
const picker: Window & {
    showOpenFilePicker?: (o: { types: FilePickerType[] }) => Promise<FileSystemFileHandle[]>,
    showSaveFilePicker?: (o: { suggestedName: string, types: FilePickerType[] }) => Promise<FileSystemFileHandle>
} = window;
const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';   // the person closed the picker

const OPEN_TYPES: FilePickerType[] = [{
    description: 'Diagrams',
    accept: {'text/plain': ['.flow', '.mmd', '.mermaid', '.puml', '.plantuml', '.pu', '.dot', '.gv', '.drawio', '.md', '.txt']}
}];
const SAVE_TYPES: FilePickerType[] = [{description: 'Flow diagram', accept: {'text/plain': ['.flow']}}];
export const isFlowText = (t: string): boolean => /^\s*(?:#[^\n]*\n\s*)*(?:flow\s+\d|page\s+")/i.test(t);

export async function openAny(file: File, handle: FileSystemFileHandle | null): Promise<void> {
    const name = file.name, lower = name.toLowerCase();
    try {
        if (/\.vsd[xm]$/.test(lower)) {
            openImport(file);
            return;
        }   // Visio drawings are imported into the document, not opened
        if (/\.vsd$/.test(lower)) throw new Error('older .vsd files need to be opened in Visio and saved as .vsdx first.');
        if (file.size > MAX_IMPORT_CHARS) throw new Error('the file is too large.');
        const text = await file.text();
        if (lower.endsWith('.flow') || isFlowText(text)) {
            loadText(text, name.endsWith('.flow') ? name : name + '.flow', lower.endsWith('.flow') ? handle : null);
            toast('Opened ' + name + '.');
            return;
        }
        const body = unfence(text), fmt = detectFormat(body);
        if (!fmt) throw new Error('the format was not recognised.');
        const g = laidOut(applyTags(await IMPORTERS[fmt](body)));
        const {lines} = graphStatements(g);
        loadText(['flow 1', '', pageStmt({
            name: 'Page-1',
            size: [297, 210],
            direction: g.direction
        }), ...lines, ''].join('\n'), name.replace(/\.[^.]+$/, '') + '.flow', null);
        toast(`Opened ${name} as a new flow document.` + (g.warnings.length ? ' ' + g.warnings.join(' ') : ''), g.warnings.length ? 9000 : 4500);
    } catch (e) {
        console.error('Could not open', name, e);
        toast('Could not open ' + name + ': ' + (e instanceof Error ? e.message : String(e)), 8000);
    }
}

export async function openFile(): Promise<void> {
    if (S.dirty && !confirm('Discard unsaved changes?')) return;
    if (picker.showOpenFilePicker) {
        try {
            const [h] = await picker.showOpenFilePicker({types: OPEN_TYPES});
            await openAny(await h.getFile(), h);
            return;
        } catch (e) {
            if (isAbort(e)) return;
            console.warn('File picker unavailable here, using the file input instead', e);
        }
    }
    $('fileInput').click();
}

/* as: always ask where to save (Save as), even when the document already has a file */
export async function save(as: boolean): Promise<void> {
    if (S.editing) commitText();
    if (TP.open && TP.mode === 'flow') applyFromEditor(true);
    const blob = new Blob([S.text.endsWith('\n') ? S.text : S.text + '\n'], {type: 'text/plain'});
    const done = () => {
        setDirty(false);
        toast('Saved ' + S.name + '.');
    };
    if (!/\.flow$/i.test(S.name)) S.name = S.name.replace(/\.[^.]+$/, '') + '.flow';
    try {
        if (!as && S.handle && S.handle.createWritable) {
            const w = await S.handle.createWritable();
            await w.write(blob);
            await w.close();
            done();
            return;
        }
        if (picker.showSaveFilePicker) {
            const h = await picker.showSaveFilePicker({suggestedName: S.name, types: SAVE_TYPES});
            const w = await h.createWritable();
            await w.write(blob);
            await w.close();
            S.handle = h;
            S.name = h.name;
            done();
            return;
        }
    } catch (e) {
        if (isAbort(e)) return;
        console.error('Saving through the file picker failed; downloading instead', e);
    }
    downloadBlob(blob, S.name);
    done();
}

export function addPage(): void {
    const name = nextPageName('Page');
    editDoc(S.text.replace(/\s*$/, '\n') + '\n' + pageStmt({name, size: [297, 210]}) + '\n', ast().pages.length);
}

/* Rewrites a page's header line (name, size and direction are all written together, since there is only one
   line to hold them). headerLine is null only for an implicit first page that has no "page" line of its own yet. */
function writePageHeader(pi: number, {name, size, direction}: {
    name: string,
    size?: [number, number] | null,
    direction?: string
}): void {
    const ap = S.ast && S.ast.pages[pi];
    if (!ap) return;
    const stmt = pageStmt({name, size, direction});
    if (ap.headerLine == null) {
        editDoc(stmt + '\n' + S.text, pi);
        return;
    }
    const L = S.text.split('\n');
    L[ap.headerLine] = stmt;
    editDoc(L.join('\n'), pi);
}

/* Sets an explicit page size (mm) in the text, as a floor: content that already reaches past it is never
   clipped or shrunk — buildModel always grows the drawn page to fit whatever is on it. w and h replace whatever
   was explicitly set before; pass the page's own current size (ap.size), not what is on screen, for whichever
   dimension the caller is not changing, since the screen size may already be larger than the floor because of
   content. */
export function setPageSize(pi: number, w: number, h: number): void {
    const ap = S.ast && S.ast.pages[pi];
    if (!ap) return;
    writePageHeader(pi, {name: ap.name, size: [Math.round(w), Math.round(h)], direction: ap.direction});
}

/* The page's own explicit size, or its current drawn size when none has been set yet (there is then nothing
   narrower to fall back to) */
export function pageSizeMM(pi: number): [w: number, h: number] {
    const ap = S.ast && S.ast.pages[pi];
    if (ap && ap.size) return ap.size;
    const pg = S.pages[pi];
    return pg ? [Math.round((pg.pageW ?? pg.w) * 25.4), Math.round((pg.pageH ?? pg.h) * 25.4)] : [297, 210];
}

export function renamePage(pi: number, name: string): void {
    const ap = S.ast && S.ast.pages[pi];
    name = String(name || '').trim();
    if (!ap || !name) return;
    writePageHeader(pi, {name, size: ap.size, direction: ap.direction});
}

/* Removes a page's whole text block (its header line, if it has one, through the line before the next page's
   header, or end of file). Refuses to remove the last page: a document always has at least one. */
export function deletePage(pi: number): boolean {
    const ap = S.ast && S.ast.pages[pi];
    if (!ap || S.pages.length <= 1) return false;
    const L = S.text.split('\n'), start = ap.headerLine ?? 0;
    L.splice(start, ap.endLine - start + 1);
    editDoc(L.join('\n'), pi);
    return true;
}

/* Shrinks the current page's explicit size down to whatever is actually on it, with the same margin new content
   gets placed with. Nothing is moved or resized; buildModel still grows the page back if that is ever not enough.
   Returns false when there is nothing on the page to fit to. */
export function fitPageToContent(): boolean {
    render();   // make sure S.boxes matches what is actually drawn before measuring it
    // top-level shapes only, leaving out what a scroll area cuts off
    const top = kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape'),
        boxes = top.filter(el => !scrollOf(el, top)).map(el => S.boxes[el.getAttribute('ID') ?? '']).filter(Boolean);
    if (!boxes.length) return false;
    const xMM = Math.max(...boxes.map(b => b.x1)) / PX * 25.4, yMM = Math.max(...boxes.map(b => b.y1)) / PX * 25.4;
    setPageSize(S.pi, Math.max(50, Math.round(xMM + PAGE_MARGIN)), Math.max(50, Math.round(yMM + PAGE_MARGIN)));
    return true;
}
