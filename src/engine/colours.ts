/* ---------- colours ---------- */
/* The editor's own defaults: what a shape gets when neither the .flow text nor its Visio master says otherwise */
export const DEF = {
    fill: '#FFFFFF',   // shape fill
    line: '#2B3A47',   // outlines and connections
    text: '#1E2933',   // labels
    textOnDark: '#FFFFFF',   // labels on a fill too dark for DEF.text (see readableText in core.ts)
};

/* The rest of the colours drawings use. Where flow-editor.css has the same colour, it's named the same there. */
export const PAPER = '#FFFFFF';    // the page (--paper): behind exports and pictures, round labels, inside hollow line ends
export const ACCENT = '#1F6F78';   // (--accent) table headers, charts, most wireframe pieces
export const PALE = '#E9EEF2';     // grid header rows, avatars
/* C4 diagrams' usual blues, darkest for people and lightest for components, and a grey for systems outside the one
   being drawn. White text on all but the component, as C4 diagrams have it. */
export const C4 = {
    person: '#08427B',
    system: '#1168BD',
    container: '#438DD5',
    component: '#85BBF0',
    external: '#8C8C8C'
};
export const STICKY = '#FFE38A';  // sticky notes: the yellow of a paper one; dark text holds well on it
export const ERROR = '#B9474F';    // inline errors: the third series colour, so it holds 3:1 against the paper too

/* Fills for the parts of a chart (pie slices, funnel bands, ...). Series 0 is the shape's own fill, so [fill=] in the
   text still colours a chart, and a one-colour chart looks as it always has; series 1, 2, ... take this built-in
   palette in turn, warm and cool alternating so neighbours differ. The page is white paper in both themes, so each
   colour is picked to hold at least 3:1 against white; chart labels sit on the paper, never on these fills.
   These are the defaults: a chart or legend's own [colours=] in the text come first (seriesFill in shapes/series.ts),
   and series past the end of those carry on here. */
export const SERIES_FILLS = ['#C9781C', '#4A6FB5', '#B9474F', '#5E8C33', '#8460A8'];

/* The colours the text pane suggests after fill=, stroke= or text= */
export const SUGGESTED_COLOURS: [hex: string, name: string][] = [
    ['#FA4616', 'Blood Orange'],
    ['#00B5E2', 'Cyan'],
    ['#44D62C', 'Green'],
    ['#DCE3EB', 'Silver'],
    ['#282822', 'Charcoal'],
    ['#FFFFFF', 'White'],
    ['#F0A63E', 'Yellow'],
    ['#50B29C', 'Teal'],
    ['#006F8E', 'Harbor Blue'],
    [DEF.line, 'Default line'],
];

/* Visio's fixed colour table. Older Visio files store a colour as its number here rather than as hex, so the
   order is Visio's and must not change: VISIO_COLOURS[n] is colour n. The greys are named by how dark they are. */
export const VISIO_COLOUR = {
    black: '#000000',   // 0
    white: '#FFFFFF',   // 1
    red: '#FF0000',   // 2
    green: '#00FF00',   // 3
    blue: '#0000FF',   // 4
    yellow: '#FFFF00',   // 5
    magenta: '#FF00FF',   // 6
    cyan: '#00FFFF',   // 7
    darkRed: '#800000',   // 8
    darkGreen: '#008000',   // 9
    darkBlue: '#000080',   // 10
    olive: '#808000',   // 11
    purple: '#800080',   // 12
    teal: '#008080',   // 13
    silver: '#C0C0C0',   // 14
    grey10: '#E6E6E6',   // 15
    grey20: '#CDCDCD',   // 16
    grey30: '#B3B3B3',   // 17
    grey40: '#9A9A9A',   // 18
    grey50: '#808080',   // 19
    grey60: '#666666',   // 20
    grey70: '#4D4D4D',   // 21
    grey80: '#333333',   // 22
    grey90: '#1A1A1A',   // 23
} as const;

/* What Visio itself uses when a shape has no colour cell. Not DEF: a Visio file must look as Visio draws it. */
export const VISIO_DEFAULT = {
    line: VISIO_COLOUR.black,
    fill: VISIO_COLOUR.white,
    text: VISIO_COLOUR.black,
};