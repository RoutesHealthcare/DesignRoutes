/* ---------- pictures: an image shape shows a picture from disc, kept in the text as an icon line ----------
   The picture is stored once, as icon name "data:image/...;base64,..."  under the "flow 1" header, and the shape
   uses it with [icon=name], the same way Visio icons are kept. Large pictures are scaled down first: the data sits
   on one line of the text, so it is kept to a size the text pane stays quick with. */
import {S, toast} from './core';
import {PAPER} from './colours';
import {pageCtx} from './render';
import {select} from './selection';
import {base64} from './formats/export';
import {userV} from './flow/model';
import {ICON_DATA, MAX_ICON_CHARS, declObj, iconStmt, shapeStmt, uniqueFid, type ShapeDecl} from './flow/language';
import {geoMM, withTail} from './flow/sync';
import {editDoc} from './document';
import {addIconLines} from './visio-io';

/* A picture ready to store: its data URI, and its size in px (null when it has none, like an SVG without one) */
type Picture = { data: string, w: number | null, h: number | null };

export const PICTURE_TYPES = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
const MAX_SIDE = 1000;        // px: longest side a picture is stored at
const BUDGET = 600000;        // characters of data a stored picture aims to stay under
const MAX_DROP_MM = 80;       // a dropped picture is placed at its own size, up to this

const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error('it is not a picture this browser can open'));
    i.src = src;
});
const isSvg = (file: File): boolean => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
export const isPicture = (file: File | null | undefined): boolean => !!file && (isSvg(file) || /^image\/(png|jpeg|gif|webp)$/.test(file.type));

async function readPicture(file: File): Promise<Picture> {
    if (isSvg(file)) {
        const data = 'data:image/svg+xml;base64,' + base64(new Uint8Array(await file.arrayBuffer()));
        const img = await loadImg(data).catch(() => null);
        return {data, w: img && img.naturalWidth || null, h: img && img.naturalHeight || null};
    }
    const url = URL.createObjectURL(file);
    try {
        const img = await loadImg(url), w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) throw new Error('it has no size');
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('this browser cannot draw it');
        for (let scale = Math.min(1, MAX_SIDE / Math.max(w, h)); ; scale *= 0.7) {
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            let data = canvas.toDataURL('image/png');
            if (data.length > BUDGET) {   // a photo: JPEG is far smaller, on white since it has no transparency
                ctx.fillStyle = PAPER;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                data = canvas.toDataURL('image/jpeg', 0.85);
            }
            if (data.length <= BUDGET || Math.max(canvas.width, canvas.height) <= 64) return {data, w, h};
        }
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function readChecked(file: File): Promise<Picture | null> {
    try {
        const pic = await readPicture(file);
        if (pic.data.length > MAX_ICON_CHARS || !ICON_DATA.test(pic.data)) throw new Error('it is too big to keep in the drawing');
        return pic;
    } catch (e) {
        toast(`${file.name} could not be used: ${(e as Error).message}.`, 6000);
        return null;
    }
}

/* The icon name for this picture: one already in the document with the same data, or a new one with its line */
function iconFor(data: string, fileName: string): { name: string, line: string | null } {
    const icons = S.ast?.icons ?? new Map<string, string>();
    for (const [name, d] of icons) if (d === data) return {name, line: null};
    const base = String(fileName || '').replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(?=\d)/, 'i_') || 'picture';
    let name = base;
    for (let i = 2; icons.has(name); i++) name = `${base}_${i}`;
    return {name, line: iconStmt(name, data)};
}

/* Removes the icon line for `name` from L when no shape on any page uses it any more, so swapping a picture
   does not leave the old one's data behind */
function dropIfUnused(L: string[], name: string | null | undefined, except: ShapeDecl): void {
    if (!name || (S.ast?.pages ?? []).some(p => p.shapes.some(d => d !== except && d.attrs && d.attrs.icon === name))) return;
    const at = L.findIndex(l => new RegExp(`^\\s*icon\\s+${name}\\s`, 'i').test(l));
    if (at >= 0) L.splice(at, 1);
}

const sizeFor = (pic: Picture, w: number): number | null => pic.w && pic.h ? w * pic.h / pic.w : null;

/* The drawing's text changes in one step (one undo), without moving the view */
function apply(L: string[], iconLine: string | null): void {
    let text = L.join('\n');
    if (iconLine) text = addIconLines(text, [iconLine]);
    editDoc(text, null, true);
}

/* Shows `file` in an image shape already on the page, keeping its width and taking the picture's proportions */
export async function setPicture(el: Element, file: File): Promise<void> {
    const pic = await readChecked(file);
    if (!pic) return;
    const ap = S.ast?.pages[S.pi], fid = userV(el, 'FlowId'), d = ap && fid ? ap.byId.get(fid) : undefined;
    if (!d || d.implicit || d.line == null) return;
    const {name, line} = iconFor(pic.data, file.name), g = geoMM(el, pageCtx()), o = declObj(d),
        old = d.attrs && d.attrs.icon;
    o.attrs = {...o.attrs, icon: name};
    o.place = {x: g.x, y: g.y, w: g.w, h: sizeFor(pic, g.w) ?? g.h};
    const L = S.text.split('\n');
    L[d.line] = withTail(L[d.line], shapeStmt(o));
    if (old !== name) dropIfUnused(L, old, d);
    apply(L, line);
}

/* Adds a new image shape showing `file`, centred on (x,y) in page inches (y up, as the palette uses) */
export async function addPicture(file: File, x: number, y: number): Promise<void> {
    const pic = await readChecked(file);
    if (!pic) return;
    const ap = S.ast?.pages[S.pi];
    if (!ap) return;
    const pg = pageCtx(), {name, line} = iconFor(pic.data, file.name);
    const px = pic.w && pic.h ? [pic.w * 25.4 / 96, pic.h * 25.4 / 96] : [MAX_DROP_MM / 2, MAX_DROP_MM / 2],
        f = Math.min(1, MAX_DROP_MM / Math.max(...px));
    const w = Math.max(5, px[0] * f), h = Math.max(5, px[1] * f);
    const id = uniqueFid(name, new Set(ap.shapes.map(d => d.id)));
    const stmt = shapeStmt({
        id,
        kind: 'image',
        label: '',
        place: {x: x * 25.4 - w / 2, y: (pg.h - y) * 25.4 - h / 2, w, h},
        attrs: {icon: name}
    });
    const L = S.text.split('\n');
    L.splice((ap.lastShapeLine ?? ap.headerLine ?? L.length - 1) + 1, 0, stmt);
    apply(L, line);
    const el = [...pageCtx().doc.getElementsByTagName('*')].find(e => e.localName === 'Shape' && userV(e, 'FlowId') === id);
    if (el) select(el.getAttribute('ID'));
}
