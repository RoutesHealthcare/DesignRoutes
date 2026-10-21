/* Series 0 is the shape's own fill; series 1, 2, ... take SERIES_FILLS (colours.ts) in turn. A chart or legend's own
   colours ([colours=#AA3377,#228833] in the text, the FlowColours cell) come first, one per series from series 0;
   series past the end of them carry on as before. */
import {SERIES_FILLS} from '../engine/colours'

export {SERIES_FILLS}
export const seriesFill = (series: number, own: string, colours: string[] = []) =>
    colours[series] ?? (series > 0 ? SERIES_FILLS[(series - 1) % SERIES_FILLS.length] : own)

/* A fill lightened towards white: shade 1 is the colour itself, 0 is white. Mixed here rather than drawn see-through,
   so the paper underneath doesn't matter and a PNG or PDF keeps the same colours. */
export function shaded(fill: string, shade: number): string {
    const m = /^#([0-9a-f]{6})$/i.exec(fill)
    if (!m || !(shade < 1)) return fill
    const k = Math.max(0, shade), n = parseInt(m[1], 16)
    return '#' + [16, 8, 0].map(b => Math.round(255 - (255 - (n >> b & 255)) * k).toString(16).padStart(2, '0'))
        .join('').toUpperCase()
}

/* The FlowColours cell and the colours= setting keep the list the same way: "#AA3377,#228833" */
export const coloursOf = (cell: string | null | undefined): string[] => cell ? cell.split(',') : []
