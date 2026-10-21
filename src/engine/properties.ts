/* ---------- properties panel ---------- */
import {$, colour, kid, kids, MM, S, setCell, toast} from './core';
import {DEF, VISIO_DEFAULT} from './colours';
import {cellV, is1D, num, rowV, setText, shapeCtx, shapeText} from './visio-package';
import {canResize, pageCtx, render} from './render';
import {refreshFor} from './connectors';
import {
    CHART_SAMPLES,
    SHAPES,
    applySize,
    PLAIN_VALUES_PROBLEM,
    cellValues,
    coloursOf,
    formatValues,
    isChartKind,
    isGrid,
    isShapeKind,
    isTable,
    resizeGrid,
    resizeTable,
    parseValues,
    roleOf,
    segmentsOf,
    seriesFill,
    valuesCell,
    valuesProblem,
    type ChartValues
} from '../shapes';
import {deleteShapes, selEls, selIds} from './selection';
import {plural} from './formats/export';
import {
    LINE_TEXT_PT,
    delUser,
    resolveType,
    setTextColour,
    setTextPt,
    setUser,
    SHAPE_TEXT_PT,
    textPt,
    userV
} from './flow/model';
import {commit} from './document';
import {deletePage, fitPageToContent, openAny, renamePage, setPageSize} from './visio-io';
import {moveStatement, updateConnProps} from './connection-props';
import {TP, curLineFor, paintCode} from './text-pane';
import {PICTURE_TYPES, setPicture} from './images';
import {pageSizeDictionary} from "./page";

import {addTopic, takesTopics} from './mindmap';

/* The panel's form fields, by the kind of element each id is (Props.tsx draws them) */
const input = (id: string) => $<HTMLInputElement>(id),
    select = (id: string) => $<HTMLSelectElement>(id),
    textArea = (id: string) => $<HTMLTextAreaElement>(id);

/* Paper sizes in mm, width x height, by the value of their entry in the Size dropdown */
const PAGE_PRESETS: Record<string, [w: number, h: number]> = {
    a1p: [594, 841], a1l: [841, 594], a2p: [420, 594], a2l: [594, 420], a3p: [297, 420], a3l: [420, 297],
    a4p: [210, 297], a4l: [297, 210], a5p: [148, 210], a5l: [210, 148], letterp: [216, 279], letterl: [279, 216],
};
/* Sample values by chart kind; any other kind has none */
const SAMPLES: Partial<Record<string, ChartValues>> = CHART_SAMPLES;

export function updateProps(): void {
    const pg = pageCtx(), el = selEl();
    $('propsEmpty').hidden = !!el;
    $('propsShape').hidden = !el;
    if (!el) {
        if (pg) {
            const n = kids(kid(pg.doc.documentElement, 'Shapes'), 'Shape').filter(x => !is1D(shapeCtx(x, null)) && roleOf(x) !== 'key').length;
            const pageW = pg.pageW ?? pg.w, pageH = pg.pageH ?? pg.h,
                wMM = Math.round(pageW * 25.4), hMM = Math.round(pageH * 25.4),
                overflows = pg.w > pageW + 1e-6 || pg.h > pageH + 1e-6;
            $('pageInfo').textContent = `${pg.name}, ${wMM} × ${hMM} mm, ${plural(n, 'shape')}.`
                + (overflows ? ' Shown in grey: content past the page, which a PNG or PDF export would crop.' : '');
            const $pPageName = input('pPageName');
            if (document.activeElement !== $pPageName) $pPageName.value = pg.name;
            const preset = Object.entries(PAGE_PRESETS).find(([, [w, h]]) => w === wMM && h === hMM);
            select('pPagePreset').value = preset ? preset[0] : 'custom';
            $<HTMLButtonElement>('pDeletePage').disabled = S.pages.length <= 1;
        }
        const ap = S.ast && S.ast.pages[S.pi];
        $('pAddKey').textContent = ap && ap.key ? 'Remove the key' : 'Add a key to this page';
        if (S.newConn) select('pNewConn').value = resolveType(S.newConn);   // set when connection-props starts
        if (TP.open && TP.mode === 'flow' && TP.cur !== -1) {
            TP.cur = -1;
            paintCode();
        }
        return;
    }
    const sh = shapeCtx(el, null), oneD = is1D(sh), grid = isGrid(el), table = isTable(el) || grid,
        role = roleOf(el), key = role === 'key';
    // the heading says what the shape is, by its palette name; its id is in the Id box under it
    const kindName = isShapeKind(role) ? SHAPES[role].palette?.label ?? role : grid ? 'Grid' : table ? 'Table' : 'Shape';
    $('selTitle').textContent = key ? 'Key' : oneD ? 'Connection' : kindName;
    const $pText = textArea('pText');
    if (document.activeElement !== $pText) $pText.value = shapeText(sh);
    input('pFill').value = colour(cellV(sh, 'FillForegnd', null), VISIO_DEFAULT.fill).toLowerCase();
    input('pLine').value = colour(cellV(sh, 'LineColor', null), VISIO_DEFAULT.line).toLowerCase();
    input('pTextCol').value = colour(rowV(sh, 'Character', '0', 'Color'), DEF.text).toLowerCase();
    const $pWeight = select('pWeight');
    const pt = num(sh, 'LineWeight', 0.01) * 72, opts = [...$pWeight.options].map(o => +o.value);
    $pWeight.value = String(opts.reduce((x, y) => Math.abs(y - pt) < Math.abs(x - pt) ? y : x));
    for (const w of ['textWrap', 'lineWrap', 'weightWrap', 'textColWrap']) $(w).hidden = table || key;
    $('sizeWrap').hidden = table || key;
    showSize([el]);
    $('tableBtns').hidden = $('tableHint').hidden = !table;
    $('gridBtns').hidden = !grid;
    const chart = isChartKind(role);
    $('valuesWrap').hidden = !chart;
    const $pValues = input('pValues');
    if (chart && document.activeElement !== $pValues) $pValues.value = formatValues(role, (userV(el, 'FlowValues') && cellValues(userV(el, 'FlowValues')!)) || SAMPLES[role ?? ''] || []);
    const stateful = isShapeKind(role) && SHAPES[role].stateful;
    $('stateWrap').hidden = !stateful;
    if (stateful) input('pState').checked = userV(el, 'FlowState') === 'on';
    const hasBg = isShapeKind(role) && SHAPES[role].bg;
    $('bgWrap').hidden = !hasBg;
    if (hasBg) input('pBg').checked = userV(el, 'FlowBg') !== 'off';
    $('bgFillWrap').hidden = !hasBg;
    const $pBgFill = input('pBgFill');
    if (hasBg && document.activeElement !== $pBgFill) $pBgFill.value = (userV(el, 'FlowBgFill') || '#FFFFFF').toLowerCase();
    const maps = isShapeKind(role) ? SHAPES[role].maps : undefined;
    $('mapWrap').hidden = !maps;
    if (maps) {
        const $pMap = select('pMap');
        $pMap.replaceChildren(...Object.entries(maps).map(([k, m]) => new Option(m.name, k)));
        $pMap.value = userV(el, 'FlowMap') || Object.keys(maps)[0];
    }
    const langs = isShapeKind(role) ? SHAPES[role].langs : undefined;
    $('langWrap').hidden = !langs;
    if (langs) {
        const $pLang = select('pLang');
        $pLang.replaceChildren(...Object.entries(langs).map(([k, l]) => new Option(l.name, k)));
        $pLang.value = userV(el, 'FlowLang') || Object.keys(langs)[0];
    }
    const faces = isShapeKind(role) ? SHAPES[role].faces : undefined;
    $('faceWrap').hidden = !faces;
    if (faces) {
        const $pFace = select('pFace');
        $pFace.replaceChildren(...Object.entries(faces).map(([k, f]) => new Option(f.name, k)));
        $pFace.value = userV(el, 'FlowFace') || Object.keys(faces)[0];
    }
    const scroll = isShapeKind(role) && SHAPES[role].scroll, $pScroll = input('pScroll');
    $('scrollWrap').hidden = !scroll;
    if (scroll && document.activeElement !== $pScroll) $pScroll.value = userV(el, 'FlowScroll') || '0';
    const seriesShape = isShapeKind(role) && SHAPES[role].colours;
    $('coloursWrap').hidden = !seriesShape;
    if (seriesShape) showSeriesColours(el, role);
    $('imageBtns').hidden = role !== 'image';
    $('topicBtns').hidden = !takesTopics(el);   // a central topic, or a topic in a mind map
    $('pImage').textContent = userV(el, 'FlowIcon') ? 'Change picture…' : 'Choose picture…';
    $('editHint').hidden = table || key;
    $('fillWrap').hidden = !fillable(el);  // a chart's first series picker is its fill
    $('connBox').hidden = !oneD;
    $('sizeRow').hidden = !canResize(el) || key;
    input('pW').value = String(Math.round(num(sh, 'Width', 0) * 25.4));
    input('pH').value = String(Math.round(num(sh, 'Height', 0) * 25.4));
    $('orderBtns').hidden = oneD;
    $('pDelete').textContent = key ? 'Remove the key' : oneD ? 'Delete connection' : 'Delete shape';
    if (oneD) updateConnProps(el);
    if (TP.open && TP.mode === 'flow') {
        const c = curLineFor();
        if (c !== TP.cur) {
            TP.cur = c;
            paintCode();
        }
    }
    if (S.selection.size > 1) showMultiProps();
}

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

/* A colour picker per series, named underneath: a legend's names, or Series 1, 2, ... on a chart. Rebuilt only when
   the number of series changes, so a picker that is open isn't pulled out from under it. */
function showSeriesColours(el: Element, role: string): void {
    const shown = seriesColours(el), names = role === 'legend' ? segmentsOf(shapeText(shapeCtx(el, null))) : [],
        box = $('pColours');
    if (box.children.length !== shown.length) box.replaceChildren(...shown.map((_, i) => {
        const label = document.createElement('label'), pick = document.createElement('input');
        pick.type = 'color';
        pick.dataset.series = String(i);
        label.append(pick, '');
        return label;
    }));
    shown.forEach((c, i) => {
        const label = box.children[i] as HTMLLabelElement, pick = label.firstElementChild as HTMLInputElement,
            name = names[i] || `Series ${i + 1}`;
        if (document.activeElement !== pick) pick.value = c;
        label.lastChild!.textContent = name;
        label.title = name;
    });
    $('pColoursReset').hidden = !userV(el, 'FlowColours');
}

/* The primary selected shape or connection, if there is one */
export const selEl = (): Element | null => S.sel ? S.elById[S.sel] ?? null : null;

/* Shown in place of the single-shape fields when more than one object is selected */
function showMultiProps(): void {
    const els = selEls();
    $('selTitle').textContent = `${els.length} items selected`;
    for (const w of ['textWrap', 'editHint', 'sizeRow', 'connBox', 'tableBtns', 'tableHint', 'gridBtns', 'imageBtns', 'topicBtns', 'valuesWrap', 'coloursWrap', 'stateWrap', 'bgWrap', 'bgFillWrap', 'mapWrap', 'langWrap', 'faceWrap', 'orderBtns']) $(w).hidden = true;
    $('fillWrap').hidden = !els.some(fillable);
    $('lineWrap').hidden = $('weightWrap').hidden = $('textColWrap').hidden = !els.some(styleable);
    $('sizeWrap').hidden = !els.some(styleable);
    showSize(els.filter(styleable));
    $('pDelete').textContent = `Delete ${els.length} items`;
}

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

function sizeFromProps(): void {
    const id = S.sel, el = selEl();
    if (!id || !el) return;
    const sh = shapeCtx(el, null);
    const W = Math.max(3, +input('pW').value || 0) * MM, H = Math.max(3, +input('pH').value || 0) * MM;
    const W0 = num(sh, 'Width', 1), H0 = num(sh, 'Height', 1);
    commit(() => {
        applySize(el, W, H, W0, H0, num(sh, 'LocPinX', W0 / 2), num(sh, 'LocPinY', H0 / 2));
        render();
        refreshFor(id);
    });
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

const TEXT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];

/* Shows the text size of the selection, or nothing when the selected items differ */
function showSize(els: Element[]): void {
    const pts = [...new Set(els.map(el => textPt(shapeCtx(el, null)) || (is1D(shapeCtx(el, null)) ? LINE_TEXT_PT : SHAPE_TEXT_PT)))];
    const sel = select('pSize');
    for (const o of [...sel.options]) if (o.dataset.extra) o.remove();
    if (pts.length === 1 && !TEXT_SIZES.includes(pts[0])) {
        const o = new Option(pts[0] + ' pt', String(pts[0]));
        o.dataset.extra = '1';
        sel.appendChild(o);
    }
    sel.value = pts.length === 1 ? String(pts[0]) : '';
}

/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init(): void {
    const $pSize = select('pSize');
    for (const pt of TEXT_SIZES) $pSize.appendChild(new Option(pt + ' pt', String(pt)));
    $pSize.addEventListener('change', () => {
        const v = +$pSize.value;
        if (v) styleSelection(styleable, el => setTextPt(el, v));
    });
    input('pFill').addEventListener('change', () => {
        const v = input('pFill').value.toUpperCase();
        styleSelection(fillable, el => {
            setCell(el, 'FillForegnd', v);
            setCell(el, 'FillPattern', 1);
        });
    });
    input('pTextCol').addEventListener('change', () => {
        const v = input('pTextCol').value;
        styleSelection(styleable, el => setTextColour(el, v));
    });
    input('pLine').addEventListener('change', () => {
        const v = input('pLine').value.toUpperCase();
        styleSelection(styleable, el => {
            setCell(el, 'LineColor', v);
            if (num(shapeCtx(el, null), 'LinePattern', 1) === 0) setCell(el, 'LinePattern', 1);
        });
    });
    select('pWeight').addEventListener('change', () => {
        const v = +select('pWeight').value;
        styleSelection(styleable, el => {
            if (v === 0) setCell(el, 'LinePattern', 0); else {
                setCell(el, 'LinePattern', 1);
                setCell(el, 'LineWeight', v / 72);
            }
        });
    });
    $('pDelete').onclick = () => deleteShapes(selIds());
    $('pAddRow').onclick = () => {
        if (!S.sel) return;
        if (isGrid(selEl())) resizeGrid(S.sel, 'row', true); else resizeTable(S.sel, true);
    };
    $('pDelRow').onclick = () => {
        if (!S.sel) return;
        if (isGrid(selEl())) resizeGrid(S.sel, 'row', false); else resizeTable(S.sel, false);
    };
    $('pAddCol').onclick = () => {
        if (S.sel) resizeGrid(S.sel, 'col', true);
    };
    $('pDelCol').onclick = () => {
        if (S.sel) resizeGrid(S.sel, 'col', false);
    };
    input('pState').addEventListener('change', () => {
        const el = selEl();
        if (el) commit(() => {
            if (input('pState').checked) setUser(el, 'FlowState', 'on'); else delUser(el, 'FlowState');
        });
    });
    input('pBg').addEventListener('change', () => {
        const el = selEl();
        if (el) commit(() => {
            if (input('pBg').checked) delUser(el, 'FlowBg'); else setUser(el, 'FlowBg', 'off');
        });
    });
    input('pBgFill').addEventListener('change', () => {
        const el = selEl();
        if (!el) return;
        const v = input('pBgFill').value.toUpperCase();
        commit(() => {
            if (v === '#FFFFFF') delUser(el, 'FlowBgFill'); else setUser(el, 'FlowBgFill', v);
        });
    });
    /* Another map for a route map. A label still naming all the old map's parts (as it starts) names the new one's. */
    select('pMap').addEventListener('change', () => {
        const el = selEl(), role = el && roleOf(el), maps = isShapeKind(role) ? SHAPES[role].maps : undefined;
        if (!el || !maps) return;
        const next = select('pMap').value, was = maps[userV(el, 'FlowMap') || Object.keys(maps)[0]];
        commit(() => {
            if (next === Object.keys(maps)[0]) delUser(el, 'FlowMap'); else setUser(el, 'FlowMap', next);
            if (was && shapeText(shapeCtx(el, null)) === was.sample) setText(el, maps[next].sample);
        });
    });
    /* A script's language: just the badge colour, no sample text to swap like a map's */
    select('pLang').addEventListener('change', () => {
        const el = selEl(), role = el && roleOf(el), langs = isShapeKind(role) ? SHAPES[role].langs : undefined;
        if (!el || !langs) return;
        const next = select('pLang').value;
        commit(() => {
            if (next === Object.keys(langs)[0]) delUser(el, 'FlowLang'); else setUser(el, 'FlowLang', next);
        });
    });
    /* A mood's face: only the setting draws it, never the label */
    select('pFace').addEventListener('change', () => {
        const el = selEl(), role = el && roleOf(el), faces = isShapeKind(role) ? SHAPES[role].faces : undefined;
        if (!el || !faces) return;
        const next = select('pFace').value;
        commit(() => {
            if (next === Object.keys(faces)[0]) delUser(el, 'FlowFace'); else setUser(el, 'FlowFace', next);
        });
    });
    /* How far a scroll area is scrolled; the layout keeps it to what there is to see */
    input('pScroll').addEventListener('change', () => {
        const el = selEl(), by = Math.round(+input('pScroll').value);
        if (!el || !(by >= 0 && by <= 10000)) return updateProps();
        commit(() => {
            if (by) setUser(el, 'FlowScroll', by); else delUser(el, 'FlowScroll');
        });
    });
    $('pColours').addEventListener('change', e => {   // one series' picker: the colours up to it are kept as shown
        const pick = e.target as HTMLInputElement, el = selEl();
        if (!el || pick.dataset.series == null) return;
        const i = +pick.dataset.series, shown = seriesColours(el), own = coloursOf(userV(el, 'FlowColours'));
        const next = Array.from({length: Math.max(own.length, i + 1)}, (_, k) => k === i ? pick.value : own[k] ?? shown[k]);
        commit(() => setUser(el, 'FlowColours', next.map(c => c.toUpperCase()).join(',')));
    });
    $('pColoursReset').onclick = () => {
        const el = selEl();
        if (el && userV(el, 'FlowColours')) commit(() => delUser(el, 'FlowColours'));
    };
    input('pValues').addEventListener('change', () => {
        const el = selEl();
        if (!el) return;
        const kind = roleOf(el), vals = parseValues(kind, input('pValues').value), bad = valuesProblem(kind, vals);
        if (bad) {
            toast(bad === PLAIN_VALUES_PROBLEM ? 'Values are numbers of 0 or more, separated by commas, like 3, 5, 2, 7.' : bad);
            updateProps();
            return;
        }
        commit(() => setUser(el, 'FlowValues', valuesCell(vals)));
    });
    const $imageInput = input('imageInput');
    $imageInput.accept = PICTURE_TYPES;
    $('pImage').onclick = () => $imageInput.click();
    $('pAddTopic').onclick = () => {
        const fid = userV(selEl(), 'FlowId');
        if (fid) addTopic(fid);
    };
    $imageInput.addEventListener('change', async () => {
        const f = $imageInput.files?.[0], el = selEl();
        $imageInput.value = '';
        if (f && el) await setPicture(el, f);
    });
    textArea('pText').addEventListener('change', () => {
        const el = selEl();
        if (el) commit(() => setText(el, textArea('pText').value));
    });
    input('pW').addEventListener('change', sizeFromProps);
    input('pH').addEventListener('change', sizeFromProps);
    select('pPagePreset').addEventListener('change', () => {
        const v = select('pPagePreset').value;
        if (!(v in pageSizeDictionary)) return;
        const [w, h] = pageSizeDictionary[v as keyof typeof pageSizeDictionary].size;
        setPageSize(S.pi, w, h);
    });
    $('pFitPage').onclick = () => {
        if (!fitPageToContent()) toast('There is nothing on this page yet.');
    };
    const $pPageName = input('pPageName');
    $pPageName.addEventListener('change', () => {
        const v = $pPageName.value.trim();
        if (v) renamePage(S.pi, v); else $pPageName.value = pageCtx().name;
    });
    $('pDeletePage').onclick = () => {
        if (S.pages.length <= 1) {
            toast('The last page cannot be deleted.');
            return;
        }
        if (!confirm(`Delete "${pageCtx().name}"? Undo will bring it back.`)) return;
        deletePage(S.pi);
    };
    $('pFront').onclick = () => {
        const el = selEl();
        if (el) moveStatement(el, true);
    };
    $('pBack').onclick = () => {
        const el = selEl();
        if (el) moveStatement(el, false);
    };

    /* ---------- open / save: see the flow module ---------- */
    const $fileInput = input('fileInput');
    $fileInput.addEventListener('change', async () => {
        const f = $fileInput.files?.[0];
        $fileInput.value = '';
        if (f) await openAny(f, null);
    });
}
