/* One cell in a geometry row: its name, value in inches, and optionally the formula that recomputes it on resize */
export type GeoCell = [name: string, value: number, formula?: string]

/* One row of an outline: MoveTo, LineTo, ArcTo, Ellipse, ... */
export type GeoRow = { t: string, c: GeoCell[] }

/* One part of a shape's outline; noFill draws the line only, noLine the fill only (a backdrop under a dashed
   outline), series picks its fill (seriesFill in series.ts), and shade (0 to 1) lightens that fill towards white,
   1 being the colour itself (a heatmap's cells) */
export type GeoSection = {
    noFill?: boolean | number, noLine?: boolean | number, series?: number, shade?: number, rows: GeoRow[]
}

/* A point as fractions of the shape (or inches, for absGeo); the optional third item is the row type */
export type Point = [x: number, y: number, rowType?: string]
export type PointSection = {
    noFill?: boolean | number, noLine?: boolean | number, series?: number, shade?: number, pts: Point[]
}

/* A chart's values: one row per series, as written in the text ({ 3, 5, 2; 4, 1, 6 }). Charts whose values come in
   groups (scatter, bubble, candlestick, box plot) keep them all in one row; valuesPerPoint (charts.ts) says how to group them. */
export type ChartValues = number[][]

/* Draws a shape's outline for a given size, from its label, chart values and settings ([state=on]) */
export type GeoFn = (W: number, H: number, label?: string, values?: ChartValues, attrs?: {
    state?: string | null
    side?: string | null     // which side it sits on, left (the default) or right: a chat bubble from me
    bg?: string | null       // whether its backdrop is filled, on (the default) or off: a chart or frame shape
    bgfill?: string | null   // ... the backdrop's colour, white (the default) unless set
    flow?: string | null     // a flexi container's direction (a scroll area's bar runs along it)
    shown?: number | null    // a scroll area: how much of what's in it fits, 0 to 1 (the thumb's length)
    at?: number | null       // ... and how far it's scrolled, 0 at the start to 1 at the end (where the thumb is)
    map?: string | null      // a route map: which of its maps it shows ([map=lancashire]), the first when none
    lang?: string | null     // a script: which language it's in ([lang=python]), the first when none
    face?: string | null     // a mood: which face it pulls ([face=sad]), the first when none
}) => GeoSection[]

/* Where one part of a label goes, for shapes that place their own (parts on the ShapeDef): its middle in inches, y up
   like the outline, how wide it may wrap, how big against the label's size (1), and its colour: dark or white,
   whichever reads better on series colour `on` (a treemap's tile, lightened by onShade), in series colour `series`
   (a word cloud's word), or else the label's colour, readable on the paper */
export type PartPlace = {
    x: number,
    y: number,
    w: number,
    size?: number,
    on?: number,
    onShade?: number,
    series?: number
}

/* Fractions of the shape */
export type TextBlock = { x?: number, y?: number, w?: number, h?: number }

/* How a shape appears on the palette: its caption, a longer tooltip when the caption isn't enough, and a 44x28 icon
   as SVG markup. pinned puts it at the top beside Connect instead of in its group. No palette entry, not on the palette. */
export type PaletteEntry = { label: string, title?: string, icon: string, pinned?: boolean }

export type ShapeDef = {
    palette?: PaletteEntry
    w: number
    h: number
    geo?: GeoFn
    bare?: boolean
    text?: string
    align?: 0 | 1 | 2
    txt?: TextBlock
    /* The text block is this many inches deep at the top, whatever the height: a lifeline's name in its head */
    txtTop?: number
    fill?: string
    textColour?: string
    bold?: boolean
    txtLeft?: number
    /* Like txtLeft, but in inches, for shapes whose height changes with their label (a legend) */
    txtInset?: number
    stateful?: boolean
    /* Has a backdrop that [bg=on/off] can toggle (on, filled with fill, is the default): a chart or a framed
       wireframe shape (a navbar, menu bar, hero section, and so on) */
    bg?: boolean
    /* Keeps its own size whatever its label (an event dot, a gateway): sizeFor in layout.ts reads it */
    fixedSize?: boolean
    /* Can sit on the right ([side=right]), drawn and its text block mirrored: a chat bubble from me */
    sides?: boolean
    chart?: boolean
    /* Takes a colour per series, [colours=#AA3377,#228833] (charts and legends) */
    colours?: boolean
    headline?: boolean
    textOnPaper?: boolean
    table?: boolean
    grid?: boolean
    /* Places each part of the label (split on |, like segments) where the shape says, from its size, label and values:
       a treemap's names on their tiles. A part with no place isn't drawn. render.ts draws them; the outline comes from
       geo, so both should come from one layout (labelled.ts) to agree. */
    parts?: (W: number, H: number, label?: string, values?: ChartValues, attrs?: Parameters<GeoFn>[4]) => PartPlace[]
    /* A short literal label from the shape's own settings, not the user's typed text (a script's extension in its
       corner, from [lang=python]): where it sits (fractions of the shape) and what it reads. null draws nothing. */
    badge?: (attrs?: Parameters<GeoFn>[4]) => { x: number, y: number, text: string } | null
    /* The label is split on | into equal slots, side by side ('row': tabs) or one under another ('column': a list) */
    segments?: 'row' | 'column'
    /* A frame other shapes belong to ([in=id]); its header runs along the top ('top') or down the left ('side', a
       swimlane, its label turned to read upwards) */
    container?: 'top' | 'side'
    /* The maps it can show ([map=lancashire], the Map box in the properties panel), by the name the text uses: what
       the panel calls each, and the label it starts with (all its parts). The first is the one with no setting. */
    maps?: Record<string, { name: string, sample: string }>
    /* The languages it can show ([lang=py], the Language box in the properties panel): by the name the text uses
       and the dropdown's label. The first is the one with no setting. */
    langs?: Record<string, { name: string }>
    /* The faces it can pull ([face=sad], the Face box in the properties panel), like langs: the first is the one
       with no setting. The label never changes the face. */
    faces?: Record<string, { name: string }>
    /* A container whose members are cut off at its edges, with a scrollbar (a scroll area); it keeps its size
       rather than growing round them */
    scroll?: boolean
}