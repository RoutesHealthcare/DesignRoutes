/* Geographic maps (choropleths with real outlines): every region of a map drawn from outline data carried in the app
   (src/shapes/maps, built by scripts/build-maps.mjs), the ones named in the label shaded by their values like a tile
   map's tiles. Pure functions, sizes in inches, y up, like labelled.ts. */
import type {PartPlace, Point, PointSection} from './types'
import {CHAR_W, fitSize, type Layout} from './labelled'
import {segmentsOf} from './wireframe'

/* A map's outlines on a grid of whole numbers w by h, y up. A region is its name, the keys it can be named by
   (lower case letters and digits: "unitedkingdom", "uk", "gbr"), where its name goes, and its outlines, each a flat
   list of x, y pairs, first point repeated at the end. */
export type MapRegion = { name: string, keys: string[], at: [number, number], rings: number[][] }
/* A road drawn over the regions: a motorway (blue) or a primary A road (green), as on the signs, its points a flat list
   of x, y pairs on the same grid */
export type MapLine = { kind: 'motorway' | 'primary', name: string, pts: number[] }
export type MapData = { w: number, h: number, regions: MapRegion[], lines?: MapLine[] }

const ROAD_SERIES = {primary: 4, motorway: 2}   // series colours: green and blue (SERIES_FILLS)

/* As the keys are written: "Côte d'Ivoire" and "cote divoire" match */
export const regionKey = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const lookups = new WeakMap<MapData, Map<string, number>>(), extents = new WeakMap<MapData, [number, number][]>()

/* Which region a name in the label means, or undefined when none: by any of its keys */
export function regionOf(map: MapData, name: string): number | undefined {
    let byKey = lookups.get(map)
    if (!byKey) {
        byKey = new Map()
        map.regions.forEach((r, i) => r.keys.forEach(k => byKey!.has(k) || byKey!.set(k, i)))
        lookups.set(map, byKey)
    }
    return byKey.get(regionKey(name))
}

/* Each region's width and height on the map's grid, worked out once */
function extentsOf(map: MapData) {
    let ex = extents.get(map)
    if (!ex) {
        ex = map.regions.map(r => {
            const xs = r.rings.flatMap(g => g.filter((_, i) => i % 2 === 0)),
                ys = r.rings.flatMap(g => g.filter((_, i) => i % 2 === 1))
            return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
        })
        extents.set(map, ex)
    }
    return ex
}

/* The map as large as fits the shape, centred. Each region named in the label is shaded from pale (the lowest value)
   to the shape's fill (the highest; only part of the way on a map with roads, so they show), as a tile map's tiles
   are; regions not named, or named with no value, are left
   nearly white. A name that matches no region is left out. A named region's name sits on it, as large as fits but no
   smaller than half the label's size, in whichever text reads better on the region (a small one's runs over its
   edges). A map with roads draws them over the regions, motorways after A roads so they cross over them. */
export function geomapLayout(map: MapData, W: number, H: number, label: string | undefined, values: number[]): Layout {
    const k = Math.min(W / map.w, H / map.h), x0 = (W - map.w * k) / 2, y0 = (H - map.h * k) / 2
    const names = segmentsOf(label), named = new Map<number, number>()   // region -> its part of the label
    names.forEach((n, i) => {
        const r = n ? regionOf(map, n) : undefined
        if (r != null) named.set(r, i)
    })
    const given = [...named.values()].map(i => values[i]).filter(v => Number.isFinite(v))
    const lo = Math.min(...given), span = Math.max(...given) - lo || 1, ex = extentsOf(map),
        top = map.lines?.length ? 0.6 : 1   // under roads, no darker than this, so they show on every region
    const sections: PointSection[] = [], places: PartPlace[] = []
    map.regions.forEach((r, ri) => {
        const i = named.get(ri), v = i == null ? NaN : values[i],
            shade = Number.isFinite(v) ? 0.15 + (top - 0.15) * (v - lo) / span : 0.04
        const pts: Point[] = r.rings.flatMap(g => Array.from({length: g.length / 2}, (_, j): Point =>
            [x0 + g[j * 2] * k, y0 + g[j * 2 + 1] * k, j ? 'LineTo' : 'MoveTo']))
        sections.push({series: 0, shade, pts})
        if (i == null) return
        const w = ex[ri][0] * k, h = ex[ri][1] * k, size = Math.min(0.8, fitSize(names[i], w, h))
        places[i] = {
            x: x0 + r.at[0] * k, y: y0 + r.at[1] * k, w: Math.max(w, names[i].length * CHAR_W * size + 0.1), size,
            on: 0, onShade: shade
        }
    })
    for (const l of map.lines ?? []) sections.push({
        noFill: 1, series: ROAD_SERIES[l.kind],
        pts: Array.from({length: l.pts.length / 2}, (_, j): Point => [x0 + l.pts[j * 2] * k, y0 + l.pts[j * 2 + 1] * k])
    })
    return {sections, places}
}
