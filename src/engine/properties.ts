/* ---------- properties panel ---------- */
import {colour, kid, kids, MM, S, setCell} from './core';
import {DEF, VISIO_DEFAULT} from './colours';
import {cellV, is1D, num, rowV, shapeCtx, shapeText} from './visio-package';
import {canResize, pageCtx, render} from './render';
import {refreshFor} from './connectors';
import {
    CHART_SAMPLES,
    SHAPES,
    applySize,
    cellValues,
    coloursOf,
    formatValues,
    isChartKind,
    isGrid,
    isShapeKind,
    isTable,
    roleOf,
    segmentsOf,
    seriesFill,
    type ChartValues
} from '../shapes';
import {selEls} from './selection';
import {LineWeight} from '../shapes/line-weight';
import {plural} from './formats/export';
import {
    LINE_TEXT_PT,
    resolveType,
    setTextColour,
    setTextPt,
    SHAPE_TEXT_PT,
    textPt,
    userV
} from './flow/model';
import {commit} from './document';
import {takesTopics} from './mindmap';

/* Paper sizes in mm, width x height, by the value of their entry in the Size dropdown */
export const PAGE_PRESETS: Record<string, [w: number, h: number]> = {
    a1p: [594, 841], a1l: [841, 594], a2p: [420, 594], a2l: [594, 420], a3p: [297, 420], a3l: [420, 297],
    a4p: [210, 297], a4l: [297, 210], a5p: [148, 210], a5l: [210, 148], letterp: [216, 279], letterl: [279, 216],
};
/* Sample values by chart kind; any other kind has none */
const SAMPLES: Partial<Record<string, ChartValues>> = CHART_SAMPLES;

/* A chart or legend's series, as many as its parts name (the FlowSeries cell), each in the colour it's drawn in: its
   own colours ([colours=]) first, then the built-in ones. The first series of a line chart is a line with no fill, so
   it shows the line colour. A chart whose parts name no series (a scatter chart) has the one, its fill. */
function seriesColours(el: Element): string[] {
    const sh = shapeCtx(el, null), series = (userV(el, 'FlowSeries') || '').split(','),
        geos = kids(el, 'Section').filter(g => g.getAttribute('N') === 'Geometry'),
        lineOnly = (ix: number) => kids(geos[ix], 'Cell').some(c => c.getAttribute('N') === 'NoFill' && c.getAttribute('V') === '1'),
        own = colour(cellV(sh, 'FillForegnd', null), VISIO_DEFAULT.fill),
        line = colour(cellV(sh, 'LineColor', null), VISIO_DEFAULT.line),
        colours = coloursOf(userV(el, 'FlowColours')), n = Math.max(1, ...series.filter(Boolean).map(s => +s + 1));
    return Array.from({length: n}, (_, i) => {
        const parts = series.flatMap((s, ix) => s === String(i) ? [ix] : []);
        return seriesFill(i, parts.length && parts.every(lineOnly) ? line : own, colours).toLowerCase();
    });
}

/* The primary selected shape or connection, if there is one */
export const selEl = (): Element | null => S.sel ? S.elById[S.sel] ?? null : null;

const styleable = (el: Element) => roleOf(el) !== 'key' && !isTable(el) && !isGrid(el);
/* A chart or legend's first series picker is its fill, so it has no Fill of its own */
const fillable = (el: Element) => {
    const role = roleOf(el);
    return styleable(el) && !is1D(shapeCtx(el, null)) && !(isShapeKind(role) && SHAPES[role].colours);
};

/* Applies a style change to every selected item it suits, as one undo step */
function styleSelection(filter: (el: Element) => boolean, apply: (el: Element) => void): void {
    const els = selEls().filter(filter);
    if (els.length) commit(() => els.forEach(apply));
}

export function downloadBlob(blob: Blob, name: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 1500);
}

export const TEXT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];

/* ---------- read-and-call-only views and mutators for PageProps.tsx/ShapeProps.tsx/MultiProps.tsx ---------- */

/* The text size of els, or '' when they differ; extra is a size outside TEXT_SIZES worth adding as its
   own option (mirrors the old showSize's one-off <option data-extra>) */
export function textSizeView(els: Element[]): { value: string, extra: number | null } {
    const pts = [...new Set(els.map(el => textPt(shapeCtx(el, null)) || (is1D(shapeCtx(el, null)) ? LINE_TEXT_PT : SHAPE_TEXT_PT)))];
    return {
        value: pts.length === 1 ? String(pts[0]) : '',
        extra: pts.length === 1 && !TEXT_SIZES.includes(pts[0]) ? pts[0] : null,
    };
}

/* A chart or legend's series names, Series 1/2/... when it names none (a scatter chart) */
const seriesNames = (el: Element, role: string): string[] => role === 'legend' ? segmentsOf(shapeText(shapeCtx(el, null))) : [];

export type ShapeView = ReturnType<typeof shapeView>;

/* Everything the single-shape panel (ShapeProps.tsx) needs to show for el, read fresh on every render */
export function shapeView(el: Element) {
    const sh = shapeCtx(el, null), oneD = is1D(sh), grid = isGrid(el), table = isTable(el) || grid,
        role = roleOf(el), key = role === 'key';
    const kindName = isShapeKind(role) ? SHAPES[role].palette?.label ?? role : grid ? 'Grid' : table ? 'Table' : 'Shape';
    const chart = isChartKind(role), stateful = isShapeKind(role) && SHAPES[role].stateful,
        hasBg = isShapeKind(role) && SHAPES[role].bg,
        maps = isShapeKind(role) ? SHAPES[role].maps : undefined,
        langs = isShapeKind(role) ? SHAPES[role].langs : undefined,
        faces = isShapeKind(role) ? SHAPES[role].faces : undefined,
        scroll = isShapeKind(role) && SHAPES[role].scroll,
        seriesShape = isShapeKind(role) && SHAPES[role].colours;
    return {
        el, role, oneD, grid, table, key,
        title: key ? 'Key' : oneD ? 'Connection' : kindName,
        text: shapeText(sh),
        fill: colour(cellV(sh, 'FillForegnd', null), VISIO_DEFAULT.fill).toLowerCase(),
        line: colour(cellV(sh, 'LineColor', null), VISIO_DEFAULT.line).toLowerCase(),
        textCol: colour(rowV(sh, 'Character', '0', 'Color'), DEF.text).toLowerCase(),
        weightPt: num(sh, 'LineWeight', 0.01) * 72,
        textFieldsVisible: !(table || key),
        tableBtnsVisible: table, gridBtnsVisible: grid,
        chart, chartValue: chart ? formatValues(role, (userV(el, 'FlowValues') && cellValues(userV(el, 'FlowValues')!)) || SAMPLES[role ?? ''] || []) : '',
        stateful, state: !!stateful && userV(el, 'FlowState') === 'on',
        hasBg, bg: !!hasBg && userV(el, 'FlowBg') !== 'off',
        bgFill: hasBg ? (userV(el, 'FlowBgFill') || '#FFFFFF').toLowerCase() : '#ffffff',
        maps, mapValue: maps ? (userV(el, 'FlowMap') || Object.keys(maps)[0]) : '',
        langs, langValue: langs ? (userV(el, 'FlowLang') || Object.keys(langs)[0]) : '',
        faces, faceValue: faces ? (userV(el, 'FlowFace') || Object.keys(faces)[0]) : '',
        scroll, scrollValue: scroll ? (userV(el, 'FlowScroll') || '0') : '0',
        seriesShape, seriesColours: seriesShape ? seriesColours(el) : [],
        seriesNames: seriesShape ? seriesNames(el, role!) : [],
        coloursResetVisible: !!userV(el, 'FlowColours'),
        imageVisible: role === 'image', imageLabel: userV(el, 'FlowIcon') ? 'Change picture…' : 'Choose picture…',
        topicVisible: takesTopics(el),
        fillVisible: fillable(el),
        sizeRowVisible: canResize(el) && !key,
        widthMM: Math.round(num(sh, 'Width', 0) * 25.4),
        heightMM: Math.round(num(sh, 'Height', 0) * 25.4),
        orderBtnsVisible: !oneD,
        deleteLabel: key ? 'Remove the key' : oneD ? 'Delete connection' : 'Delete shape',
        size: textSizeView([el]),
    };
}

/* Everything the page panel (PageProps.tsx) needs when nothing is selected, read fresh on every render; null
   before the first page exists */
export function pageView() {
    const pg = pageCtx();
    if (!pg) return null;
    const n = kids(kid(pg.doc.documentElement, 'Shapes'), 'Shape').filter(x => !is1D(shapeCtx(x, null)) && roleOf(x) !== 'key').length;
    const pageW = pg.pageW ?? pg.w, pageH = pg.pageH ?? pg.h,
        wMM = Math.round(pageW * 25.4), hMM = Math.round(pageH * 25.4),
        overflows = pg.w > pageW + 1e-6 || pg.h > pageH + 1e-6;
    const preset = Object.entries(PAGE_PRESETS).find(([, [w, h]]) => w === wMM && h === hMM);
    const ap = S.ast && S.ast.pages[S.pi];
    return {
        name: pg.name,
        info: `${pg.name}, ${wMM} × ${hMM} mm, ${plural(n, 'shape')}.`
            + (overflows ? ' Shown in grey: content past the page, which a PNG or PDF export would crop.' : ''),
        presetValue: preset ? preset[0] : 'custom',
        deleteDisabled: S.pages.length <= 1,
        addKeyLabel: ap && ap.key ? 'Remove the key' : 'Add a key to this page',
        newConnValue: S.newConn ? resolveType(S.newConn) : undefined,
    };
}

/* Everything the multi-select panel (MultiProps.tsx) needs, read fresh on every render. Fill/line/weight/text
   colour show the primary selected shape's own values (the single-shape computation they'd have anyway, were
   only one selected), matching the vanilla code's "showMultiProps only adjusts what's hidden" behaviour. */
export function multiPropsView() {
    const els = selEls(), styleableEls = els.filter(styleable), primary = selEl(), pv = primary && shapeView(primary);
    return {
        title: `${els.length} items selected`,
        fillVisible: els.some(fillable),
        styleVisible: styleableEls.length > 0,
        size: textSizeView(styleableEls),
        fill: pv?.fill ?? '#ffffff',
        line: pv?.line ?? '#ffffff',
        textCol: pv?.textCol ?? '#000000',
        weightPt: pv?.weightPt ?? 0,
        deleteLabel: `Delete ${els.length} items`,
    };
}

/* Fill/line/text colour/weight/text size apply to every selected item the filter suits (fillable/styleable
   work the same for one shape or many, so ShapeProps.tsx and MultiProps.tsx share these) */
export function applyFill(hex: string): void {
    const v = hex.toUpperCase();
    styleSelection(fillable, el => {
        setCell(el, 'FillForegnd', v);
        setCell(el, 'FillPattern', 1);
    });
}

export function applyLine(hex: string): void {
    const v = hex.toUpperCase();
    styleSelection(styleable, el => {
        setCell(el, 'LineColor', v);
        if (num(shapeCtx(el, null), 'LinePattern', 1) === 0) setCell(el, 'LinePattern', 1);
    });
}

export const applyTextColour = (hex: string): void => styleSelection(styleable, el => setTextColour(el, hex));

/* The weight dropdown shows the closest of its fixed steps to the shape's actual weight */
export const nearestWeight = (pt: number): number => LineWeight.reduce((x: number, y: number) => Math.abs(y - pt) < Math.abs(x - pt) ? y : x);

export function applyWeight(pt: number): void {
    styleSelection(styleable, el => {
        if (pt === 0) setCell(el, 'LinePattern', 0); else {
            setCell(el, 'LinePattern', 1);
            setCell(el, 'LineWeight', pt / 72);
        }
    });
}

export function applyTextSize(pt: number): void {
    if (pt) styleSelection(styleable, el => setTextPt(el, pt));
}

/* Applies a typed width/height (mm) to el, as one undo step */
export function setShapeSizeMM(id: string, el: Element, wMM: number, hMM: number): void {
    const sh = shapeCtx(el, null);
    const W = Math.max(3, wMM) * MM, H = Math.max(3, hMM) * MM;
    const W0 = num(sh, 'Width', 1), H0 = num(sh, 'Height', 1);
    commit(() => {
        applySize(el, W, H, W0, H0, num(sh, 'LocPinX', W0 / 2), num(sh, 'LocPinY', H0 / 2));
        render();
        refreshFor(id);
    });
}
