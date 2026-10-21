/* Writes the generated reference files of the designroutes-flow Claude skill (.claude/skills/designroutes-flow/references)
   from the shape definitions themselves, so the skill can't drift from the code: every shape type with its palette
   name, what it is, its default label and size, every alias, and the docs' example flows. It also bundles the parser
   into the skill (so its checker runs without this repo) and zips the whole skill to skill-dist/designroutes-flow-skill.zip
   for sharing. Run after adding or changing a shape, or the language, or after a test run regenerates docs/diagrams:
       node scripts/build-flow-skill.mjs                                                                              */
import {build} from 'esbuild'
import {mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs'
import JSZip from 'jszip'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skill = join(root, '.claude', 'skills', 'designroutes-flow')
const out = join(skill, 'references')

/* The palette's groups, in palette order: the file each comes from and what the group is called */
const GROUPS = [
    ['flowchart', 'flowchartShapes', 'Flowchart'],
    ['database', 'databaseShapes', 'Database'],
    ['systems', 'systemsShapes', 'Systems, C4 and network'],
    ['containers', 'containerShapes', 'Containers'],
    ['wireframe', 'wireframeShapes', 'UI wireframe'],
    ['charts', 'chartShapes', 'BI / dashboards (charts)'],
    ['planning', 'planningShapes', 'Planning'],
    ['uml', 'umlShapes', 'UML'],
    ['bpmn', 'bpmnShapes', 'BPMN'],
]

/* Bundles a TypeScript entry to a temporary ES module and imports it */
async function load(entry) {
    const file = join(tmpdir(), `designroutes-skill-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
    await build({
        entryPoints: [join(root, entry)],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: file,
        logLevel: 'error'
    })
    return import(pathToFileURL(file).href)
}

/* What a shape means, for the ones whose palette entry has no tooltip and whose name alone doesn't say: mostly the
   standard flowchart symbols, whose meaning is convention rather than anything the editor draws */
const MEANING = {
    process: 'A step or action',
    decision: 'A question; its outgoing connections are the answers, named in their labels',
    terminator: 'Where the flow starts or ends',
    data: 'Input or output of data (parallelogram)',
    subprocess: 'A step defined elsewhere, in its own flow',
    document: 'A document produced or used',
    multidoc: 'Several documents',
    manualInput: 'Data typed in by hand',
    manualOp: 'A step done by hand, not by the system',
    preparation: 'Setting up before a step (hexagon)',
    delay: 'A wait',
    offPage: 'Continues on another page',
    ellipse: 'A plain ellipse; also a UML use case',
    database: 'Stored data (cylinder)',
    table: 'A database table: name in the label, columns in `{ }`',
    server: 'A server',
    cloud: 'A cloud service or the internet',
    user: 'A person or role; also a UML actor',
    api: 'A system, service or API',
    grid: 'A table of cells: rows in `{ }` separated by `;`, cells by `,`; the first row is the header',
}

const mm = inches => Math.round(inches * 25.4)
const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, '\\n')
const isPart = k => /^(table(Header|Row)|grid(Head|Cell))$/.test(k)

/* What a shape does beyond drawing its label, from its definition's flags */
function notes(def) {
    const n = []
    if (def.chart) n.push('chart: values in `{ }`')
    if (def.colours) n.push('`colours=`')
    if (def.table) n.push('columns in `{ }`')
    if (def.grid) n.push('cells in `{ }`')
    if (def.stateful) n.push('`state=on`')
    if (def.sides) n.push('`side=right`')
    if (def.fixedSize) n.push('fixed size')
    return n.join(', ')
}

const {ShapeKinds} = await load('src/engine/flow/shape-kinds.ts')
const {CHART_SAMPLES, formatValues} = await load('src/shapes/charts.ts')
const aliasesOf = {}
for (const [alias, kind] of Object.entries(ShapeKinds)) (aliasesOf[kind] ??= []).push(alias)

let shapes = `# Shape types

Generated from \`src/shapes/*.ts\` by \`scripts/build-flow-skill.mjs\`; edits here are overwritten.

Every type you can write after \`id:\`, by palette group. **Default label** is what a shape added from the palette
starts with: it doubles as an example of the label format (\`|\` separates parts, \`\\n\` is a new line). **Size** is
the default width x height in mm, used when the line gives no \`WxH\` (most shapes still grow to fit their text).
Aliases are in [aliases.md](aliases.md).
`
for (const [file, name, title] of GROUPS) {
    const mod = await load(`src/shapes/${file}.ts`)
    const charts = file === 'charts'
    shapes += `\n## ${title}\n\n| Type | Palette name | What it is | Default label |${charts ? ' Sample values |' : ''} Size | Notes |\n`
        + `|---|---|---|---|${charts ? '---|' : ''}---|---|\n`
    for (const [kind, def] of Object.entries(mod[name])) {
        if (isPart(kind)) continue
        const p = def.palette
        const what = p?.title ? p.title.replace(new RegExp(`^${p.label}:\\s*`, 'i'), '') : MEANING[kind] ?? ''
        const sample = charts && CHART_SAMPLES[kind] ? `\`{ ${cell(formatValues(kind, CHART_SAMPLES[kind]))} }\`` : ''
        shapes += `| \`${kind}\` | ${cell(p?.label ?? '(not on the palette)')} | ${cell(what)} | ${def.text ? `\`${cell(def.text)}\`` : ''} |`
            + `${charts ? ` ${sample} |` : ''} ${mm(def.w)}x${mm(def.h)} | ${notes(def)} |\n`
    }
}

let aliases = `# Type aliases

Generated from \`src/engine/flow/shape-kinds.ts\` by \`scripts/build-flow-skill.mjs\`; edits here are overwritten.

Other names that are read as a shape type. Files saved by the editor always write the type itself.

| Type | Also written as |
|---|---|
`
for (const [kind, list] of Object.entries(aliasesOf)) aliases += `| \`${kind}\` | ${list.map(a => `\`${a}\``).join(', ')} |\n`

/* Whole files to learn from: the docs' own diagrams (docs/diagrams/*.flow, regenerated by the test run), each with
   what it shows. Icon lines are left out: they're base64 pictures, no use to read and often huge. */
const EXAMPLES = [
    ['language-example', 'A small flowchart with a chart, two database tables joined by a crow\'s foot, and a key.'],
    ['swimlanes', 'A pool of lanes; every box names its lane with `in=`, and nothing is placed by hand.'],
    ['kanban', 'Flexi containers: a row of columns, each a column of cards, in line order.'],
    ['mind-map', 'A mind map: indentation is the hierarchy, with no connections.'],
    ['org-chart', 'Person cards joined by plain connections, laid out as a tree automatically.'],
    ['scroll-area', 'A scroll area that is also a column flexi container.'],
    ['connection-types', 'Every connection type, placed by hand, with the page key.'],
    ['patterns', 'Every ready-made pattern (forms, dashboard, chat, journey map, ...), as the palette adds them.'],
    ['app-wireframe', 'A whole app screen wireframed with placed shapes; later lines are drawn on top.'],
]
let examples = `# Example flows

Copied from \`docs/diagrams/*.flow\` by \`scripts/build-flow-skill.mjs\`; edits here are overwritten. Every one of these
parses cleanly and is drawn by the editor for the docs (the PNG beside each source in \`docs/diagrams\`).
`
for (const [name, about] of EXAMPLES) {
    const text = readFileSync(join(root, 'docs', 'diagrams', `${name}.flow`), 'utf8')
        .split(/\r?\n/).filter(l => !/^\s*icon\s/i.test(l) && !/^#.*overwritten/.test(l)).join('\n').trim()
    examples += `\n## ${name}\n\n${about}\n\n\`\`\`\n${text}\n\`\`\`\n`
}

mkdirSync(out, {recursive: true})
writeFileSync(join(out, 'shapes.md'), shapes)
writeFileSync(join(out, 'aliases.md'), aliases)
writeFileSync(join(out, 'examples.md'), examples)
console.log(`Wrote shapes.md, aliases.md and examples.md to ${out}`)

/* The same skill as one plain Markdown file, for a Claude with no skills or code execution: attach it to a chat or
   paste it into a project's knowledge. SKILL.md without its frontmatter and its <!-- skill-only --> parts (the
   checker script, the repo's source), then the reference files as sections, their links turned into anchors. */
const SECTIONS = {shapes: 'shape-types', aliases: 'type-aliases', examples: 'example-flows'}
const toAnchors = md => md
    .replace(/\[(?:references\/)?(shapes|aliases|examples)\.md\]\((?:references\/)?\1\.md\)/g, (_, f) => `[${f}](#${SECTIONS[f]})`)
/* Headings one level down, outside code fences only (a # in a .flow example is a comment), and without the
   paragraph saying where the file was generated from, which means nothing outside the repo */
const demote = md => {
    let fenced = false
    return md.replace(/^(?:Generated|Copied) from `[\s\S]*?\n\n/m, '').split('\n').map(line => {
        if (line.startsWith('```')) fenced = !fenced
        return !fenced && /^#+ /.test(line) ? `#${line}` : line
    }).join('\n')
}
const body = readFileSync(join(skill, 'SKILL.md'), 'utf8')
    .replace(/^---[\s\S]*?\n---\n/, '')
    .replace(/<!-- skill-only -->[\s\S]*?<!-- \/skill-only -->\n?/g, '')
const guide = `<!-- Generated from .claude/skills/designroutes-flow by scripts/build-flow-skill.mjs in the DesignRoutes repo. -->
> **For Claude:** this document is the complete reference for DesignRoutes's \`.flow\` diagram language. Use it to
> write, read, explain or review \`.flow\` files, or to build things from them. It is self-contained: nothing else
> about DesignRoutes is needed. The sections after the language itself list every shape type, every alias and complete
> example files.

${toAnchors(body).trim()}

${[shapes, aliases, examples].map(md => toAnchors(demote(md)).trim()).join('\n\n')}
`
const skillDist = join(root, 'skill-dist')
mkdirSync(skillDist, {recursive: true})
writeFileSync(join(skillDist, 'designroutes-flow-language.md'), guide)
console.log(`Wrote ${join(skillDist, 'designroutes-flow-language.md')}`)

/* The editor's parser, bundled into the skill so check-flow.mjs runs anywhere with Node, without this repo. Most of
   its size is map outlines, which the parser pulls in through the shape definitions; Claude runs it, never reads it. */
const parser = await build({
    entryPoints: [join(root, 'src', 'engine', 'flow', 'language.ts')],
    bundle: true, format: 'esm', platform: 'node', minify: true, logLevel: 'error', metafile: true,
    outfile: join(skill, 'scripts', 'flow-parser.mjs'),
    banner: {js: '/* DesignRoutes\'s .flow parser (src/engine/flow/language.ts), bundled by scripts/build-flow-skill.mjs. Generated; do not edit. Licence and third-party notices: ../NOTICES.md */'},
})
console.log('Wrote scripts/flow-parser.mjs')

/* The parser carries the map data and every npm package it pulls in, so the skill gets its own notices: the
   licence, the map credits from THIRD-PARTY-NOTICES.md, and the licence file of each package esbuild bundled. */
const bundled = [...new Set(Object.keys(parser.metafile.inputs)
    .map(p => p.split('\\').join('/').match(/node_modules\/((@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean))].sort()
const licenceOf = pkg => {
    const dir = join(root, 'node_modules', pkg)
    const file = readdirSync(dir).find(f => /^licen[cs]e/i.test(f))
    // a few small packages (isarray) keep their licence in the README instead
    const readme = !file && readdirSync(dir).find(f => /^readme/i.test(f))
    const text = file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim()
        : readme && readFileSync(join(dir, readme), 'utf8').replace(/\r\n/g, '\n')
            .match(/^#+ licen[cs]e\s*\n([\s\S]*?)(?=\n#+ |$)/im)?.[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').trim()
    if (!text) throw new Error(`no licence text in node_modules/${pkg}`)
    // JSZip is dual licensed; it's used under MIT, so the GPL text after it is left out
    return pkg === 'jszip' ? text.split('GPL version 3')[0].trim() : text
}
const noticesMd = readFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), 'utf8').replace(/\r\n/g, '\n')
const mapCredits = noticesMd.slice(noticesMd.indexOf('## Map data'), noticesMd.indexOf('## Software')).trim()
const notices = [
    '# Notices', '',
    'The skill, including the bundled parser in `scripts/flow-parser.mjs`, is under the licence below. The parser also',
    'contains the map data and the npm packages listed after it.', '',
    '```text', readFileSync(join(root, 'LICENSE.md'), 'utf8').replace(/\r\n/g, '\n').trim(), '```', '',
    mapCredits, '',
    '## Software', '',
    ...bundled.flatMap(pkg => {
        const {version} = JSON.parse(readFileSync(join(root, 'node_modules', pkg, 'package.json'), 'utf8'))
        return [`### ${pkg} ${version}`, '', '```text', licenceOf(pkg), '```', '']
    }),
].join('\n')
writeFileSync(join(skill, 'NOTICES.md'), notices)
console.log(`Wrote NOTICES.md (${bundled.join(', ')})`)

/* The whole skill as one zip to share: upload it as a skill on claude.ai, or unzip it into ~/.claude/skills */
const zip = new JSZip()
const add = dir => {
    for (const name of readdirSync(join(skill, dir))) {
        const rel = dir ? `${dir}/${name}` : name
        if (statSync(join(skill, rel)).isDirectory()) add(rel)
        else zip.file(`designroutes-flow/${rel}`, readFileSync(join(skill, rel)))
    }
}
add('')
const zipPath = join(skillDist, 'designroutes-flow-skill.zip')
writeFileSync(zipPath, await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'}))
console.log(`Wrote ${zipPath}`)
