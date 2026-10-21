import {test, expect} from './fixtures.js';

/* Stages C and E of ShapesPlan.md: the Gantt chart, and charts that need many labels */

/* Opens a .flow document given as text */
const openFlow = (app, text) => app.open({name: 'charts.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});

/* Clicks a palette button, opening its (collapsed) group first */
async function addFromPalette(page, kind) {
    const b = page.locator(`.palette [data-kind="${kind}"]`);
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

/* The filled parts of a shape, as [fill, left, width] in screen pixels, in drawing order, leaving out a chart's
   backdrop ([bg=], on by default) */
const filledParts = shape => shape.locator('path[data-sec]:not([fill="none"]):not([data-bg])').evaluateAll(ps => ps.map(p => {
    const r = p.getBoundingClientRect();
    return [p.getAttribute('fill'), r.left, r.width, r.top];
}));

test('a Gantt chart draws a bar per task from its start for its length, each in its own colour', async ({
                                                                                                            app,
                                                                                                            page
                                                                                                        }) => {
    await openFlow(app, 'flow 1\npage "Plan"\ng: gantt "Launch" { 0, 2; 2, 4; 6, 2 } @ 10,10 90x50\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const bars = await filledParts(app.shape('Launch'));
    expect(bars).toHaveLength(3);
    expect(new Set(bars.map(b => b[0])).size).toBe(3);                       // a colour each
    const unit = bars[0][2] / 2;                                             // the first task is 2 long
    expect(bars[1][1] - bars[0][1]).toBeCloseTo(unit * 2, 0);                // the second starts at 2
    expect(bars[1][2]).toBeCloseTo(unit * 4, 0);                             // and is 4 long
    expect(bars[0][3]).toBeLessThan(bars[1][3]);                             // the first task at the top
    await openFlow(app, 'flow 1\npage "Plan"\na: process "Step"\ng: gantt "Bad" { 0, 2, 5 } @ 10,10\n');
    await expect(page.locator('#tpStatus')).toContainText('two numbers per task');
    await openFlow(app, 'flow 1\npage "Plan"\ng: schedule "Plan" { 1, 2; 3, 1 } @ 10,10\n');
    await addFromPalette(page, 'gantt');
    const text = await app.flowText();
    expect(text).toMatch(/: gantt "Project plan"/);
    expect(text).toContain('g: schedule "Plan" { 1, 2; 3, 1 } @ 10,10');
});

test('a legend row puts each square just before its name, side by side, in the series colours', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\nl: hlegend "North | A much longer name | East" @ 10,10\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const squares = await filledParts(app.shapes.first());
    expect(squares).toHaveLength(3);
    expect(new Set(squares.map(s => s[0])).size).toBe(3);
    const names = await app.shapes.first().locator('text').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().left));
    names.forEach((left, i) => {
        const gap = left - (squares[i][1] + squares[i][2]);              // from the square's right edge to its name
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(15);
    });
    await addFromPalette(page, 'legendrow');
    const text = await app.flowText();
    expect(text).toMatch(/: legendrow "Series 1 \| Series 2 \| Series 3"/);
    expect(text).toContain('l: hlegend "North | A much longer name | East" @ 10,10');
});

/* For each name on a shape that places its own labels: the name, and whether its middle is inside a filled part */
const namesOnTiles = shape => shape.evaluate(g => {
    const tiles = [...g.querySelectorAll('path[data-sec]:not([fill="none"])')].map(p => p.getBoundingClientRect());
    return [...g.querySelectorAll('text')].map(t => {
        const r = t.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        return [t.textContent, tiles.some(b => x > b.left && x < b.right && y > b.top && y < b.bottom)];
    });
});

test('a treemap puts each name on its own tile, with its own values and with the sample from the palette', async ({
                                                                                                                      app,
                                                                                                                      page
                                                                                                                  }) => {
    await openFlow(app, 'flow 1\npage "BI"\nm: treemap "Rent | Food | Fun" { 6, 3, 1 } @ 10,10 90x60\n' +
        'odd: tiles "A | B | C | D" { 2, 1 } @ 110,10\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shop = app.shapes.filter({hasText: 'Rent'});
    expect(await namesOnTiles(shop)).toEqual([['Rent', true], ['Food', true], ['Fun', true]]);
    const tiles = await filledParts(shop);
    expect(tiles).toHaveLength(3);
    const area = t => t[2];   // widths share the same height in a row; the biggest value has the widest tile here
    expect(area(tiles[0])).toBeGreaterThan(area(tiles[2]));
    // more names than values: the extra names have no tile and aren't drawn
    expect((await namesOnTiles(app.shapes.filter({hasText: 'A'}))).map(n => n[0])).toEqual(['A', 'B']);
    // editing the label on the page renames the tiles
    await app.click('Rent');
    await app.click('Rent');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Home | Food | Fun');
    await page.keyboard.press('Control+Enter');
    await expect(app.shapes.filter({hasText: 'Home'})).toHaveCount(1);
    expect(await namesOnTiles(app.shapes.filter({hasText: 'Home'}))).toEqual([['Home', true], ['Food', true], ['Fun', true]]);
    // from the palette: the sample values, with the default names on them
    await addFromPalette(page, 'treemap');
    const fresh = app.shapes.filter({hasText: 'Travel'});
    const names = await namesOnTiles(fresh);
    expect(names).toHaveLength(5);
    expect(names.every(n => n[1])).toBe(true);
    const text = await app.flowText();
    expect(text).toContain('m: treemap "Home | Food | Fun" { 6, 3, 1 } @ 10,10 90x60');
    expect(text).toMatch(/: treemap "Rent \| Food \| Travel \| Fun \| Other"/);
});

test('a word cloud sizes each word by its value and packs them without overlapping, inside the shape', async ({
                                                                                                                  app,
                                                                                                                  page
                                                                                                              }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n' +
        'w: tagcloud "Fast | Simple | Friendly | Cheap | Secure | Calm" { 10, 6, 5, 3, 2, 1 } @ 10,10 100x60\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const cloud = app.shapes.filter({hasText: 'Fast'});
    const words = await cloud.evaluate(g => {
        const box = g.getBoundingClientRect();
        return {
            box: {l: box.left, r: box.right, t: box.top, b: box.bottom},
            words: [...g.querySelectorAll('text')].map(t => {
                const r = t.getBoundingClientRect();
                return {
                    w: t.textContent,
                    size: +t.getAttribute('font-size'),
                    fill: t.getAttribute('fill'),
                    l: r.left,
                    r: r.right,
                    t: r.top,
                    b: r.bottom
                };
            })
        };
    });
    expect(words.words.map(w => w.w).sort()).toEqual(['Calm', 'Cheap', 'Fast', 'Friendly', 'Secure', 'Simple']);
    const by = n => words.words.find(w => w.w === n);
    expect(by('Fast').size).toBeGreaterThan(by('Simple').size);
    expect(by('Simple').size).toBeGreaterThan(by('Calm').size);
    expect(new Set(words.words.map(w => w.fill)).size).toBeGreaterThan(3);   // colours go round the series
    for (const a of words.words) {
        for (const b of words.words) if (a !== b)
            expect(a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1).toBe(false);
    }
    await addFromPalette(page, 'wordcloud');
    await expect(app.shapes.filter({hasText: 'Reliable'})).toHaveCount(1);
    const text = await app.flowText();
    expect(text).toMatch(/: wordcloud "Fast \| Simple/);
    expect(text).toContain('w: tagcloud "Fast | Simple | Friendly | Cheap | Secure | Calm" { 10, 6, 5, 3, 2, 1 } @ 10,10 100x60');
});

test('a Sankey joins its named nodes with bands as wide as their flows, skipping flows past the last name', async ({
                                                                                                                       app,
                                                                                                                       page
                                                                                                                   }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n' +
        's: alluvial "In | Kept | Lost" { 1, 2, 30; 1, 3, 10; 1, 7, 5 } @ 10,10 100x60\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.filter({hasText: 'Kept'});
    const parts = await filledParts(shape);
    expect(parts).toHaveLength(5);                                   // two bands, then three nodes
    const nodeH = await shape.locator('path[data-sec]:not([fill="none"])').evaluateAll(ps =>
        ps.slice(2).map(p => p.getBoundingClientRect().height));
    expect(nodeH[0]).toBeGreaterThan(nodeH[1]);                      // In (40) is taller than Kept (30) ...
    expect(nodeH[1] / nodeH[2]).toBeCloseTo(3, 0);                   // ... and Kept three times Lost (10)
    expect(await shape.locator('text').allTextContents()).toEqual(['In', 'Kept', 'Lost']);
    for (const [vals, msg] of [['{ 1, 0, 5 }', 'counting from 1'], ['{ 2, 2, 5 }', 'not back to the same one'],
        ['{ 1, 2 }', 'three numbers per flow']]) {
        await openFlow(app, `flow 1\npage "BI"\na: process "Step"\ns: sankey "A | B" ${vals} @ 10,10\n`);
        await expect(page.locator('#tpStatus')).toContainText(msg);
    }
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n');
    await addFromPalette(page, 'sankey');
    await expect(app.shapes.filter({hasText: 'Signed up'})).toHaveCount(1);
    expect(await app.flowText()).toMatch(/: sankey "Visits \| Signed up/);
});

test('a chord diagram has an arc per group with its name outside, a ribbon per pair, and needs a square table', async ({
                                                                                                                           app,
                                                                                                                           page
                                                                                                                       }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n' +
        'c: chorddiagram "UK | France | Spain" { 0, 5, 3; 4, 0, 0; 2, 0, 0 } @ 10,10 70x70\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.filter({hasText: 'France'});
    // ribbons UK-France and UK-Spain (France and Spain send each other nothing), then three arcs
    expect(await filledParts(shape)).toHaveLength(5);
    const outside = await shape.evaluate(g => {
        const arcs = [...g.querySelectorAll('path[data-sec]:not([fill="none"])')].slice(-3).map(p => p.getBoundingClientRect()),
            l = Math.min(...arcs.map(r => r.left)), r = Math.max(...arcs.map(r => r.right)),
            t = Math.min(...arcs.map(r => r.top)), bt = Math.max(...arcs.map(r => r.bottom)),
            cx = (l + r) / 2, cy = (t + bt) / 2, rad = (r - l) / 2;
        return [...g.querySelectorAll('text')].map(tx => {
            const q = tx.getBoundingClientRect();
            return Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) > rad;
        });
    });
    expect(outside).toEqual([true, true, true]);
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step"\nc: chord "A | B" { 1, 2; 3 } @ 10,10\n');
    await expect(page.locator('#tpStatus')).toContainText('square table');
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n');
    await addFromPalette(page, 'chord');
    await expect(app.shapes.filter({hasText: 'Italy'})).toHaveCount(1);
    expect(await app.flowText()).toMatch(/: chord "UK \| France \| Spain \| Italy"/);
});

test('a tile map gives each region a tile shaded by its value, darkest for the highest, with its name on it', async ({
                                                                                                                         app,
                                                                                                                         page
                                                                                                                     }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n' +
        't: choropleth "North | South | East | West" { 2, 9, 5 } @ 10,10 60x60\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.filter({hasText: 'North'});
    expect(await namesOnTiles(shape)).toEqual([['North', true], ['South', true], ['East', true], ['West', true]]);
    const lum = await shape.locator('path[data-sec]:not([fill="none"])').evaluateAll(ps => ps.map(p => {
        const h = p.getAttribute('fill'), n = parseInt(h.slice(1), 16);
        return (n >> 16 & 255) + (n >> 8 & 255) + (n & 255);   // brighter is paler
    }));
    expect(lum[1]).toBeLessThan(lum[2]);   // South (9) darker than East (5) ...
    expect(lum[2]).toBeLessThan(lum[0]);   // ... darker than North (2) ...
    expect(lum[0]).toBeLessThan(lum[3]);   // ... and West, with no value, palest
    await addFromPalette(page, 'tilemap');
    await expect(app.shapes.filter({hasText: 'Scotland'})).toHaveCount(1);
    expect(await app.flowText()).toContain('t: choropleth "North | South | East | West" { 2, 9, 5 } @ 10,10 60x60');
});

/* Each name drawn on a map, with the fill of the region under its middle, as [name, fill] */
const regionFillsUnder = shape => shape.evaluate(g => [...g.querySelectorAll('text')].map(t => {
    const r = t.getBoundingClientRect(), under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        .find(e => e.matches('path[data-sec]:not([fill="none"])') && g.contains(e));
    return [t.textContent, under?.getAttribute('fill')];
}));

test('a world map shades the countries named in the label by their values and names them on the map', async ({
                                                                                                                 app,
                                                                                                                 page
                                                                                                             }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 250,10\n' +
        'w: geomap "Brazil | USA | Atlantis | Côte d\'Ivoire | India" { 2, 9, 5, 4 } @ 10,10 200x90\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.filter({hasText: 'Brazil'});
    expect(await shape.locator('path[data-sec]:not([fill="none"])').count()).toBeGreaterThan(150);   // every country
    const under = Object.fromEntries(await regionFillsUnder(shape));
    expect(Object.keys(under)).toEqual(['Brazil', 'USA', "Côte d'Ivoire", 'India']);   // no Atlantis on the map
    const lum = h => {
        const n = parseInt(h.slice(1), 16);
        return (n >> 16 & 255) + (n >> 8 & 255) + (n & 255);   // brighter is paler
    };
    expect(lum(under.USA)).toBeLessThan(lum(under.Brazil));            // USA (9) darker than Brazil (2) ...
    expect(lum(under.Brazil)).toBeLessThan(lum(under.India));          // ... and India, with no value, palest
    expect(await app.flowText()).toContain('w: geomap "Brazil | USA | Atlantis | Côte d\'Ivoire | India" { 2, 9, 5, 4 }');
});

test('a country map (the UK) has its twelve regions, named by name, short name or code, and both maps are on the palette', async ({
                                                                                                                                      app,
                                                                                                                                      page
                                                                                                                                  }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 150,10\n' +
        'u: countrymap "Scotland | NI | Yorkshire | TLI" { 1, 2, 3, 4 } @ 10,10 70x120\n');
    const shape = app.shapes.filter({hasText: 'Scotland'});
    await expect(shape.locator('path[data-sec]:not([fill="none"])')).toHaveCount(12);
    const under = await regionFillsUnder(shape);
    expect(under.map(u => u[0])).toEqual(['Scotland', 'NI', 'Yorkshire', 'TLI']);
    expect(new Set(under.map(u => u[1])).size).toBe(4);                       // a shade each
    await addFromPalette(page, 'worldmap');
    await addFromPalette(page, 'countrymap');
    await expect(app.shapes.filter({hasText: 'Australia'})).toHaveCount(1);
    await expect(app.shapes.filter({hasText: 'West Midlands'})).toHaveCount(1);
    const text = await app.flowText();
    expect(text).toMatch(/: worldmap "USA \| Brazil/);
    expect(text).toMatch(/: countrymap "East Midlands \|/);
});

test('a route map (Yorkshire) shades its parts and draws motorways in blue and main A roads in green over them', async ({
                                                                                                                            app,
                                                                                                                            page
                                                                                                                        }) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step" @ 220,10\n' +
        'r: roads "West Yorkshire | Sheffield | North Yorks" { 9, 4 } @ 10,10 180x140\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.filter({hasText: 'West Yorkshire'});
    await expect(shape.locator('path[data-sec]:not([fill="none"])')).toHaveCount(4);
    const under = Object.fromEntries(await regionFillsUnder(shape));
    expect(Object.keys(under)).toEqual(['West Yorkshire', 'Sheffield', 'North Yorks']);   // Sheffield: South Yorkshire
    const lum = h => {
        const n = parseInt(h.slice(1), 16);
        return (n >> 16 & 255) + (n >> 8 & 255) + (n & 255);
    };
    expect(lum(under['West Yorkshire'])).toBeLessThan(lum(under.Sheffield));
    expect(lum(under['West Yorkshire'])).toBeGreaterThan(lum('#1F6F78'));   // kept paler than the fill, for the roads
    const roads = await shape.locator('path[data-sec][fill="none"]').evaluateAll(ps => ps.map(p => p.getAttribute('stroke')));
    expect(roads.filter(s => s === '#4A6FB5').length).toBeGreaterThan(5);     // motorways
    expect(roads.filter(s => s === '#5E8C33').length).toBeGreaterThan(50);    // primary A roads
    await addFromPalette(page, 'routemap');
    await expect(app.shapes.filter({hasText: 'East Yorkshire'})).toHaveCount(1);
    const text = await app.flowText();
    expect(text).toContain('r: roads "West Yorkshire | Sheffield | North Yorks" { 9, 4 } @ 10,10 180x140');
    expect(text).toMatch(/: routemap "East Yorkshire \|/);
});

test('a route map shows another county with map=, or picked in the Map box, its districts named any common way', async ({
                                                                                                                            app,
                                                                                                                            page
                                                                                                                        }) => {
    const LANCS = 'r: routemap "Preston | Blackpool | Blackburn" { 3, 8, 5 } @ 10,10 110x140 [map=lancashire]';
    await openFlow(app, `flow 1\npage "NW"\n${LANCS}\n`);
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.filter({has: page.locator('path[data-sec][fill="none"]')});   // the one with roads
    await expect(shape.locator('path[data-sec]:not([fill="none"])')).toHaveCount(14);   // Lancashire's districts
    expect((await regionFillsUnder(shape)).map(u => u[0])).toEqual(['Preston', 'Blackpool', 'Blackburn']);
    expect(await app.flowText()).toContain(LANCS);
    const pick = async () => {
        const c = await app.centreOf(shape);
        await page.mouse.click(c.x, c.y);
    };
    await pick();
    await expect(page.locator('#mapWrap')).toBeVisible();
    await expect(page.locator('#pMap')).toHaveValue('lancashire');
    await page.selectOption('#pMap', 'greatermanchester');                   // its own label is kept
    await expect(shape.locator('path[data-sec]:not([fill="none"])')).toHaveCount(10);
    expect(await app.flowText()).toContain('r: routemap "Preston | Blackpool | Blackburn" { 3, 8, 5 } @ 10,10 110x140 [map=greatermanchester]');
    await openFlow(app, 'flow 1\npage "NW"\nr: routemap "East Yorkshire | North Yorkshire | South Yorkshire | West Yorkshire" @ 10,10 110x140\n');
    await pick();
    await page.selectOption('#pMap', 'merseyside');                          // the sample label follows the map
    const text = await app.flowText();
    expect(text).toMatch(/r: routemap "Halton \| Knowsley \| Liverpool \| Sefton \| St Helens \| Wirral" @ 10,10 110x140 \[map=merseyside\]/);
    await openFlow(app, 'flow 1\npage "NW"\nr: routemap\nb: bar [map=lancashire]\n');
    await expect(page.locator('#tpStatus')).toContainText('Only country maps and route maps have a map');
    await openFlow(app, 'flow 1\npage "NW"\nr: routemap\nc: routemap [map=devon]\n');
    await expect(page.locator('#tpStatus')).toContainText('map is one of: yorkshire, cheshire, cumbria, greatermanchester, lancashire, merseyside');
});

test('a country map shows France with map=france, its departments named by name, number or code', async ({
                                                                                                             app,
                                                                                                             page
                                                                                                         }) => {
    const FR = 'f: countrymap "Nord | 69 | FR-2A | Gironde | Atlantis" { 9, 6, 3, 5 } @ 10,10 160x160 [map=france]';
    await openFlow(app, `flow 1\npage "FR"\n${FR}\n`);
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const shape = app.shapes.first();   // the only shape: its names change with its map
    await expect(shape.locator('path[data-sec]:not([fill="none"])')).toHaveCount(96);   // mainland and Corsica
    const under = await regionFillsUnder(shape);
    expect(under.map(u => u[0])).toEqual(['Nord', '69', 'FR-2A', 'Gironde']);
    expect(new Set(under.map(u => u[1])).size).toBe(4);
    expect(await app.flowText()).toContain(FR);
    const c = await app.centreOf(shape);
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#pMap option')).toHaveText(['United Kingdom', 'France']);
    await page.selectOption('#pMap', 'uk');
    await expect(shape.locator('path[data-sec]:not([fill="none"])')).toHaveCount(12);
    expect(await app.flowText()).toContain('f: countrymap "Nord | 69 | FR-2A | Gironde | Atlantis" { 9, 6, 3, 5 } @ 10,10 160x160\n');
});
