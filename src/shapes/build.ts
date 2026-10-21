import {cellEl, kid, mk, NS} from "../engine/core";
import {DEF} from "../engine/colours";
import {CONTAINER, type ShapeKind, SHAPES} from "./registry";
import {valuesCell} from "./charts";
import {setRole} from "./roles";
import {setUser} from "../engine/flow/model";
import {setText} from "../engine/visio-package";
import type {ChartValues, GeoFn} from "./types";

export function nextId(doc: XMLDocument) {
    let m = 0;
    for (const s of doc.getElementsByTagNameNS(NS, 'Shape')) m = Math.max(m, Number(s.getAttribute('ID')) || 0);
    return String(m + 1);
}

export function ensureShapes(doc: XMLDocument) {
    const root = doc.documentElement;
    let s = kid(root, 'Shapes');
    if (!s) {
        s = doc.createElementNS(NS, 'Shapes');
        root.insertBefore(s, root.firstChild);
    }
    return s;
}

/* Build a shape element; L,B,W,H are in the parent's coordinates (the page, or a group's local space) */
export function buildShape(doc: XMLDocument, kind: ShapeKind, id: string, L: number, B: number, W: number, H: number,
                           text?: string, values?: ChartValues, attrs?: Parameters<GeoFn>[4]): Element {
    const T = SHAPES[kind]
    if (!T.geo) throw new Error(`buildShape can't build a ${kind}: it's a group (use buildTable or buildGrid)`)
    const tb = {x: 0.5, y: 0.5, w: 1, h: 1, ...T.txt}
    if (T.sides && attrs?.side === 'right') tb.x = 1 - tb.x   // mirrored, like its outline
    const el: Element = mk(doc, 'Shape', {ID: id, Type: 'Shape', LineStyle: '0', FillStyle: '0', TextStyle: '0'});
    const C = (n: string, v: number | string, f?: string | null, u?: string) => el.appendChild(cellEl(doc, n, v, f, u));
    C('PinX', L + W / 2, null, 'MM');
    C('PinY', B + H / 2, null, 'MM');
    C('Width', W, null, 'MM');
    C('Height', H, null, 'MM');
    C('LocPinX', W / 2, 'Width*0.5', 'MM');
    C('LocPinY', H / 2, 'Height*0.5', 'MM');
    C('Angle', 0, null, 'DEG');
    C('FlipX', 0);
    C('FlipY', 0);
    C('ResizeMode', 0);
    C('LineWeight', 1 / 72, null, 'PT');
    C('LineColor', DEF.line);
    C('LinePattern', T.bare ? 0 : 1);
    C('FillForegnd', T.fill || DEF.fill);
    C('FillPattern', T.bare ? 0 : 1);
    if (T.container) {   // the label sits in the header band, which keeps its depth however big the frame is
        const d = CONTAINER.header, side = T.container === 'side'
        if (side) {   // down the left, turned a quarter to read upwards, so the block runs along the height
            C('TxtPinX', d / 2, String(d / 2), 'MM');
            C('TxtWidth', H, 'Height*1', 'MM');
            C('TxtLocPinX', H / 2, 'Height*0.5', 'MM');
            C('TxtPinY', H / 2, 'Height*0.5', 'MM');
        } else {
            C('TxtPinX', W / 2, 'Width*0.5', 'MM');
            C('TxtWidth', W, 'Width*1', 'MM');
            C('TxtLocPinX', W / 2, 'TxtWidth*0.5', 'MM');
            C('TxtPinY', H - d / 2, `Height-${d / 2}`, 'MM');
        }
        C('TxtHeight', d, String(d), 'MM');
        C('TxtLocPinY', d / 2, String(d / 2), 'MM');
        C('TxtAngle', side ? Math.PI / 2 : 0, null, 'DEG');
    } else {
        if (T.txtLeft != null || T.txtInset != null) {
            // the text starts a fixed distance from the left, whatever the width: in heights, or in inches
            const left = T.txtLeft != null ? H * T.txtLeft : T.txtInset!,
                lf = T.txtLeft != null ? `Height*${T.txtLeft}` : String(T.txtInset), tw = `(Width-${lf})`;
            C('TxtPinX', left + (W - left) / 2, `${lf}+${tw}*0.5`, 'MM');
            C('TxtWidth', W - left, tw, 'MM');
            C('TxtLocPinX', (W - left) / 2, `${tw}*0.5`, 'MM');
        } else {
            C('TxtPinX', W * tb.x, `Width*${tb.x}`, 'MM');
            C('TxtWidth', W * tb.w, `Width*${tb.w}`, 'MM');
            C('TxtLocPinX', W * tb.w / 2, 'TxtWidth*0.5', 'MM');
        }
        if (T.txtTop != null) {
            const d = Math.min(T.txtTop, H)
            C('TxtPinY', H - d / 2, `Height-${d / 2}`, 'MM');
            C('TxtHeight', d, String(d), 'MM');
            C('TxtLocPinY', d / 2, 'TxtHeight*0.5', 'MM');
        } else {
            C('TxtPinY', H * tb.y, `Height*${tb.y}`, 'MM');
            C('TxtHeight', H * tb.h, `Height*${tb.h}`, 'MM');
            C('TxtLocPinY', H * tb.h / 2, 'TxtHeight*0.5', 'MM');
        }
        C('TxtAngle', 0, null, 'DEG');
    }
    C('VerticalAlign', 1);
    const chr = [cellEl(doc, 'Color', T.textColour || DEF.text), cellEl(doc, 'Size', 0.1527778, null, 'PT')];
    if (T.bold) chr.push(cellEl(doc, 'Style', 1));
    el.appendChild(mk(doc, 'Section', {N: 'Character'}, [mk(doc, 'Row', {IX: '0'}, chr)]));
    el.appendChild(mk(doc, 'Section', {N: 'Paragraph'}, [mk(doc, 'Row', {IX: '0'}, [cellEl(doc, 'HorzAlign', T.align ?? 1)])]));
    const label = text ?? T.text;
    const geo = T.geo(W, H, label, values, attrs)
    geo.forEach((g, i) => el.appendChild(mk(doc, 'Section', {N: 'Geometry', IX: String(i)}, [
        cellEl(doc, 'NoFill', g.noFill ? 1 : 0), cellEl(doc, 'NoLine', g.noLine ? 1 : 0), cellEl(doc, 'NoShow', 0), cellEl(doc, 'NoSnap', 0),
        ...g.rows.map((r, j) => mk(doc, 'Row', {
            T: r.t,
            IX: String(j + 1)
        }, r.c.map(c => cellEl(doc, c[0], c[1], c[2], 'MM'))))])))
    setRole(el, kind)
    // Visio has no fill per section. A section with no series is left empty, so a chart's frame and axes never
    // take its first series' colour ([colours=]).
    if (geo.some(g => g.series != null)) setUser(el, 'FlowSeries', geo.map(g => g.series ?? '').join(','));
    // how far each section's fill is lightened (a heatmap's cells); empty for one drawn in its full colour
    if (geo.some(g => g.shade != null)) setUser(el, 'FlowShade', geo.map(g => g.shade ?? '').join(','));
    if (T.chart && values && values.length) setUser(el, 'FlowValues', valuesCell(values));
    if (T.stateful && attrs && attrs.state === 'on') setUser(el, 'FlowState', 'on');
    if (T.sides && attrs && attrs.side === 'right') setUser(el, 'FlowSide', 'right');
    if (T.bg && attrs && attrs.bg === 'off') setUser(el, 'FlowBg', 'off');
    if (T.bg && attrs && attrs.bgfill) setUser(el, 'FlowBgFill', attrs.bgfill);
    if (T.maps && attrs && attrs.map) setUser(el, 'FlowMap', attrs.map);
    if (T.langs && attrs && attrs.lang) setUser(el, 'FlowLang', attrs.lang);
    if (T.faces && attrs && attrs.face) setUser(el, 'FlowFace', attrs.face);
    if (label) setText(el, label);
    return el;
}

/* begin, end: [x,y] in page inches */
export function buildConnector(doc: XMLDocument, id: string, begin: [number, number], end: [number, number]) {
    const el: Element = mk(doc, 'Shape', {ID: id, Type: 'Shape', LineStyle: '0', FillStyle: '0', TextStyle: '0'})
    const C = (n: string, v: number | string, f?: string | null, u?: string) => el.appendChild(cellEl(doc, n, v, f, u))
    C('BeginX', begin[0], null, 'MM');
    C('BeginY', begin[1], null, 'MM');
    C('EndX', end[0], null, 'MM');
    C('EndY', end[1], null, 'MM');
    C('ObjType', 2);
    C('ShapeRouteStyle', 16);
    C('ConLineRouteExt', 1);
    C('LineWeight', 1 / 72, null, 'PT');
    C('LineColor', DEF.line);
    C('LinePattern', 1);
    C('FillPattern', 0);
    C('EndArrow', 13);
    C('EndArrowSize', 2);
    C('BeginArrow', 0);
    el.appendChild(mk(doc, 'Section', {N: 'Character'}, [mk(doc, 'Row', {IX: '0'}, [cellEl(doc, 'Color', DEF.text), cellEl(doc, 'Size', 0.125, null, 'PT')])]));
    return el;
}