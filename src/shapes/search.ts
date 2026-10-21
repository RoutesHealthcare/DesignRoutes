/* Searching the palette: shapes and ready-made patterns that match what's typed in the palette's search box. Pure, so
   it's the same in the component and the tests. Every word typed has to match somewhere in an item's caption, tooltip,
   type, the names you can type for it (ShapeKinds: "postit" finds the sticky note) or its palette group; the best
   matches come first, those whose caption starts with what's typed ahead of those that only mention it. */
import {PALETTE, type PaletteItem} from './registry'
import {PATTERN_GROUPS, PATTERNS, type Pattern} from './patterns'
import {ShapeKinds} from '../engine/flow/shape-kinds'

export type PaletteMatch = { shape: PaletteItem, pattern?: never } | { pattern: Pattern, shape?: never }

/* The names you can type for each shape type, other than its own */
const aliases = new Map<string, string[]>()
for (const [alias, kind] of Object.entries(ShapeKinds)) aliases.set(kind, [...(aliases.get(kind) ?? []), alias])

/* What can be searched for each palette item, best places to match first */
const SHAPE_ENTRIES = [
    ...PALETTE.pinned.map(i => ({i, group: ''})),
    ...PALETTE.groups.flatMap(g => g.items.map(i => ({i, group: g.name})))
].map(({i, group}): [PaletteMatch, string[]] =>
    [{shape: i}, [i.label, i.kind, ...(aliases.get(i.kind) ?? []), i.title ?? '', group]])
const PATTERN_ENTRIES = PATTERNS.map((p): [PaletteMatch, string[]] =>
    [{pattern: p}, [p.label, p.name, p.title, PATTERN_GROUPS[p.group], 'Patterns']])

/* How well one word matches an item's fields: 3 for the caption starting with it, 2 for a word of the caption, the
   type or a name for it starting with it, 1 for it anywhere at all, 0 for nowhere */
function score(word: string, fields: string[]): number {
    const [caption, ...rest] = fields.map(f => f.toLowerCase())
    if (caption.startsWith(word)) return 3
    const names = [caption, ...rest.slice(0, -2)]   // the caption, the type and its other names, not tooltip or group
    if (names.some(f => f.split(/[^a-z0-9]+/).some(w => w.startsWith(word)))) return 2
    return fields.some(f => f.toLowerCase().includes(word)) ? 1 : 0
}

/* The palette items matching a search, best first; an empty search matches nothing */
export function searchPalette(query: string): PaletteMatch[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return [...SHAPE_ENTRIES, ...PATTERN_ENTRIES]
        .map(([item, fields], order) => {
            const scores = words.map(w => score(w, fields))
            return {item, order, total: scores.includes(0) ? 0 : scores.reduce((t, s) => t + s, 0)}
        })
        .filter(m => m.total > 0)
        .sort((a, b) => b.total - a.total || a.order - b.order)
        .map(m => m.item)
}
