/* Builds the outline data for the geographic maps (src/shapes/maps/*.ts) from files downloaded by hand. Each map is
   rebuilt only when its files are given:

     node scripts/build-maps.mjs --world=<geojson> --uk=<geojson> --yorkshire=<geojson> --roads=<folder>
         --counties=<geojson> --lookup=<json> --admin1=<geojson>

   world (worldmap): Natural Earth 1:110m admin 0 countries (public domain)
     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
   uk (countrymap): ONS International Territorial Level 1 (January 2025), ultra generalised (BUC), Open Government
     Licence
     https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/ITL1_JAN_2025_UK_BUC/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson
   yorkshire (routemap): ONS International Territorial Level 2 (January 2025), generalised (BGC), the four in Yorkshire
     and the Humber, in British National Grid (outSR=27700), Open Government Licence
     https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/ITL2_JAN_2025_UK_BGC/FeatureServer/0/query?where=ITL225CD%20LIKE%20%27TLE%25%27&outFields=ITL225CD,ITL225NM&outSR=27700&f=geojson
   admin1 (countrymap's other countries): Natural Earth 1:10m admin 1 states and provinces (public domain), for the
     countries in COUNTRIES below
     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
   counties (routemap's other maps): ONS Local Authority Districts (May 2025), generalised (BGC), in British National
     Grid, for the districts the lookup lists, Open Government Licence
     https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0/query?where=LAD25CD%20IN%20(...)&outFields=LAD25CD,LAD25NM&outSR=27700&f=geojson
   lookup (with counties): which ITL2 area (county) each district is in, ONS's ITL to LAD lookup as ArcGIS JSON, for
     the counties in COUNTIES below
     https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/ITL125_ITL225_ITL325_LAU125_LAD25_UK_LU/FeatureServer/0/query?where=ITL225CD%20IN%20(%27TLD1%27,%27TLD3%27,%27TLD4%27,%27TLD6%27,%27TLD7%27)&outFields=*&returnDistinctValues=true&f=json
   roads (with yorkshire or counties): a folder holding OS Open Roads' RoadLink shapefiles (.shp and .dbf) for the
     100 km squares round them (SD, SE, TA, SK, NZ, NY, TF, SJ: data/SE_RoadLink.shp and so on in the GB download), OS
     OpenData licence (Open Government Licence)
     https://api.os.uk/downloads/v1/products/OpenRoads/downloads?area=GB&format=ESRI%C2%AE+Shapefile&redirect

   Each region is projected (Natural Earth projection for the world, a plain one scaled for the UK's latitude; Yorkshire
   is in British National Grid already), put on a grid of whole numbers a set height tall, y up, simplified
   (Douglas-Peucker) and tiny islands dropped. A route map's motorways and primary A roads (the green-signed ones; slip
   roads left out) are joined end to end into long lines, cut off at its edge and simplified the same way. The app only
   scales the result to the shape. */
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map(a => a.match(/^--(\w+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
if (!args.world && !args.uk && !args.yorkshire && !args.counties && !args.admin1)
    throw new Error('usage: node scripts/build-maps.mjs --world=<geojson> --uk=<geojson> --yorkshire=<geojson> --roads=<folder> --counties=<geojson> --lookup=<json> --admin1=<geojson>')
if ((args.yorkshire || args.counties) && !args.roads) throw new Error('--yorkshire and --counties need --roads, the folder of OS Open Roads shapefiles')
if (args.counties && !args.lookup) throw new Error('--counties needs --lookup, the district to county lookup')

/* Lower case letters and digits only, so "Côte d'Ivoire", "cote divoire" and "COTE D'IVOIRE" match */
const key = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const naturalEarth = ([lon, lat]) => {
    const l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2
    return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
        p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))]
}
/* Longitude scaled to be true at one latitude: near enough for a country, and simple */
const plain = lat0 => ([lon, lat]) => [lon * Math.cos(lat0 * Math.PI / 180), lat]
const ukPlain = plain(54.5)
const asIs = p => p

const area = r => r.reduce((t, p, i) => {
    const q = r[(i + 1) % r.length]
    return t + p[0] * q[1] - q[0] * p[1]
}, 0) / 2

const centroid = r => {
    let a = 0, x = 0, y = 0
    r.forEach((p, i) => {
        const q = r[(i + 1) % r.length], c = p[0] * q[1] - q[0] * p[1]
        a += c
        x += (p[0] + q[0]) * c
        y += (p[1] + q[1]) * c
    })
    return [x / (3 * a), y / (3 * a)]
}

function simplify(pts, tol) {   // Douglas-Peucker, keeping the ends
    if (pts.length < 4) return pts
    const keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]]
    keep[0] = keep[pts.length - 1] = 1
    while (stack.length) {
        const [a, b] = stack.pop(), [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay,
            len = Math.hypot(dx, dy)
        let far = -1, at = -1
        for (let i = a + 1; i < b; i++) {
            const d = len ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len
                : Math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            if (d > far) [far, at] = [d, i]
        }
        if (far > tol) {
            keep[at] = 1
            stack.push([a, at], [at, b])
        }
    }
    return pts.filter((_, i) => keep[i])
}

const dedupe = pts => pts.filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1])

/* regions: [{name, keys, polys}] with polys as lists of outer rings in lon/lat (holes are dropped: none show at this
   size); lines: [{kind, name, pts}], roads to draw over them, in the same coordinates. Returns the TypeScript module's
   text. */
function build(regions, project, height, tol, minArea, about, lines = []) {
    const proj = regions.map(r => ({...r, polys: r.polys.map(ring => ring.map(project))}))
    const all = proj.flatMap(r => r.polys.flat())
    const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])),
        y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]))
    const k = height / (y1 - y0), width = Math.round((x1 - x0) * k)
    const grid = p => [Math.round((p[0] - x0) * k), Math.round((p[1] - y0) * k)]
    let points = 0
    const out = proj.map(r => {
        const rings = r.polys.map(ring => {
            let g = dedupe(simplify(ring.map(grid), tol))
            if (g.length < 4) g = dedupe(ring.map(grid))   // too small to simplify: kept as it is, so it isn't lost
            return {g, a: Math.abs(area(g))}
        }).sort((p, q) => q.a - p.a)
        const kept = rings.filter((x, i) => x.g.length >= 4 && (i === 0 || x.a >= minArea))
        points += kept.reduce((t, x) => t + x.g.length, 0)
        const [cx, cy] = centroid(kept[0].g)
        return {
            name: r.name, keys: [...new Set(r.keys.map(key).filter(Boolean))], at: [Math.round(cx), Math.round(cy)],
            rings: kept.map(x => x.g.flat())
        }
    }).sort((p, q) => p.name.localeCompare(q.name))
    const roads = lines.map(l => ({...l, pts: dedupe(simplify(l.pts.map(project).map(grid), tol))}))
        .filter(l => l.pts.length > 1 && !(l.pts.length === 2 && Math.hypot(l.pts[1][0] - l.pts[0][0], l.pts[1][1] - l.pts[0][1]) < 2))
    points += roads.reduce((t, l) => t + l.pts.length, 0)
    console.log(`${about.split('\n')[0]}: ${out.length} regions, ${roads.length} roads, ${points} points, ${width}x${height}`)
    return `/* Generated by scripts/build-maps.mjs; don't edit by hand. ${about} */\n` +
        `import type {MapData} from '../geomap'\n\n` +
        `export default {\n    w: ${width},\n    h: ${height},\n    regions: [\n` +
        out.map(r => `        {name: ${JSON.stringify(r.name)}, keys: ${JSON.stringify(r.keys)}, at: ${JSON.stringify(r.at)},\n` +
            `            rings: [${r.rings.map(x => JSON.stringify(x)).join(',\n                ')}]}`).join(',\n') +
        `\n    ]` + (roads.length ? `,\n    lines: [\n` + roads.map(l =>
                `        {kind: ${JSON.stringify(l.kind)}, name: ${JSON.stringify(l.name)}, pts: ${JSON.stringify(l.pts.flat())}}`).join(',\n') +
            `\n    ]` : '') + `\n} satisfies MapData\n`
}

fs.mkdirSync('src/shapes/maps', {recursive: true})
const polysOf = geom => geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.coordinates.map(p => p[0])

/* ---------- the world: every country but Antarctica ---------- */

const EXTRA = {   // names people write that Natural Earth doesn't carry
    GBR: ['UK', 'Britain', 'Great Britain'],
    USA: ['US', 'America', 'United States of America'],
    RUS: ['Russian Federation'],
    KOR: ['South Korea', 'Korea'],
    PRK: ['North Korea'],
    COD: ['DRC', 'DR Congo', 'Congo Kinshasa'],
    COG: ['Congo Brazzaville'],
    CZE: ['Czech Republic'],
    MKD: ['Macedonia'],
    SWZ: ['Swaziland'],
    CIV: ['Ivory Coast'],
    TUR: ['Turkiye'],
    NLD: ['Holland'],
}
if (args.world) {
    const world = JSON.parse(fs.readFileSync(args.world, 'utf8')).features
        .filter(f => f.properties.ADM0_A3 !== 'ATA')
        .map(f => {
            const p = f.properties,
                codes = [p.ISO_A2, p.ISO_A2_EH, p.ISO_A3, p.ISO_A3_EH, p.ADM0_A3].filter(c => c && c !== '-99')
            return {
                name: p.NAME,
                keys: [p.NAME, p.NAME_LONG, p.ADMIN, p.ABBREV, p.FORMAL_EN, p.NAME_EN, ...codes, ...(EXTRA[p.ADM0_A3] ?? [])],
                polys: polysOf(f.geometry)
            }
        })
    fs.writeFileSync('src/shapes/maps/world.ts', build(world, naturalEarth, 500, 0.9, 6,
        'World countries\n   from Natural Earth 1:110m admin 0 countries (public domain, naturalearthdata.com), Antarctica left out,\n   in the Natural Earth projection.'))
}

/* ---------- the UK: its twelve ITL1 regions (England's nine, Scotland, Wales, Northern Ireland) ---------- */

const UK_EXTRA = {
    TLC: ['North East England', 'NE England', 'North East'],
    TLD: ['North West England', 'NW England', 'North West'],
    TLE: ['Yorkshire', 'Yorkshire and the Humber', 'Yorkshire & the Humber', 'Yorks'],
    TLF: ['East Midlands'],
    TLG: ['West Midlands'],
    TLH: ['East of England', 'East', 'East Anglia', 'Eastern'],
    TLI: ['Greater London'],
    TLJ: ['South East England', 'SE England', 'South East'],
    TLK: ['South West England', 'SW England', 'South West'],
    TLL: ['Cymru'],
    TLM: ['Alba'],
    TLN: ['NI', 'N Ireland', 'Ulster'],
}
if (args.uk) {
    const uk = JSON.parse(fs.readFileSync(args.uk, 'utf8')).features.map(f => {
        const p = f.properties, name = p.ITL125NM.replace(/ \(England\)$/, '').replace(/^East$/, 'East of England')
        return {name, keys: [p.ITL125NM, name, p.ITL125CD, ...(UK_EXTRA[p.ITL125CD] ?? [])], polys: polysOf(f.geometry)}
    })
    fs.writeFileSync('src/shapes/maps/uk.ts', build(uk, ukPlain, 500, 1.2, 10,
        'UK regions (ITL1)\n   Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data\n   © Crown copyright and database right 2025. ITL1 January 2025, ultra generalised clipped (BUC).'))
}

/* ---------- the country map's other countries: their parts, from Natural Earth's states and provinces ---------- */

/* Each by the module it goes in: its ISO code, the parts of it to keep (a country's mainland, say) and the latitude its
   plain projection is true at. Another country is another entry here, then one in COUNTRY_MAPS in src/shapes/charts.ts. */
const COUNTRIES = {
    france: {iso: 'FRA', lat: 46.5, keep: p => p.type_en === 'Metropolitan department'},
}
if (args.admin1) {
    const all = JSON.parse(fs.readFileSync(args.admin1, 'utf8')).features
    for (const [file, c] of Object.entries(COUNTRIES)) {
        const parts = all.filter(f => f.properties.adm0_a3 === c.iso && c.keep(f.properties)).map(f => {
            const p = f.properties, code = p.iso_3166_2 && p.iso_3166_2.split('-')[1]
            return {name: p.name, keys: [p.name, p.name_en, p.gn_name, p.iso_3166_2, code], polys: polysOf(f.geometry)}
        })
        fs.writeFileSync(`src/shapes/maps/${file}.ts`, build(parts, plain(c.lat), 500, 0.9, 3,
            `${file}: its states or provinces (${parts.length})\n   from Natural Earth 1:10m admin 1 states and provinces (public domain, naturalearthdata.com).`))
    }
}

/* ---------- route maps: an area's parts, with its main roads ---------- */

/* The records of a polyline shapefile (.shp, plain or with Z) with the fields asked for from its .dbf, skipping any
   whose box misses `within` (x0, y0, x1, y1) */
function readShapes(base, fields, within) {
    const shp = fs.readFileSync(base + '.shp'), dbf = fs.readFileSync(base + '.dbf')
    const nRec = dbf.readUInt32LE(4), headLen = dbf.readUInt16LE(8), recLen = dbf.readUInt16LE(10), cols = {}
    for (let i = 32, at = 1; dbf[i] !== 0x0d; i += 32) {
        const name = dbf.toString('latin1', i, i + 11).replace(/\0.*$/, ''), len = dbf[i + 16]
        cols[name] = {at, len}
        at += len
    }
    const out = []
    let pos = 100
    for (let r = 0; r < nRec && pos < shp.length; r++) {
        const len = shp.readInt32BE(pos + 4) * 2, c = pos + 8
        pos = c + len
        if (shp.readInt32LE(c) === 0) continue   // a null shape
        const bx0 = shp.readDoubleLE(c + 4), by0 = shp.readDoubleLE(c + 12), bx1 = shp.readDoubleLE(c + 20),
            by1 = shp.readDoubleLE(c + 28)
        if (bx1 < within[0] || bx0 > within[2] || by1 < within[1] || by0 > within[3]) continue
        const row = Object.fromEntries(fields.map(f => [f, dbf.toString('utf8', headLen + r * recLen + cols[f].at,
            headLen + r * recLen + cols[f].at + cols[f].len).trim()]))
        const nParts = shp.readInt32LE(c + 36), nPts = shp.readInt32LE(c + 40), ptAt = c + 44 + nParts * 4
        for (let k = 0; k < nParts; k++) {
            const a = shp.readInt32LE(c + 44 + k * 4), b = k + 1 < nParts ? shp.readInt32LE(c + 48 + k * 4) : nPts
            const pts = []
            for (let i = a; i < b; i++) pts.push([shp.readDoubleLE(ptAt + i * 16), shp.readDoubleLE(ptAt + i * 16 + 8)])
            out.push({...row, pts})
        }
    }
    return out
}

const inRings = (p, rings) => {   // even-odd: inside an odd number of rings
    let inside = false
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++)
        if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])
            inside = !inside
    return inside
}

/* Links of one road joined into long lines wherever one ends where another starts */
function joinLinks(links) {
    const at = new Map(), ptKey = p => `${Math.round(p[0])},${Math.round(p[1])}`, used = new Set(), out = []
    links.forEach((l, i) => {
        for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) {
            const k = ptKey(p)
            if (!at.has(k)) at.set(k, [])
            at.get(k).push(i)
        }
    })
    const next = p => (at.get(ptKey(p)) ?? []).find(i => !used.has(i))
    links.forEach((l, i) => {
        if (used.has(i)) return
        used.add(i)
        let pts = [...l.pts]
        for (let j = next(pts[pts.length - 1]); j != null; j = next(pts[pts.length - 1])) {   // on from the end
            used.add(j)
            const q = links[j].pts, fwd = ptKey(q[0]) === ptKey(pts[pts.length - 1])
            pts = [...pts, ...(fwd ? q : [...q].reverse()).slice(1)]
        }
        for (let j = next(pts[0]); j != null; j = next(pts[0])) {   // and back from the start
            used.add(j)
            const q = links[j].pts, fwd = ptKey(q[q.length - 1]) === ptKey(pts[0])
            pts = [...(fwd ? q : [...q].reverse()).slice(0, -1), ...pts]
        }
        out.push({...l, pts})
    })
    return out
}

/* A line cut into the runs of it inside the rings, each ending where it crosses their edge (found by halving) */
function clip(pts, rings) {
    const runs = [], ins = pts.map(p => inRings(p, rings))
    const edge = (a, b) => {   // a inside, b outside
        let lo = a, hi = b
        for (let n = 0; n < 24; n++) {
            const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]
            if (inRings(m, rings)) lo = m; else hi = m
        }
        return lo
    }
    let run = null
    pts.forEach((p, i) => {
        if (ins[i]) {
            if (!run) run = i ? [edge(p, pts[i - 1])] : []
            run.push(p)
        } else if (run) {
            run.push(edge(pts[i - 1], p))
            runs.push(run)
            run = null
        }
    })
    if (run) runs.push(run)
    return runs.filter(r => r.length > 1)
}

const YORKS_NAMES = {
    TLE1: ['East Yorkshire', ['East Yorkshire and Northern Lincolnshire', 'East Riding', 'East Riding of Yorkshire', 'Humber', 'Hull', 'East Yorks']],
    TLE2: ['North Yorkshire', ['North Yorks', 'York']],
    TLE3: ['South Yorkshire', ['South Yorks', 'Sheffield']],
    TLE4: ['West Yorkshire', ['West Yorks', 'Leeds']],
}
const ringsOf = regions => regions.flatMap(r => r.polys.map(g => simplify(g, 30)))
const boxOf = pts => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])),
    Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]

/* Every motorway and primary A road with a link in the box, each joined end to end into long lines (British National
   Grid) */
function mainRoads(box) {
    const links = fs.readdirSync(args.roads).filter(f => /_RoadLink\.shp$/i.test(f))
        .flatMap(f => readShapes(path.join(args.roads, f.replace(/\.shp$/i, '')), ['class', 'roadNumber', 'primary', 'formOfWay'], box))
        .filter(l => l.formOfWay !== 'Slip Road' && (l.class === 'Motorway' || (l.class === 'A Road' && l.primary === 'true')))
        .map(l => ({kind: l.class === 'Motorway' ? 'motorway' : 'primary', name: l.roadNumber, pts: l.pts}))
    return [...Map.groupBy(links, l => l.kind + ' ' + l.name).values()].flatMap(joinLinks)
}

/* A route map's module: its parts, and the roads cut off at its edge, A roads first so motorways cross over them */
function routeMap(file, regions, roads, about) {
    const rings = ringsOf(regions)
    const lines = roads.flatMap(l => clip(l.pts, rings).map(pts => ({...l, pts})))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'primary' ? -1 : 1) || a.name.localeCompare(b.name))
    fs.writeFileSync(`src/shapes/maps/${file}.ts`, build(regions, asIs, 500, 0.6, 2, about, lines))
}

const OS_ROADS = 'Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data\n   © Crown copyright and database right 2025 and 2026.'

if (args.yorkshire) {
    const yorks = JSON.parse(fs.readFileSync(args.yorkshire, 'utf8')).features.map(f => {
        const p = f.properties, [name, more] = YORKS_NAMES[p.ITL225CD] ?? [p.ITL225NM, []]
        return {name, keys: [p.ITL225NM, name, p.ITL225CD, ...more], polys: polysOf(f.geometry)}
    })
    routeMap('yorkshire', yorks, mainRoads(boxOf(ringsOf(yorks).flat())),
        `Yorkshire and the Humber (ITL2), with its motorways and primary A roads\n   ${OS_ROADS} ITL2 January 2025, generalised clipped (BGC); OS Open Roads.`)
}

/* The counties (ITL2 areas) a route map can show besides Yorkshire, by the module each goes in. Each is split into its
   council districts; ONS puts Halton (Widnes and Runcorn) in Merseyside. */
const COUNTIES = {
    TLD1: 'cumbria',
    TLD3: 'greatermanchester',
    TLD4: 'lancashire',
    TLD6: 'cheshire',
    TLD7: 'merseyside',
}
const DISTRICT_EXTRA = {   // names people write for a district that aren't its official one
    'St. Helens': ['St Helens', 'Saint Helens'],
    'Blackburn with Darwen': ['Blackburn', 'Darwen'],
    'Cheshire West and Chester': ['Chester', 'Cheshire West'],
    'Westmorland and Furness': ['Westmorland', 'Furness', 'Barrow', 'Kendal'],
    'Cumberland': ['Carlisle', 'Workington'],
    'Halton': ['Widnes', 'Runcorn'],
    'Wirral': ['The Wirral', 'Birkenhead'],
}
if (args.counties) {
    const countyOf = Object.fromEntries(JSON.parse(fs.readFileSync(args.lookup, 'utf8')).features
        .map(f => [f.attributes.LAD25CD, f.attributes.ITL225CD]))
    const districts = JSON.parse(fs.readFileSync(args.counties, 'utf8')).features
        .filter(f => COUNTIES[countyOf[f.properties.LAD25CD]])
        .map(f => {
            const p = f.properties
            return {
                county: countyOf[p.LAD25CD], name: p.LAD25NM.replace(/^St\. /, 'St '),
                keys: [p.LAD25NM, p.LAD25CD, ...(DISTRICT_EXTRA[p.LAD25NM] ?? [])], polys: polysOf(f.geometry)
            }
        })
    const roads = mainRoads(boxOf(ringsOf(districts).flat()))
    for (const [code, file] of Object.entries(COUNTIES)) {
        const parts = districts.filter(d => d.county === code)
        routeMap(file, parts, roads, `${file} (ITL2 ${code}), its council districts, with its motorways and primary A roads\n   ` +
            `${OS_ROADS} Local Authority Districts May 2025, generalised clipped (BGC); OS Open Roads.`)
    }
}
