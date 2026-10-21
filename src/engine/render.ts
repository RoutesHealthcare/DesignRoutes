/* ---------- rendering ---------- */
import {
    $,
    clearestText,
    colour,
    kid,
    kids,
    NS,
    PX,
    readableText,
    S,
    stage,
    svg,
    svgEl,
    type Box,
    type Pt
} from './core';
import {DEF, PAPER, VISIO_DEFAULT} from './colours';
import {cellV, is1D, num, numEl, rowV, shapeCtx, shapeText, type VisioShape} from './visio-package';
import {ap, buildPaths, localMatrix, mul, type Mat} from './geometry';
import {HIT_PAD_PX, HIT_TOL_PX, syncSelection} from './selection';
import {commitText} from './text-editor';
import {drawHover} from './pointer';
import {updateProps} from './properties';
import {drawMarker, markerOf, userV} from './flow/model';
import {routePoints} from './connectors';
import {addPage} from './visio-io';
import {refreshEditor} from './text-pane';
import {CONTAINER, SHAPES, cellValues, coloursOf, isShapeKind, roleOf, segmentsOf, seriesFill, shaded} from '../shapes';
import type {Page} from './page';
import {depthOf, isContainer, isScroll, scrollOf} from './containers';
import {notify} from "./store";

/* How a block of label text is drawn: size in px, alignment, colour, Visio's style bits (1 bold, 2 italic,
   4 underline), a paper-coloured halo behind it (connection labels), and whether y is its middle or its top */
type LabelStyle = {
    fs: number, anchor?: 'start' | 'middle' | 'end', col: string, style?: number, halo?: boolean,
    valign?: 'middle' | 'top'
};

export const pageCtx = (): Page => S.pages[S.pi];

function dash(lp: number, lw: number): string | null {
    const w = Math.max(lw, 1);
    if (lp <= 1) return null;
    if (lp === 2) return `${w * 4} ${w * 3}`;
    if (lp === 3) return `${w} ${w * 2.5}`;
    return `${w * 6} ${w * 3} ${w} ${w * 3}`;
}

const FONT = 'Calibri, "Segoe UI", Arial, sans-serif';
let measureCtx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();

/* Width of a string in px at font size fs, measured with the font the canvas draws in (cached) */
function textWidth(str: string, fs: number, bold: boolean): number {
    const key = `${bold ? 1 : 0}|${fs}|${str}`;
    let w = widths.get(key);
    if (w == null) {
        measureCtx = measureCtx || document.createElement('canvas').getContext('2d')!;   // a 2d context is always available
        measureCtx.font = `${bold ? 'bold ' : ''}${fs}px ${FONT}`;
        w = measureCtx.measureText(str).width;
        if (widths.size > 20000) widths.clear();
        widths.set(key, w);
    }
    return w;
}

/* Breaks text into lines no wider than maxW. A word is only split when it is wider than a line on its own. */
function wrap(t: string, maxW: number, fs: number, bold = false): string[] {
    const out: string[] = [], fits = (s: string) => textWidth(s, fs, bold) <= maxW;
    for (const para of t.split('\n')) {
        let line = '';
        for (const w of para.split(/\s+/)) {
            if (!w) continue;
            const tryLine = line ? line + ' ' + w : w;
            if (fits(tryLine)) {
                line = tryLine;
                continue;
            }
            if (line) out.push(line);
            line = w;
            while (!fits(line) && line.length > 1) {
                let n = line.length - 1;
                while (n > 1 && !fits(line.slice(0, n))) n--;
                out.push(line.slice(0, n));
                line = line.slice(n);
            }
        }
        out.push(line);
    }
    return out;
}

/* Draws one shape (and, for a group, the shapes inside it) into g, and records its box, outline and line points
   for hit testing. parentM maps the shape's parent's coordinates to page pixels. */
function drawShape(el: Element, parentM: Mat, inheritMid: string | null, g: Element): void {
    const sh = shapeCtx(el, inheritMid), id = el.getAttribute('ID') ?? '';
    const W = num(sh, 'Width', 0), H = num(sh, 'Height', 0), m = mul(parentM, localMatrix(sh)), oneD = is1D(sh);
    const lp = num(sh, 'LinePattern', 1), fp = num(sh, 'FillPattern', 1);
    const lc = colour(cellV(sh, 'LineColor', null), VISIO_DEFAULT.line),
        fc = colour(cellV(sh, 'FillForegnd', null), VISIO_DEFAULT.fill);
    const lw = Math.max(num(sh, 'LineWeight', 0.01) * PX, 0.6);
    const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(q => ap(m, q[0], q[1]));
    const icon = !oneD && iconFor(el);
    if (icon) {
        drawIconShape(sh, g, id, corners, icon);
        return;
    }
    if (!oneD) g.appendChild(svgEl('path', {
        d: 'M' + corners.map(q => q.join(' ')).join('L') + 'Z', fill: 'transparent', stroke: 'transparent',
        'stroke-width': HIT_PAD_PX * 2, 'vector-effect': 'non-scaling-stroke'
    }));
    const all: Pt[] = [], polys: Pt[][] = [], open: Pt[][] = [], series = (userV(el, 'FlowSeries') || '').split(','),
        colours = coloursOf(userV(el, 'FlowColours')), shades = (userV(el, 'FlowShade') || '').split(',');
    const role = roleOf(el), T = isShapeKind(role) ? SHAPES[role] : undefined;
    // a chart or frame's backdrop (always its first section) takes its own colour (white unless [bgfill=] says
    // otherwise), never the series colour its shade:0 would otherwise fall back to
    const bgFill = T?.bg ? userV(el, 'FlowBgFill') : null;
    let hit = '';
    for (const p of buildPaths(sh, W, H)) {
        let df = '', ds = '';
        for (const sub of p.subs) {
            if (sub.pts.length < 2) continue;
            const sp = sub.pts.map(q => ap(m, q[0], q[1]));
            all.push(...sp);
            const d = 'M' + sp.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L');
            const f = sub.pts[0], l = sub.pts[sub.pts.length - 1];
            if (sub.pts.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) {
                df += d + 'Z';
                ds += d + 'Z';
                polys.push(sp);
            } else {
                ds += d;
                open.push(sp);
            }
        }
        hit += ds;
        if (df && p.fill && fp > 0 && !oneD) g.appendChild(svgEl('path', {
            d: df,
            fill: bgFill && p.ix === '0' ? bgFill : shaded(seriesFill(+series[Number(p.ix)] || 0, fc, colours), +(shades[Number(p.ix)] || 1)),
            'fill-rule': 'evenodd',
            stroke: 'none',
            'data-sec': p.ix,
            'data-bg': T?.bg && p.ix === '0' ? '' : null   // so the backdrop can be told from what's drawn on it
        }));
        if (ds && p.line && lp > 0) g.appendChild(svgEl('path', {
            d: ds,
            fill: 'none',
            'data-sec': p.ix,
            // a line chart's lines take their series' colour, lightened by its shade like a fill (a white tick on a
            // toast); a frame or axes (no series) keep the line colour
            stroke: p.fill || !series[Number(p.ix)] ? lc
                : shaded(seriesFill(+series[Number(p.ix)], lc, colours), +(shades[Number(p.ix)] || 1)),
            'stroke-width': lw,
            'stroke-dasharray': dash(lp, lw),
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round'
        }));
    }
    if (oneD && !all.length) {
        const b = ap(parentM, num(sh, 'BeginX', 0), num(sh, 'BeginY', 0)),
            e = ap(parentM, num(sh, 'EndX', 0), num(sh, 'EndY', 0));
        if (lp > 0) g.appendChild(svgEl('path', {
            d: `M${b[0]} ${b[1]}L${e[0]} ${e[1]}`,
            stroke: lc,
            'stroke-width': lw,
            fill: 'none'
        }));
        open.push([b, e]);
        all.push(b, e);
        hit += `M${b[0]} ${b[1]}L${e[0]} ${e[1]}`;
    }
    if (oneD && hit) g.insertBefore(svgEl('path', {
        d: hit,
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': HIT_TOL_PX * 2 + 2,
        'vector-effect': 'non-scaling-stroke'
    }), g.firstChild);
    if (oneD) S.lines[id] = open;   // kept for hit testing and hover
    if (lp > 0 && open.length) {
        const sz = Math.max(8, lw * 4.5), me = markerOf(el, sh, 'End'), ms = markerOf(el, sh, 'Begin');
        if (me !== 'none') {
            const s = open[open.length - 1];
            drawMarker(g, s[s.length - 2], s[s.length - 1], me, sz, lc);
        }
        if (ms !== 'none') {
            const s = open[0];
            drawMarker(g, s[1], s[0], ms, sz, lc);
        }
    }
    const pts = oneD ? all : all.concat(corners);
    if (pts.length) {
        const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        S.boxes[id] = {x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys)};
    }
    if (polys.length && el.getAttribute('Type') !== 'Group') S.polys[id] = polys;

    if (el.getAttribute('Type') === 'Group') for (const c of kids(kid(el, 'Shapes'), 'Shape')) drawShape(c, m, sh.mid, g);

    const txt = num(sh, 'HideText', 0) ? '' : shapeText(sh);
    if (txt.trim()) {
        const own = (n: string) => {   // a text-block cell set on this shape itself, or null
            const v = numEl(el, n, NaN);
            return isFinite(v) ? v : null;
        };
        const tw = own('TxtWidth') ?? W, th = own('TxtHeight') ?? H;
        const cx = (own('TxtPinX') ?? W / 2) - (own('TxtLocPinX') ?? tw / 2) + tw / 2,
            cy = (own('TxtPinY') ?? H / 2) - (own('TxtLocPinY') ?? th / 2) + th / 2;
        const c = ap(m, cx, cy), scale = Math.hypot(m[0], m[1]);
        const size = parseFloat(rowV(sh, 'Character', '0', 'Size') ?? ''),
            fs = Math.max((isFinite(size) ? size : 0.1389) * PX, 4);
        const filled = fp > 0 && !oneD && polys.length > 0 && !T?.textOnPaper;
        const col = readableText(colour(rowV(sh, 'Character', '0', 'Color'), VISIO_DEFAULT.text), filled ? fc : PAPER);
        const style = parseInt(rowV(sh, 'Character', '0', 'Style') ?? '', 10) || 0;   // bit flags: 1 bold, 2 italic, 4 underline
        let wpx = Math.abs(tw) * scale - 8;
        if (oneD || wpx < 40) wpx = Math.max(wpx, 160);
        const ha = oneD ? 1 : parseInt(rowV(sh, 'Paragraph', '0', 'HorzAlign') ?? '', 10);   // 0 left, 1 centre, 2 right
        const anchor: LabelStyle['anchor'] = ha === 0 ? 'start' : ha === 2 ? 'end' : 'middle',
            half = Math.max(Math.abs(tw) * scale / 2 - 4, 0);
        const tx = anchor === 'start' ? c[0] - half : anchor === 'end' ? c[0] + half : c[0];
        if (T?.headline) {   // a KPI card: the first line is the figure, drawn large, with the rest as its caption below
            const [head, ...rest] = txt.split('\n'), big = wrap(head, wpx, fs * 2, true),
                small = rest.length ? wrap(rest.join('\n'), wpx, fs, !!(style & 1)) : [];
            const top = c[1] - (big.length * fs * 2 + small.length * fs) * 1.2 / 2;
            drawLabel(g, big, tx, top, {fs: fs * 2, anchor, col, style: style | 1, valign: 'top'});
            if (small.length) drawLabel(g, small, tx, top + big.length * fs * 2 * 1.2, {
                fs,
                anchor,
                col,
                style,
                valign: 'top'
            });
        } else if (T?.parts) {   // a treemap, word cloud, ...: each part of the label where the shape places it
            const vc = userV(el, 'FlowValues'),
                places = T.parts(W, H, txt, vc ? cellValues(vc) : undefined, {map: userV(el, 'FlowMap')}),
                ink = colour(rowV(sh, 'Character', '0', 'Color'), VISIO_DEFAULT.text);
            segmentsOf(txt).forEach((p, k) => {
                const pl = places[k];
                if (!pl || !p) return;
                const pfs = fs * (pl.size ?? 1), q = ap(m, pl.x, pl.y),
                    pc = pl.series != null ? seriesFill(pl.series, fc, colours)
                        : pl.on != null ? clearestText(shaded(seriesFill(pl.on, fc, colours), pl.onShade ?? 1))
                            : readableText(ink, PAPER);
                drawLabel(g, wrap(p, Math.max(pl.w * scale - 4, 20), pfs, !!(style & 1)), q[0], q[1], {
                    fs: pfs,
                    anchor: 'middle',
                    col: pc,
                    style
                });
            });
        } else if (T?.segments) {   // tabs, lists, ...: each part of the label centred in its own slot
            const parts = segmentsOf(txt), n = parts.length, row = T.segments === 'row';
            parts.forEach((p, k) => {
                const q = ap(m, row ? cx - tw / 2 + tw * (k + 0.5) / n : cx, row ? cy : cy + th / 2 - th * (k + 0.5) / n);
                const x = row || anchor === 'middle' ? q[0] : anchor === 'start' ? q[0] - half : q[0] + half;
                drawLabel(g, wrap(p, row ? Math.max(wpx / n, 20) : wpx, fs, !!(style & 1)), x, q[1], {
                    fs,
                    anchor: row ? 'middle' : anchor,
                    col,
                    style
                });
            });
        } else {
            const turn = own('TxtAngle') ?? 0;   // a swimlane's label reads upwards; Visio turns anticlockwise, SVG clockwise
            const tg = Math.abs(turn) > 1e-6 ? g.appendChild(svgEl('g', {transform: `rotate(${(-turn * 180 / Math.PI).toFixed(2)} ${c[0]} ${c[1]})`})) : g;
            drawLabel(tg, wrap(txt, wpx, fs, !!(style & 1)), tx, c[1], {fs, anchor, col, style, halo: oneD});
        }
    }
    // a short literal label from the shape's own settings, not its typed text (a script's extension in its corner)
    if (!oneD && T?.badge) {
        const b = T.badge({lang: userV(el, 'FlowLang')});
        if (b) {
            const q = ap(m, W * b.x, H * b.y), filled = fp > 0 && polys.length > 0 && !T.textOnPaper,
                col = readableText(colour(rowV(sh, 'Character', '0', 'Color'), VISIO_DEFAULT.text), filled ? fc : PAPER);
            drawLabel(g, [b.text], q[0], q[1], {fs: Math.max(7 / 72 * PX, 4), anchor: 'middle', col});
        }
    }
}

/* Wrapped lines of text. valign 'middle' centres the block on y; 'top' hangs it just below y. */
function drawLabel(g: Element, lines: string[], tx: number, y: number,
                   {fs, anchor = 'middle', col, style = 0, halo = false, valign = 'middle'}: LabelStyle): void {
    const lh = fs * 1.2, first = valign === 'top' ? fs : -(lines.length - 1) * lh / 2 + fs * 0.35;
    const t = svgEl('text', {
        x: tx,
        y,
        'font-size': fs,
        'text-anchor': anchor,
        fill: col,
        'font-family': FONT,
        'font-weight': style & 1 ? 'bold' : null,
        'font-style': style & 2 ? 'italic' : null,
        'text-decoration': style & 4 ? 'underline' : null
    });
    if (halo) t.setAttribute('style', `paint-order:stroke;stroke:${PAPER};stroke-width:4px;stroke-linejoin:round`);
    lines.forEach((ln, i) => {
        const ts = svgEl('tspan', {x: tx, dy: i === 0 ? first : lh});
        ts.textContent = ln;
        t.appendChild(ts);
    });
    g.appendChild(t);
}

/* A shape shown as a picture kept from an import (a Visio icon), with its label underneath as Visio draws it */
function drawIconShape(sh: VisioShape, g: Element, id: string, corners: Pt[], href: string): void {
    const xs = corners.map(q => q[0]), ys = corners.map(q => q[1]),
        b: Box = {x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys)};
    g.appendChild(svgEl('path', {
        d: 'M' + corners.map(q => q.join(' ')).join('L') + 'Z', fill: 'transparent', stroke: 'transparent',
        'stroke-width': HIT_PAD_PX * 2, 'vector-effect': 'non-scaling-stroke'
    }));
    g.appendChild(svgEl('image', {
        href,
        x: b.x0,
        y: b.y0,
        width: b.x1 - b.x0,
        height: b.y1 - b.y0,
        preserveAspectRatio: 'xMidYMid meet'
    }));
    S.boxes[id] = b;
    const txt = num(sh, 'HideText', 0) ? '' : shapeText(sh);
    if (!txt.trim()) return;
    const size = parseFloat(rowV(sh, 'Character', '0', 'Size') ?? ''),
        fs = Math.max((isFinite(size) ? size : 0.1389) * PX, 4);
    const col = readableText(colour(rowV(sh, 'Character', '0', 'Color'), DEF.text), PAPER);
    drawLabel(g, wrap(txt, Math.max(b.x1 - b.x0 + 40, 120), fs), (b.x0 + b.x1) / 2, b.y1 + 2, {fs, col, valign: 'top'});
}

/* Paint order: shapes as they come in the file, and each line just above the later of the shapes it joins. A line
   shows over whatever its ends sit on (a frame, a filled panel) but still runs beneath any shape after them. A line
   joined to nothing goes beneath everything. Lines with the same slot keep their file order. Containers come
   before the other shapes, whatever the file order. */
function paintOrder(doc: Document, top: Element[]): Element[] {
    const line = (el: Element) => is1D(shapeCtx(el, null)), frames = top.filter(isContainer),
        depth = new Map(frames.map(el => [el, depthOf(el, top)]));
    // containers go beneath everything else, outer ones first, so their members always show on top of them
    const shapes = [...frames.sort((a, b) => depth.get(a)! - depth.get(b)!), ...top.filter(el => !line(el) && !isContainer(el))],
        slot = new Map(shapes.map((el, i) => [el, i]));
    const topSlot = (id: string | null) => {
        for (let el: Element | null = id ? S.elById[id] : null; el; el = el.parentElement) {
            const i = slot.get(el);
            if (i != null) return i;
        }
        return -1;
    };   // an end on a shape inside a group counts as the group
    const ends = new Map<string | null, number>();
    for (const c of kids(kid(doc.documentElement, 'Connects'), 'Connect')) {
        const f = c.getAttribute('FromSheet');
        ends.set(f, Math.max(ends.get(f) ?? -1, topSlot(c.getAttribute('ToSheet'))));
    }
    const above: Element[][] = shapes.map(() => []), bottom: Element[] = [];
    for (const el of top.filter(line)) {
        const i = ends.get(el.getAttribute('ID')) ?? -1;
        (i < 0 ? bottom : above[i]).push(el);
    }
    return [...bottom, ...shapes.flatMap((el, i) => [el, ...above[i]])];
}

const iconFor = (el: Element): string | null => {
    const n = userV(el, 'FlowIcon');
    return n && S.ast && S.ast.icons ? S.ast.icons.get(n) || null : null;
};

/* The clip path for what is inside a scroll area: its body, under the header and clear of the scrollbar. One inside
   another scroll area is cut off by that one too. Returns the clip path's id. */
function scrollClip(defs: Element, el: Element, b: Box, outer: string | null): string {
    const id = 'clip-' + el.getAttribute('ID'), head = CONTAINER.header * PX, bar = CONTAINER.bar * PX,
        row = userV(el, 'FlowDir') === 'row';
    const r = svgEl('rect', {
        x: b.x0, y: b.y0 + head, width: Math.max(0, b.x1 - b.x0 - (row ? 0 : bar)),
        height: Math.max(0, b.y1 - b.y0 - head - (row ? bar : 0)), 'clip-path': outer ? `url(#${outer})` : null
    });
    defs.appendChild(svgEl('clipPath', {id},)).appendChild(r);
    return id;
}

/* Redraws the current page from its document, then everything that depends on what is drawn */
export function render(): void {
    const pg = pageCtx();
    if (!pg) return;
    const pw = pg.w * PX, ph = pg.h * PX;
    // pageBg covers the whole canvas (grey); paper sits over the top-left part of it at the page's own size, so
    // anything past the page (when an explicit size is smaller than the content) shows through as grey, without
    // the content ever being moved, resized or left out
    for (const r of [$('pageBg'), $('gridRect')]) {
        r.setAttribute('width', String(pw));
        r.setAttribute('height', String(ph));
    }
    const $paper = $('paper');
    $paper.setAttribute('width', String((pg.pageW ?? pg.w) * PX));
    $paper.setAttribute('height', String((pg.pageH ?? pg.h) * PX));
    const layer = $('layer');
    layer.replaceChildren();
    S.boxes = {};
    S.polys = {};
    S.elById = {};
    S.lines = {};
    for (const s of pg.doc.getElementsByTagNameNS(NS, 'Shape')) S.elById[s.getAttribute('ID') ?? ''] = s;
    const base: Mat = [PX, 0, 0, -PX, 0, ph];   // page inches (y up) to page pixels (y down)
    const top = kids(kid(pg.doc.documentElement, 'Shapes'), 'Shape');
    const defs = layer.appendChild(svgEl('defs', {})), clips = new Map<Element, string>();
    for (const el of paintOrder(pg.doc, top)) {
        const id = el.getAttribute('ID') ?? '', g = svgEl('g', {'data-id': id, 'data-kind': roleOf(el) || ''});
        layer.appendChild(g);   // data-kind lets the CSS style a kind (the video's play button)
        try {
            drawShape(el, base, null, g);
        } catch (err) {
            console.warn('Could not draw shape', id, err);
        }
        // a shape in a scroll area is cut off at its edges; containers paint first, so the area's clip is ready
        const within = !is1D(shapeCtx(el, null)) ? scrollOf(el, top) : null, clip = within && clips.get(within);
        if (clip) g.setAttribute('clip-path', `url(#${clip})`);
        if (isScroll(el) && S.boxes[id]) clips.set(el, scrollClip(defs, el, S.boxes[id], clip || null));
    }
    syncSelection();
    if (S.hover && !S.elById[S.hover]) S.hover = null;
    drawHover();
    drawOverlay();
    updateProps();
    updateTitle();
}

export function canResize(el: Element): boolean {
    const sh = shapeCtx(el, null);
    return !is1D(sh) && el.getAttribute('Type') !== 'Group' && Math.abs(num(sh, 'Angle', 0)) < 1e-6;
}

/* The selection outlines, the count badge for several, and the drag handles for one */
export function drawOverlay(): void {
    const ov = $('overlay');
    ov.replaceChildren();
    // a selected line is highlighted along its route; a selected shape gets a solid outline just outside it
    const pad = 4 / S.zoom, all: Box[] = [];
    for (const id of S.selection) {
        const b = S.boxes[id];
        if (!b) continue;
        all.push(b);
        const lines = is1D(shapeCtx(S.elById[id], null)) && S.lines[id];
        if (lines && lines.length) for (const s of lines)
            ov.appendChild(svgEl('path', {
                d: 'M' + s.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L'),
                class: id === S.sel ? 'selline' : 'selline extra'
            }));
        else ov.appendChild(svgEl('rect', {
            x: b.x0 - pad,
            y: b.y0 - pad,
            width: Math.max(b.x1 - b.x0, 0.5) + 2 * pad,
            height: Math.max(b.y1 - b.y0, 0.5) + 2 * pad,
            rx: 3 / S.zoom,
            class: id === S.sel ? 'selbox' : 'selbox extra'
        }));
    }
    if (all.length > 1) {   // the whole selection, and how many items are in it
        const x0 = Math.min(...all.map(b => b.x0)) - 3 * pad, y0 = Math.min(...all.map(b => b.y0)) - 3 * pad,
            x1 = Math.max(...all.map(b => b.x1)) + 3 * pad, y1 = Math.max(...all.map(b => b.y1)) + 3 * pad;
        ov.appendChild(svgEl('rect', {x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'groupbox'}));
        const fs = 11 / S.zoom, label = `${all.length} selected`, w = (label.length * 0.62 * 11 + 12) / S.zoom,
            h = 18 / S.zoom, by = y0 - h - 2 / S.zoom;
        ov.appendChild(svgEl('rect', {x: x0, y: by, width: w, height: h, rx: h / 2, class: 'selcount'}));
        const t = svgEl('text', {
            x: x0 + w / 2,
            y: by + h / 2 + fs * 0.36,
            'font-size': fs,
            'text-anchor': 'middle',
            class: 'selcount-text'
        });
        t.textContent = label;
        ov.appendChild(t);
    }
    const sel = S.sel;
    if (S.selection.size !== 1 || !sel || !S.boxes[sel]) return;   // handles only make sense for one object
    const b = S.boxes[sel], el = S.elById[sel], sh = shapeCtx(el, null), hs = 10 / S.zoom, pg = pageCtx();
    if (is1D(sh)) {
        if (userV(el, 'FlowRoute') === 'elbow') {   // a handle in the middle of each segment drags it sideways
            const pts = routePoints(sel);
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], c = pts[i + 1];
                if (Math.hypot(c[0] - a[0], c[1] - a[1]) * S.zoom < 16) continue;
                const across = Math.abs(a[1] - c[1]) < 0.5;
                ov.appendChild(svgEl('rect', {
                    x: (a[0] + c[0]) / 2 - hs * 0.45,
                    y: (a[1] + c[1]) / 2 - hs * 0.45,
                    width: hs * 0.9,
                    height: hs * 0.9,
                    rx: hs * 0.15,
                    class: 'handle seg ' + (across ? 'ns' : 'ew'),
                    'data-handle': 'seg-' + i
                }));
            }
        }
        const ends: [handle: string, x: number, y: number][] = [['begin', num(sh, 'BeginX', 0), num(sh, 'BeginY', 0)], ['end', num(sh, 'EndX', 0), num(sh, 'EndY', 0)]];
        for (const [h, X, Y] of ends)
            ov.appendChild(svgEl('circle', {
                cx: X * PX,
                cy: (pg.h - Y) * PX,
                r: hs * 0.65,
                class: 'handle',
                'data-handle': h
            }));
    } else if (canResize(el)) {
        const corners: [handle: string, x: number, y: number][] = [['nw', b.x0, b.y0], ['ne', b.x1, b.y0], ['sw', b.x0, b.y1], ['se', b.x1, b.y1]];
        for (const [h, x, y] of corners)
            ov.appendChild(svgEl('rect', {
                x: x - hs / 2,
                y: y - hs / 2,
                width: hs,
                height: hs,
                class: 'handle',
                'data-handle': h
            }));
    }
}

export function applyView(): void {
    $('view').setAttribute('transform', `translate(${S.panX} ${S.panY}) scale(${S.zoom})`);
    notify();
    drawOverlay();
}

export function fit(): void {
    const pg = pageCtx();
    if (!pg) return;
    const r = stage.getBoundingClientRect();
    const pw = pg.w * PX, ph = pg.h * PX, z = Math.max(0.05, Math.min((r.width - 48) / pw, (r.height - 48) / ph, 4));
    S.zoom = z;
    S.panX = (r.width - pw * z) / 2;
    S.panY = (r.height - ph * z) / 2;
    applyView();
}

/* Zooms by factor f, keeping the stage point (cx, cy) where it is */
export function zoomAt(f: number, cx: number, cy: number): void {
    if (S.editing) commitText();
    const nz = Math.min(8, Math.max(0.05, S.zoom * f));
    S.panX = cx - (cx - S.panX) * nz / S.zoom;
    S.panY = cy - (cy - S.panY) * nz / S.zoom;
    S.zoom = nz;
    applyView();
}

export function renderTabs(): void {
    const t = $('tabs');
    t.replaceChildren();
    S.pages.forEach((p, i) => {
        const b = document.createElement('button');
        b.textContent = p.name + (p.bg ? ' (background)' : '');
        b.setAttribute('aria-selected', String(i === S.pi));
        b.onclick = () => {
            if (S.editing) commitText();
            S.pi = i;
            S.sel = null;
            renderTabs();
            render();
            fit();
            refreshEditor();
        };
        t.appendChild(b);
    });
    const add = document.createElement('button');
    add.textContent = '+';
    add.title = 'Add a page';
    add.setAttribute('aria-label', 'Add a page');
    add.onclick = addPage;
    t.appendChild(add);
}

export function updateTitle(): void {
    notify();
    document.title = (S.dirty ? '* ' : '') + S.name + ' | DesignRoutes';
}

export const zoomCentre = (f: number): void => {
    const r = svg.getBoundingClientRect();
    zoomAt(f, r.width / 2, r.height / 2);
};