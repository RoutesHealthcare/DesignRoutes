/* Checks .flow text with DesignRoutes's own parser (bundled beside this file as flow-parser.mjs) and prints what it
   read: each page with its shape and connection counts, then every error with its line number, or "OK". Exits 1 on
   errors. Needs only Node 18 or later; no install.
       node scripts/check-flow.mjs path/to/file.flow
       node scripts/check-flow.mjs - < file.flow          (reads stdin)
   It also warns about connections to ids with no shape line: the parser allows them (it makes a process for each),
   but they're usually a typo. */
import {readFileSync} from 'node:fs'
import {parseFlow, init} from './flow-parser.mjs'

const arg = process.argv[2]
if (!arg) {
    console.error('Usage: node check-flow.mjs <file.flow | ->')
    process.exit(2)
}
const text = readFileSync(arg === '-' ? 0 : arg, 'utf8')
init()

const {pages, errors} = parseFlow(text)
for (const p of pages) {
    console.log(`page "${p.name}" ${p.direction}${p.size ? ` ${p.size.join('x')}` : ''}: ${p.shapes.filter(s => !s.implicit).length} shapes, `
        + `${p.edges.length} connections${p.key ? ', key' : ''}`)
    const missing = p.shapes.filter(s => s.implicit).map(s => s.id)
    if (missing.length) console.log(`  warning: connected but never declared (made as process): ${missing.join(', ')}`)
}
for (const e of errors) console.log(`Line ${e.line + 1}: ${e.msg}`)
console.log(errors.length ? `${errors.length} error(s)` : 'OK')
process.exit(errors.length ? 1 : 0)
