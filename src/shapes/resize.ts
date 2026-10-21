import {evalF, fmtV, kids, setCell} from "../engine/core";
import {axisOf} from "../engine/geometry";

function recompute(el: Element, W: number, H: number, sx: number, sy: number) {
    for (const c of kids(el, 'Cell')) {
        const n = c.getAttribute('N') ?? '';
        if (['Width', 'Height', 'PinX', 'PinY'].includes(n)) continue;
        const ev = evalF(c.getAttribute('F'), W, H);
        if (ev != null) c.setAttribute('V', fmtV(ev));
        else if (/^Txt(PinX|Width|LocPinX)$/.test(n)) c.setAttribute('V', fmtV(+(c.getAttribute('V') ?? 0) * sx));
        else if (/^Txt(PinY|Height|LocPinY)$/.test(n)) c.setAttribute('V', fmtV(+(c.getAttribute('V') ?? 0) * sy));
    }
    for (const s of kids(el, 'Section')) if (s.getAttribute('N') === 'Geometry') for (const r of kids(s, 'Row')) {
        const t = r.getAttribute('T');
        for (const c of kids(r, 'Cell')) {
            const ev = evalF(c.getAttribute('F'), W, H);
            if (ev != null) {
                c.setAttribute('V', fmtV(ev));
                continue;
            }
            const ax = axisOf(t, c.getAttribute('N') ?? '');
            if (ax) c.setAttribute('V', fmtV(+(c.getAttribute('V') ?? 0) * (ax === 'x' ? sx : sy)));
        }
    }
}

/* Gives a shape a new width and height. W0, H0: its old size; lx, ly: its old local pin, kept in the same place
   relative to the shape, so it doesn't jump when resized. */
export function applySize(el: Element, W: number, H: number, W0: number, H0: number, lx: number, ly: number) {
    setCell(el, 'Width', W);
    setCell(el, 'Height', H);
    setCell(el, 'LocPinX', (W0 ? lx / W0 : 0.5) * W, null);
    setCell(el, 'LocPinY', (H0 ? ly / H0 : 0.5) * H, null);
    recompute(el, W, H, W0 ? W / W0 : 1, H0 ? H / H0 : 1);
}