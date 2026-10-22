/* Checks .flow text with DesignRoutes's own parser (bundled beside this file as flow-parser.mjs). Needs only
   Node 18 or later; no install.

       node scripts/check-flow.mjs path/to/file.flow
       node scripts/check-flow.mjs - < file.flow          (reads stdin)

   Prints each page with its shape and connection counts, the animation's step count, the parser's own warnings,
   then every error with its line number, or "OK". On top of the parser's checks it warns about:
   - connections to ids with no shape line (the parser makes a process for each, but they're usually typos);
   - shapes with no position, other than those their parent places (flexi members, mind-map topics, lifelines
     after the first);
   - placed shapes that partly overlap (one wholly on top of another, or inside its own container, is fine).
   Exits 1 on errors, 2 on usage or read errors. */
import {readFileSync} from 'node:fs'
import {parseFlow, init} from './flow-parser.mjs'

const arg = process.argv[2]
if (!arg) {
    console.error('Usage: node check-flow.mjs <file.flow | ->')
    process.exit(2)
}
let text
try {
    text = readFileSync(arg === '-' ? 0 : arg, 'utf8')
} catch (err) {
    console.error(`Could not read ${arg === '-' ? 'stdin' : arg}: ${err.code ?? err.message}`)
    process.exit(2)
}
init()

const {pages, errors, notes = [], animation} = parseFlow(text)
for (const page of pages) reportPage(page)
if (animation) console.log(`animation: ${animation.steps.length} step(s)`)
for (const n of notes) console.log(`Line ${n.line + 1}: ${n.level ?? 'note'}: ${n.msg}`)
for (const e of errors) console.log(`Line ${e.line + 1}: ${e.msg}`)
console.log(errors.length ? `${errors.length} error(s)` : 'OK')
process.exit(errors.length ? 1 : 0)

function reportPage(page) {
    const declared = page.shapes.filter(s => !s.implicit)
    const size = page.size ? ` ${page.size.join('x')}` : ''
    console.log(`page "${page.name}" ${page.direction}${size}: ${declared.length} shapes, `
        + `${page.edges.length} connections${page.key ? ', key' : ''}`)
    warnList('connected but never declared (made as process)', page.shapes.filter(s => s.implicit))
    warnList('no position (add @ x,y WxH)', declared.filter(s => !s.place && !isPlacedByParent(s, page.byId)))
    for (const [a, b] of findOverlaps(declared, page.byId)) console.log(`  warning: ${a.id} and ${b.id} overlap`)
}

function warnList(what, shapes) {
    if (shapes.length) console.log(`  warning: ${what}: ${shapes.map(s => s.id).join(', ')}`)
}

/* A shape's place is decided by its parent when it's in a flexi container, hangs off a central topic, or is a
   lifeline after the first in its sequence. */
function isPlacedByParent(shape, byId) {
    if (byId.get(shape.attrs?.in)?.attrs?.flow) return true
    if (shape.map && shape.map.root !== shape.id) return true
    return Boolean(shape.seq && shape.seq.root !== shape.id)
}

/* True if shape sits in containerId, directly or through nested containers. The step limit stops a loop if
   containers ever name each other (the parser reports that as an error, but the file is still read). */
function isInside(shape, containerId, byId) {
    for (let at = shape, steps = 0; at?.attrs?.in && steps < byId.size; steps++) {
        if (at.attrs.in === containerId) return true
        at = byId.get(at.attrs.in)
    }
    return false
}

function intersects(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function encloses(outer, inner) {
    return inner.x >= outer.x && inner.y >= outer.y
        && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

/* Shapes that partly overlap usually look broken; one wholly on top of another (a button on a screen) is layering.
   Only shapes with a full @ x,y WxH can be compared; a shape sized to its text has no known size here. Every pair
   is compared, which is quick for the few hundred shapes a page holds. */
function findOverlaps(shapes, byId) {
    const boxed = shapes.filter(s => s.place?.w != null && s.place?.h != null)
    const overlaps = []
    for (let i = 0; i < boxed.length; i++) {
        for (let j = i + 1; j < boxed.length; j++) {
            const a = boxed[i], b = boxed[j]
            if (isInside(a, b.id, byId) || isInside(b, a.id, byId)) continue
            if (intersects(a.place, b.place) && !encloses(a.place, b.place) && !encloses(b.place, a.place))
                overlaps.push([a, b])
        }
    }
    return overlaps
}
