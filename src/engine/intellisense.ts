/* ---------- IntelliSense for the .flow text ----------
   Suggests what can come next at the caret: statements and shape ids at the start of a line, shape types after
   "id:", connection types after a shape id, shape ids after a connection, settings inside [ ] and their values,
   and page options. It opens as you type; Ctrl+Space opens it anywhere. Arrows move, Enter or Tab accepts,
   Escape closes. Nothing is suggested inside quoted text or comments. */
import {$, S} from './core';
import {SUGGESTED_COLOURS} from './colours';
import {CONN, LINE_STYLES, MARKERS, type ConnDef} from './flow/model';
import {FLOW_KINDS, splitComment} from './flow/language';
import {TP} from './text-pane';
import {SHAPES, isContainerKind, type ShapeDef} from '../shapes';
import {ShapeKinds} from "./flow/shape-kinds";

/* One suggestion: the text it inserts, and the help shown next to it */
type Item = [insert: string, detail: string];
/* What is being completed decides what accepting does: a kind gets its label quotes, a connection a space */
type SuggestKind = 'value' | 'setting' | 'kind' | 'id' | 'conn' | 'start';
/* The suggestions at the caret, and the word they would replace (from start up to the caret) */
type Suggestion = { start: number, word: string, kind: SuggestKind, items: Item[] };

const MAX_SHOWN = 50;
const ID = '[A-Za-z_][\\w-]*';
const STATEMENTS: Item[] = [['page', 'Start a page: page "Name" size 297x210'], ['key', 'Add the key that explains the lines'], ['icon', 'Define a picture: icon name "data:image/svg+xml;base64,..."']];
const SHAPE_SETTINGS: Record<string, string> = {
    fill: 'Fill colour',
    stroke: 'Line colour',
    text: 'Text colour',
    weight: 'Line weight in points',
    size: 'Text size in points',
    icon: 'Picture kept from an import',
    state: 'A switch: on or off',
    side: 'A chat bubble: left or right',
    map: 'A country map or route map: which country or county it shows',
    lang: 'A script: which language it is in',
    face: 'A mood: which face it pulls',
    colours: 'A chart or legend: a colour per series, like #AA3377,#228833',
    in: 'The container, pool or lane the shape is inside',
    flow: 'A container that lines up what is in it: row or column',
    gap: 'Space between the shapes in a flow container, in mm',
    align: 'How a flow container lines up its shapes across it',
    scroll: 'A scroll area: how far it is scrolled, in mm'
};
const LINE_SETTINGS: Record<string, string> = {
    style: 'Line pattern',
    start: 'Line end at the start',
    end: 'Line end at the finish',
    stroke: 'Line colour',
    weight: 'Line weight in points',
    size: 'Label size in points',
    text: 'Label colour',
    means: 'Meaning shown in the key',
    route: 'Straight or right-angled',
    via: 'Bend points in mm, like "40,20 40,60"'
};
const PAGE_SIZES: Item[] = [['297x210', 'A4 landscape'], ['210x297', 'A4 portrait'], ['420x297', 'A3 landscape'], ['594x420', 'A2 landscape'], ['841x594', 'A1 landscape']];
const DIRECTIONS: Item[] = [['TB', 'Top to bottom'], ['LR', 'Left to right'], ['BT', 'Bottom to top'], ['RL', 'Right to left']];
const POINTS = (w: number[]): Item[] => w.map(v => [String(v), v + ' pt']);
/* The values a setting can take; icon's depend on the document, so it is worked out when asked */
const VALUES: Record<string, Item[] | ((before: string) => Item[])> = {
    fill: SUGGESTED_COLOURS,
    stroke: SUGGESTED_COLOURS,
    text: SUGGESTED_COLOURS,
    colours: SUGGESTED_COLOURS,
    weight: POINTS([0.5, 0.75, 1, 1.5, 2, 3]), size: POINTS([8, 9, 10, 11, 12, 14, 18, 24]),
    style: Object.keys(LINE_STYLES).map(k => [k, '']), start: Object.entries(MARKERS), end: Object.entries(MARKERS),
    route: [['straight', 'A direct line'], ['elbow', 'Right angles, routed round shapes']],
    state: [['on', 'Switched on'], ['off', 'Switched off (the default)']],
    side: [['left', 'From them, its avatar at the left (the default)'], ['right', 'From me, its avatar at the right']],
    map: before => {   // the maps of the kind of shape on the line
        const typed = before.match(new RegExp(`^\\s*${ID}\\s*:\\s*([A-Za-z][\\w]*)`))?.[1] ?? '',
            kind = ShapeKinds[typed] ?? typed, maps = (SHAPES as Record<string, ShapeDef | undefined>)[kind]?.maps ?? {}
        return Object.entries(maps).map(([k, m], i): Item => [k, m.name + (i ? '' : ' (the default)')])
    },
    lang: before => {   // the languages of the kind of shape on the line
        const typed = before.match(new RegExp(`^\\s*${ID}\\s*:\\s*([A-Za-z][\\w]*)`))?.[1] ?? '',
            kind = ShapeKinds[typed] ?? typed, langs = (SHAPES as Record<string, ShapeDef | undefined>)[kind]?.langs ?? {}
        return Object.entries(langs).map(([k, l], i): Item => [k, l.name + (i ? '' : ' (the default)')])
    },
    face: before => {   // the faces of the kind of shape on the line
        const typed = before.match(new RegExp(`^\\s*${ID}\\s*:\\s*([A-Za-z][\\w]*)`))?.[1] ?? '',
            kind = ShapeKinds[typed] ?? typed,
            faces = (SHAPES as Record<string, ShapeDef | undefined>)[kind]?.faces ?? {}
        return Object.entries(faces).map(([k, f], i): Item => [k, f.name + (i ? '' : ' (the default)')])
    },
    flow: [['row', 'Side by side, in the order of their lines'], ['column', 'One under another, in the order of their lines']],
    gap: [['0', 'Touching'], ['2', '2 mm'], ['4', '4 mm (the default)'], ['8', '8 mm']],
    scroll: [['0', 'At the start (the default)'], ['20', '20 mm'], ['40', '40 mm']],
    align: [['stretch', 'As wide (or tall) as the container (the default)'], ['start', 'Along the start'], ['center', 'Centred'], ['end', 'Along the end']],
    in: () => (S.ast?.pages[S.pi]?.shapes ?? []).filter(d => isContainerKind(d.kind)).map((d): Item => [d.id, d.label || d.kind]),
    icon: () => [...(S.ast && S.ast.icons ? S.ast.icons.keys() : [])].map((n: string): Item => [n, 'Icon defined in this document']),
};
/* er and custom have no token: they are recognised by their ends, never typed in */
const CONNECTIONS: Item[] = Object.values(CONN).filter((c): c is ConnDef & {
    token: string
} => !!c.token).map((c): Item => [c.token, `${c.name}: ${c.means}`])
    .concat([['||--o{', 'One to many (database)'], ['||--||', 'One to one (database)'], ['}o--o{', 'Many to many (database)']]);
let kindHelp: Record<string, string> = {};

let codeText: HTMLTextAreaElement, box: HTMLUListElement, items: Item[] = [], active = 0,
    range: { start: number, end: number, kind: SuggestKind } | null = null;

/* The page the caret is on, by line number */
function pageAt(line: number) {
    const pages = (S.ast && S.ast.pages) || [];
    let p = pages[0];
    for (const ap of pages) if (ap.headerLine != null && ap.headerLine <= line) p = ap;
    return p;
}

const shapeIds = (line: number, skip?: string): Item[] => {
    const ap = pageAt(line);
    return ap ? ap.shapes.filter((d: any) => !d.implicit && d.id !== skip).map((d: any): Item => [d.id, d.label || d.kind]) : [];
};
const isConnectionToken = (t: string): boolean => CONNECTIONS.some(([tok]) => tok === t) || /^[|}][|o](--|\.\.)[|o][|{]$/.test(t);

/* What can be typed at the caret, or null when nothing fits there */
function suggestionsAt(text: string, caret: number): Suggestion | null {
    const lineStart = text.lastIndexOf('\n', caret - 1) + 1, before = text.slice(lineStart, caret),
        line = text.slice(0, caret).split('\n').length - 1;
    if (splitComment(before).code.length < before.length) return null;                          // in a comment
    if (((before.replace(/\\./g, '').match(/"/g) || []).length) % 2) return null;                   // in quoted text
    const tail = (re: RegExp) => {
        const m = before.match(re);
        return m ? {start: caret - m[m.length - 1].length, word: m[m.length - 1]} : null;
    };
    let m, t;
    // inside a settings list
    if ((m = before.match(/\[([^\]]*)$/))) {
        const shape = new RegExp(`^\\s*${ID}\\s*:`).test(before), names = shape ? SHAPE_SETTINGS : LINE_SETTINGS;
        const v = m[1].match(/([A-Za-z]+)=([^\s\]]*)$/);
        if (v) {
            const opts = VALUES[v[1].toLowerCase()];
            if (!opts) return null;
            const word = v[2].slice(v[2].lastIndexOf(',') + 1);   // a colours list: just the colour after the last comma
            return {
                start: caret - word.length,
                word,
                kind: 'value',
                items: (typeof opts === 'function' ? opts(before) : opts).map(([k, d]): Item => [k, d])
            };
        }
        const used = new Set([...m[1].matchAll(/([A-Za-z]+)=/g)].map(x => x[1].toLowerCase()));
        t = tail(/(?:^|[\s[])([A-Za-z]*)$/);
        if (!t) return null;
        return {
            ...t,
            kind: 'setting',
            items: Object.entries(names).filter(([k]) => !used.has(k)).map(([k, d]): Item => [k + '=', d])
        };
    }
    // page options
    if (/^\s*page\b/i.test(before)) {
        if ((t = tail(/\bdirection\s+([A-Za-z]*)$/i))) return {...t, kind: 'value', items: DIRECTIONS};
        if ((t = tail(/\bsize\s+([\dx.]*)$/i))) return {...t, kind: 'value', items: PAGE_SIZES};
        if (/"[^"]*"\s/.test(before) && (t = tail(/\s([A-Za-z]*)$/))) return {
            ...t,
            kind: 'setting',
            items: [['size ', 'Page size in mm'], ['direction ', 'Layout direction for automatic placing']]
        };
        return null;
    }
    // shape type after "id:"
    if ((t = tail(new RegExp(`^\\s*${ID}\\s*:\\s*([A-Za-z][A-Za-z0-9]*|)$`))))
        return {
            ...t,
            kind: 'kind',
            items: [...FLOW_KINDS.map((k: string): Item => [k, kindHelp[k] || '']), ...Object.entries(ShapeKinds).map(([a, k]): Item => [a, `Same as ${k}`])]
        };
    // shape id after a connection
    if ((m = before.match(new RegExp(`^\\s*(${ID})\\s+(\\S+)\\s+(${ID})?$`))) && isConnectionToken(m[2])) {
        const word = m[3] || '';
        return {start: caret - word.length, word, kind: 'id', items: shapeIds(line, m[1])};
    }
    // connection type after a shape id
    if ((m = before.match(new RegExp(`^\\s*(${ID})\\s+(\\S*)$`))) && !/^(page|key|icon|flow)$/i.test(m[1]))
        return {start: caret - m[2].length, word: m[2], kind: 'conn', items: CONNECTIONS};
    // start of a line: a statement, or a shape id to start a connection
    if ((t = tail(new RegExp(`^\\s*(${ID}|)$`))))
        return {
            ...t,
            kind: 'start',
            items: [...STATEMENTS, ...shapeIds(line).map(([id, l]): Item => [id, `Connect from: ${l}`])]
        };
    return null;
}

function rank(list: Item[], word: string): Item[] {
    const w = word.toLowerCase(), starts: Item[] = [], has: Item[] = [];
    for (const it of list) {
        const k = it[0].toLowerCase();
        if (k.startsWith(w)) starts.push(it); else if (w && k.includes(w)) has.push(it);
    }
    return [...starts, ...has];
}

/* Opens or refreshes the list. force: Ctrl+Space, which also shows suggestions before anything is typed. */
function update(force?: boolean): void {
    if (TP.mode !== 'flow' || codeText.selectionStart !== codeText.selectionEnd) {
        close();
        return;
    }
    const caret = codeText.selectionStart, ctx = suggestionsAt(codeText.value, caret);
    if (!ctx) {
        close();
        return;
    }
    const prev = codeText.value[caret - 1] || '',
        trigger = /[\s:[=>]/.test(prev) || (prev === ',' && ctx.kind === 'value');   // , : the next colour in a list
    if (!force && !ctx.word && (!trigger || ctx.kind === 'start')) {
        close();
        return;
    }
    items = rank(ctx.items, ctx.word).slice(0, MAX_SHOWN);
    if (!items.length || (!force && items.length === 1 && items[0][0] === ctx.word)) {
        close();
        return;
    }
    range = {start: ctx.start, end: caret, kind: ctx.kind};
    active = 0;
    draw();
    place();
}

function draw(): void {
    box.replaceChildren(...items.map(([label, detail], i) => {
        const li = document.createElement('li');
        li.id = 'sg-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === active));
        const a = document.createElement('span');
        a.className = 'sg-label';
        a.textContent = label.trim();
        const b = document.createElement('span');
        b.className = 'sg-detail';
        b.textContent = detail;
        li.append(a, b);
        li.addEventListener('mousedown', e => {
            e.preventDefault();
            active = i;
            accept();
        });
        return li;
    }));
    box.hidden = false;
    codeText.setAttribute('aria-expanded', 'true');
    codeText.setAttribute('aria-activedescendant', 'sg-' + active);
    const li = box.children[active];
    if (li) li.scrollIntoView({block: 'nearest'});
}

let charW = 0;

/* Under the start of the word being completed. The code font is monospaced with 18 px lines. */
function place(): void {
    if (!range) return;
    if (!charW) {
        const c = document.createElement('canvas').getContext('2d');
        if (c) c.font = getComputedStyle(codeText).font;
        charW = c?.measureText('0').width || 7.5;
    }
    const before = codeText.value.slice(0, range.start), line = before.split('\n').length - 1,
        col = before.length - before.lastIndexOf('\n') - 1;
    const pad = parseFloat(getComputedStyle(codeText).paddingLeft) || 10,
        top = 8 + (line + 1) * 18 - codeText.scrollTop, left = pad + col * charW - codeText.scrollLeft;
    const host = codeText.parentElement!.getBoundingClientRect();
    box.style.top = (top + box.offsetHeight > host.height && top > box.offsetHeight + 18 ? top - 18 - box.offsetHeight : top) + 'px';
    box.style.left = Math.max(0, Math.min(left, host.width - box.offsetWidth - 4)) + 'px';
}

function close(): void {
    if (box.hidden) return;
    box.hidden = true;
    items = [];
    range = null;
    codeText.setAttribute('aria-expanded', 'false');
    codeText.removeAttribute('aria-activedescendant');
}

function accept(): void {
    const it = items[active];
    if (!it || !range) return;
    let insert = it[0], back = 0;
    if (range.kind === 'kind') {
        insert += ' ""';
        back = 1;
    }                 // the label goes in the quotes
    else if (range.kind === 'conn') insert += ' ';
    codeText.focus();
    codeText.setSelectionRange(range.start, range.end);
    document.execCommand('insertText', false, insert);                 // keeps the browser's undo history
    if (back) codeText.setSelectionRange(codeText.selectionStart - back, codeText.selectionStart - back);
    close();
    if (/[=\s]$/.test(insert)) update(true);                            // straight on to the value or the next shape
}

export function init(): void {
    codeText = $<HTMLTextAreaElement>('codeText');
    box = $<HTMLUListElement>('suggest');
    for (const b of document.querySelectorAll<HTMLElement>('.palette [data-kind]')) kindHelp[b.dataset.kind!] = b.title || (b.textContent ?? '').trim();
    codeText.setAttribute('aria-autocomplete', 'list');
    codeText.setAttribute('aria-controls', 'suggest');
    codeText.setAttribute('aria-expanded', 'false');
    // capture, so the list handles its keys before the text pane uses Tab to indent and Escape to leave
    codeText.addEventListener('keydown', e => {
        if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            update(true);
            return;
        }
        if (box.hidden) return;
        const n = items.length, take = () => {
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        if (e.key === 'ArrowDown') {
            take();
            active = (active + 1) % n;
            draw();
        } else if (e.key === 'ArrowUp') {
            take();
            active = (active - 1 + n) % n;
            draw();
        } else if (e.key === 'PageDown') {
            take();
            active = Math.min(n - 1, active + 8);
            draw();
        } else if (e.key === 'PageUp') {
            take();
            active = Math.max(0, active - 8);
            draw();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            take();
            accept();
        } else if (e.key === 'Escape') {
            take();
            close();
        } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) close();
    }, true);
    codeText.addEventListener('input', e => {
        const inputType = (e as InputEvent).inputType;
        if (inputType && !inputType.startsWith('insert')) {
            if (!box.hidden) update();
            return;
        }
        update();
    });
    codeText.addEventListener('blur', close);
    codeText.addEventListener('click', close);
    codeText.addEventListener('scroll', () => {
        if (!box.hidden) place();
    });
}
