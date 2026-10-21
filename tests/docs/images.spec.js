/* Rebuilds every picture in the documentation, using the app itself, as part of npm test:
     - docs/diagrams/shape-gallery.flow, generated from the palette, so it always shows every shape
     - docs/diagrams/patterns.flow, every ready-made pattern on one page, generated from PATTERNS the same way
     - a PNG of every .flow in docs/diagrams and examples, made with the app's own PNG export
       (one PNG per page for a file with several pages: name-<page>.png). Each page is fitted to its content
       first and the size saved into the .flow, so the editor opens it at the same size as its picture
     - docs/screenshots/editor.png, the editor with the example open
   Run alone with: npx playwright test --project=docs
   Each test also checks its diagram opens without errors, so a broken diagram in the docs fails the suite.
   On CI the pictures are made too (on Linux, without Calibri) and thrown away; the ones to commit are yours. */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {test, expect} from '../e2e/fixtures.js';

const GALLERY = 'docs/diagrams/shape-gallery.flow', PATTERNS_FLOW = 'docs/diagrams/patterns.flow';
const slug = s => s.toLowerCase().replace(/^\d+\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Opens a .flow file and fails on any error in it */
async function open(page, file) {
    await page.setInputFiles('#fileInput', file);
    await expect(page.locator('#layer [data-id]').first()).toBeVisible();
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
}

/* Fits every page to its content (the Page panel's Fit page to content) and saves the result back to the .flow
   file, so the diagram opens in the editor at the same size as its picture. Only page lines change
   (page "Name" size WxH ...); the file keeps its own line endings. */
async function fitPages(page, file) {
    const text = await page.evaluate(async () => {
        const {fitPageToContent} = await import('/engine/visio-io.ts');
        for (const tab of [...document.querySelectorAll('#tabs button')].filter(b => b.textContent.trim() !== '+')) {
            tab.click();
            fitPageToContent();
        }
        return (await import('/engine/core.ts')).S.text;
    });
    // an empty text means the page saw a fresh core.ts (Vite reloaded it mid-run, e.g. after an edit), not this drawing
    if (!text.trim()) throw new Error(`Read back an empty drawing for ${file}; not saving over it`);
    const before = fs.readFileSync(file, 'utf8'), eol = before.includes('\r\n') ? '\r\n' : '\n';
    if (text !== before.replace(/\r\n/g, '\n')) fs.writeFileSync(file, text.replace(/\n/g, eol));
}

/* Saves the open drawing as PNGs the way Export does it, one per page, next to its .flow file */
async function exportPng(page, file) {
    await fitPages(page, file);
    const [ext, b64] = await page.evaluate(async () => {
        const {buildPngExport} = await import('/engine/formats/raster.ts');
        const {blob, ext} = await buildPngExport();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return [ext, btoa(s)];
    });
    const base = file.replace(/\.flow$/, ''), data = Buffer.from(b64, 'base64');
    if (ext === 'png') return fs.writeFileSync(base + '.png', data);
    const zip = await JSZip.loadAsync(data);
    for (const [name, entry] of Object.entries(zip.files))
        fs.writeFileSync(`${base}-${slug(name.replace(/\.png$/, ''))}.png`, await entry.async('nodebuffer'));
}

test('the shape gallery shows every palette shape', async ({app, page}) => {
    const flow = await page.evaluate(async () => {
        const {PALETTE, SHAPES} = await import('/shapes/index.ts');
        const BS = String.fromCharCode(92);
        const q = s => '"' + String(s).split(BS).join(BS + BS).split('"').join(BS + '"').split('\n').join(BS + 'n') + '"';
        const out = ['flow 1', '',
            '# Every palette shape, one page per palette group, drawn with its default text and sample values.',
            '# Generated from PALETTE by tests/docs/images.spec.js on every test run; edits here are overwritten.'];
        const groups = PALETTE.groups.map((g, i) => i ? g : {...g, items: [...PALETTE.pinned, ...g.items]});   // Text joins Flowchart
        for (const g of groups) {
            out.push('', `page ${q(g.name)} direction LR`, '');
            g.items.forEach((it, i) => {
                const d = SHAPES[it.kind], cx = 10 + (i % 4) * 92, cy = 10 + Math.floor(i / 4) * 52;
                const k = Math.min(1, 86 / (d.w * 25.4), 32 / (d.h * 25.4));
                const w = +(d.w * 25.4 * k).toFixed(1), h = +(d.h * 25.4 * k).toFixed(1);
                const x = +(cx + (86 - w) / 2).toFixed(1), y = +(cy + (32 - h) / 2).toFixed(1);
                out.push(`${it.kind}: ${it.kind} ${q(d.text ?? (it.kind === 'text' ? 'Text' : ''))} @ ${x},${y} ${w}x${h}`);
                out.push(`${it.kind}_cap: text ${q(`${it.label} (${it.kind})`)} @ ${cx},${cy + 35} 86x8`);
            });
        }
        return out.join('\n') + '\n';
    });
    fs.writeFileSync(GALLERY, flow);
    await open(page, GALLERY);
    await exportPng(page, GALLERY);
});

test('the patterns page shows every ready-made pattern', async ({app, page}) => {
    test.setTimeout(120_000);   // over a hundred patterns on one page, laid out and exported
    const flow = await page.evaluate(async () => {
        const {PATTERNS, patternLines} = await import('/shapes/index.ts');
        const out = ['flow 1', '',
            '# Every ready-made pattern on the palette, put in the way the Patterns buttons put them in.',
            '# Generated from PATTERNS by tests/docs/images.spec.js on every test run; edits here are overwritten.',
            '', 'page "Patterns" direction LR'], used = new Set();
        let x = 10, y = 10, rowH = 0;
        for (const p of PATTERNS) {   // in rows, left to right, using each pattern's rough size
            if (x > 10 && x + p.w > 360) {
                x = 10;
                y += rowH + 20;
                rowH = 0;
            }
            out.push('', ...patternLines(p, x, y, used).lines);
            x += p.w + 20;
            rowH = Math.max(rowH, p.h);
        }
        return out.join('\n') + '\n';
    });
    fs.writeFileSync(PATTERNS_FLOW, flow);
    await open(page, PATTERNS_FLOW);
    await exportPng(page, PATTERNS_FLOW);
});

const diagrams = ['docs/diagrams', 'examples', 'examples/patterns'].flatMap(dir =>
    fs.readdirSync(dir).filter(f => f.endsWith('.flow')).map(f => path.posix.join(dir, f))).filter(f => f !== GALLERY && f !== PATTERNS_FLOW);

for (const file of diagrams)
    test(`${file} opens cleanly and is exported to PNG`, async ({app, page}) => {
        await open(page, file);
        await exportPng(page, file);
    });

/* The IntelliSense list in the text pane, as docs/flow-language.md describes it: typed, not opened by hand, so the
   pictures show what really pops up. Nothing is saved; the half-typed line just isn't applied. */
for (const [name, typed, first] of [
    ['kinds', 'note: pro', 'process'],                  // shape types after "id:", filtered as you type
    ['connections', 'start ', '->'],                    // connection types after a shape id
])
    test(`the IntelliSense screenshot: ${name}`, async ({app, page}) => {
        await open(page, 'docs/diagrams/language-example.flow');
        await expect(page.locator('#toast')).not.toHaveClass(/show/, {timeout: 8000});   // let the "Opened" toast fade
        await page.click('#textTab');
        await page.click('#tpPin');
        await page.locator('#codeText').focus();          // not a click, which would select the line clicked on
        await page.keyboard.press('Control+End');
        await page.keyboard.type('\n' + typed);
        await expect(page.locator('#suggest')).toBeVisible();
        await expect(page.locator('#suggest li').first()).toContainText(first);
        fs.mkdirSync('docs/screenshots', {recursive: true});
        await page.locator('#textPane').screenshot({path: `docs/screenshots/intellisense-${name}.png`});
    });

test('the README screenshot: the example open, text pinned, a shape selected', async ({app, page}) => {
    await open(page, 'examples/build-pipeline.flow');
    await expect(page.locator('#toast')).not.toHaveClass(/show/, {timeout: 8000});   // let the "Opened" toast fade
    await page.click('#textTab');
    await page.click('#tpPin');                   // unpinned, the pane hides when the canvas is clicked
    await page.click('#btnFit');
    await page.locator('#layer text', {hasText: 'Run linter'}).first().click();
    await expect(page.locator('#pId')).toHaveValue(/lint/);
    fs.mkdirSync('docs/screenshots', {recursive: true});
    await page.screenshot({path: 'docs/screenshots/editor.png'});
});
